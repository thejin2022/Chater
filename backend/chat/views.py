from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from .models import (
    ChatInvitation,
    ChatInvitationStatus,
    ChatSession,
    ChatSessionType,
    generate_direct_pair_key,
)
from .serializers import (
    ChatInvitationSerializer,
    ChatSessionSerializer,
    ChatSessionMemberSerializer,
    ChatSessionMessageSerializer,
)
from .services import (
    accept_invitation,
    create_group_chat_session,
    create_or_get_direct_chat_session,
    create_or_get_invitation,
    reject_invitation,
)

User = get_user_model()


class ChatSessionView(APIView):
    """
    與聊天室相關的操作：建立、查詢、更新聊天室成員。
    1. GET /chat/sessions/ - 列出使用者所屬的聊天室
    2. POST /chat/sessions/ - 建立新的聊天室
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):

        chat_sessions = ChatSession.objects.filter(
            members__user=request.user
        ).select_related("owner").prefetch_related("members__user").order_by("-update_date")

        serializer = ChatSessionSerializer(
            chat_sessions,
            many=True,
            context={"request": request},
        )
        return Response(serializer.data)


    def post(self, request):
        """
        在此建立的聊天室為群組聊天室，建立者為 owner,不會出現單人聊天室。
        """
        chat_session = create_group_chat_session(request.user)

        return Response(
            ChatSessionSerializer(
                chat_session,
                context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )


class ChatSessionDetailView(APIView):
    """
    Chat room detail operations.
    - PATCH /chat/chatrooms/<uri>/ : rename room (group owner only)
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request, uri):
        chat_session = get_object_or_404(ChatSession, uri=uri)

        if not chat_session.members.filter(user=request.user).exists():
            return Response(
                {"detail": "You are not a member of this chat session."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if chat_session.chat_type != ChatSessionType.GROUP:
            return Response(
                {"detail": "Only group chat rooms can be renamed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if chat_session.owner != request.user:
            return Response(
                {"detail": "Only the owner can rename this chat room."},
                status=status.HTTP_403_FORBIDDEN,
            )

        raw_name = request.data.get("name")
        if raw_name is None or not isinstance(raw_name, str):
            return Response(
                {"detail": "name is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        normalized_name = raw_name.strip()
        chat_session.name = normalized_name or None
        chat_session.save(update_fields=["name", "update_date"])
        _notify_room_renamed(chat_session)

        return Response(
            ChatSessionSerializer(
                chat_session,
                context={"request": request},
            ).data
        )


class DirectChatSessionView(APIView):
    """
    建立/取得 1:1 聊天室。
    - 若同一對使用者已經有 direct room，回傳既有房間
    - 否則建立新房間並加入兩位成員
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        username = request.data.get("username")
        if not username:
            return Response(
                {
                    "code": "username_required",
                    "detail": "username is required",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        invitee = get_object_or_404(User, username=username)
        if invitee == request.user:
            return Response(
                {
                    "code": "cannot_chat_with_self",
                    "detail": "You cannot create a direct chat with yourself.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        pair_key = generate_direct_pair_key(request.user.id, invitee.id)
        existing_direct_session = ChatSession.objects.filter(
            direct_pair_key=pair_key
        ).first()
        if existing_direct_session and not existing_direct_session.members.filter(
            user=request.user
        ).exists():
            return Response(
                {
                    "code": "invitation_pending",
                    "detail": "Please accept the pending invitation to join this direct chat.",
                },
                status=status.HTTP_409_CONFLICT,
            )

        chat_session, _ = create_or_get_direct_chat_session(
            initiator=request.user,
            invitee=invitee,
        )

        # If invitee is not yet a member, create pending invitation and notify.
        if not chat_session.members.filter(user=invitee).exists():
            if ChatInvitation.objects.filter(
                chat_session=chat_session,
                invitee=invitee,
                status=ChatInvitationStatus.PENDING,
            ).exists():
                return Response(
                    {
                        "code": "invite_pending",
                        "detail": "An invitation is already pending for this user.",
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            invitation, _ = create_or_get_invitation(
                chat_session=chat_session,
                inviter=request.user,
                invitee=invitee,
            )
            _notify_invitee(invitation)

        return Response(
            ChatSessionSerializer(
                chat_session,
                context={"request": request},
            ).data,
            status=status.HTTP_200_OK,
        )


class ChatSessionMessageView(APIView):
    """
    與聊天室訊息相關的操作：建立、查詢、更新聊天室訊息。
    1. GET chatrooms/<str:uri>/messages/ - 顯示出該聊天室中的所有訊息
    2. POST chatrooms/<str:uri>/messages/ - 在聊天室中發送新訊息
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, uri):
        chat_session = get_object_or_404(ChatSession, uri=uri)

        if not chat_session.members.filter(user=request.user).exists():
            return Response(
                {"detail": "You are not a member of this chat session."},
                status=status.HTTP_403_FORBIDDEN,
            )

        raw_limit = request.query_params.get("limit", "50")
        try:
            limit = int(raw_limit)
        except ValueError:
            return Response(
                {"detail": "limit must be an integer"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        limit = max(1, min(limit, 100))

        messages_qs = chat_session.messages.order_by("-create_date", "-id")

        before = request.query_params.get("before")
        if before:
            before_dt = parse_datetime(before)
            if before_dt is None:
                return Response(
                    {"detail": "before must be ISO datetime"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if timezone.is_naive(before_dt):
                before_dt = timezone.make_aware(
                    before_dt,
                    timezone.get_current_timezone(),
                )
            messages_qs = messages_qs.filter(create_date__lt=before_dt)

        rows = list(messages_qs[: limit + 1])
        has_more = len(rows) > limit
        rows = rows[:limit]
        rows.reverse()

        next_before = rows[0].create_date.isoformat() if has_more and rows else None
        serializer = ChatSessionMessageSerializer(rows, many=True)
        return Response(
            {
                "results": serializer.data,
                "has_more": has_more,
                "next_before": next_before,
            }
        )

    def post(self, request, uri):
        chat_session = get_object_or_404(ChatSession, uri=uri)

       
        if not chat_session.members.filter(user=request.user).exists():
            return Response(
                {"detail": "You are not a member of this chat session."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # 把前端送來的資料交給 serializer（準備驗證與存入資料庫）
        serializer = ChatSessionMessageSerializer(data=request.data)

        # 驗證資料格式是否正確（此時還沒有存資料）
        serializer.is_valid(raise_exception=True)

        # 儲存資料：實際建立一筆 ChatSessionMessage 到資料庫
        serializer.save(
            user=request.user,
            chat_session=chat_session,
        )

        return Response(serializer.data, status=status.HTTP_201_CREATED)
    

class ChatSessionMemberView(APIView):
    """
    與聊天室成員相關的操作
    1. GET chatrooms/<str:uri>/members/ - 列出聊天室中的所有成員
    2. Post chatrooms/<str:uri>/members/ - 邀請成員至聊天室
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, uri):
        chat_session = get_object_or_404(ChatSession, uri=uri)

        # 只有成員能看成員列表（可選）
        if not chat_session.members.filter(user=request.user).exists():
            return Response(status=status.HTTP_403_FORBIDDEN)

        members = chat_session.members.select_related("user")
        serializer = ChatSessionMemberSerializer(members, many=True)
        return Response(serializer.data)
    

    def post(self, request, uri):
        chat_session = get_object_or_404(ChatSession, uri=uri)

        if chat_session.owner != request.user:
            return Response(
                {"detail": "Only the owner can invite members."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if chat_session.chat_type == ChatSessionType.DIRECT:
            return Response(
                {
                    "code": "direct_chat_invite_not_allowed",
                    "detail": "Direct chat does not support inviting additional members.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        username = request.data.get("username")
        if not username:
            return Response(
                {"detail": "username is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = get_object_or_404(User, username=username)

        if chat_session.members.filter(user=user).exists():
            return Response(
                {
                    "code": "already_member",
                    "detail": "User is already a member of this chat room.",
                },
                status=status.HTTP_409_CONFLICT,
            )

        if ChatInvitation.objects.filter(
            chat_session=chat_session,
            invitee=user,
            status=ChatInvitationStatus.PENDING,
        ).exists():
            return Response(
                {
                    "code": "invite_pending",
                    "detail": "An invitation is already pending for this user.",
                },
                status=status.HTTP_409_CONFLICT,
            )

        invitation, _ = create_or_get_invitation(
            chat_session=chat_session,
            inviter=request.user,
            invitee=user,
        )
        _notify_invitee(invitation)

        return Response(
            ChatInvitationSerializer(
                invitation,
                context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )


class ChatInvitationListView(APIView):
    """
    列出目前使用者收到的邀請（pending）。
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        invitations = ChatInvitation.objects.filter(
            invitee=request.user,
            status=ChatInvitationStatus.PENDING,
        ).select_related(
            "inviter",
            "chat_session",
            "chat_session__owner",
        ).prefetch_related(
            "chat_session__members__user",
        ).order_by("-create_date")
        serializer = ChatInvitationSerializer(
            invitations,
            many=True,
            context={"request": request},
        )
        return Response(serializer.data)


class ChatInvitationRespondView(APIView):
    """
    回覆邀請：accept / reject。
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, invitation_id):
        invitation = get_object_or_404(
            ChatInvitation,
            id=invitation_id,
            invitee=request.user,
        )

        if invitation.status != ChatInvitationStatus.PENDING:
            return Response(
                {
                    "code": "invitation_not_pending",
                    "detail": "This invitation is no longer pending.",
                },
                status=status.HTTP_409_CONFLICT,
            )

        action = request.data.get("action")
        if action not in {"accept", "reject"}:
            return Response(
                {
                    "code": "invalid_action",
                    "detail": "action must be either 'accept' or 'reject'.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if action == "accept":
            _, member_created = accept_invitation(invitation)
            # 只有第一次加入聊天室時才廣播成員加入事件。
            if member_created:
                _notify_member_joined(invitation)
        else:
            reject_invitation(invitation)

        return Response(
            ChatInvitationSerializer(
                invitation,
                context={"request": request},
            ).data,
            status=status.HTTP_200_OK,
        )


def _notify_invitee(invitation: ChatInvitation) -> None:
    """
    Push real-time invitation event to invitee's notification socket.
    """
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    async_to_sync(channel_layer.group_send)(
        f"user_{invitation.invitee_id}",
        {
            "type": "invitation_created",
            "invitation_id": invitation.id,
            "chat_uri": invitation.chat_session.uri,
            "chat_type": invitation.chat_session.chat_type,
            "inviter_username": invitation.inviter.username,
        },
    )


def _notify_member_joined(invitation: ChatInvitation) -> None:
    """
    Broadcast to room members that a new member joined.
    """
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    async_to_sync(channel_layer.group_send)(
        f"chat_{invitation.chat_session.uri}",
        {
            "type": "member_joined",
            "username": invitation.invitee.username,
        },
    )


def _notify_room_renamed(chat_session: ChatSession) -> None:
    """
    Push room rename event to all room members via notification socket.
    """
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    member_user_ids = chat_session.members.values_list("user_id", flat=True)
    for user_id in member_user_ids:
        async_to_sync(channel_layer.group_send)(
            f"user_{user_id}",
            {
                "type": "room_renamed",
                "chat_uri": chat_session.uri,
                "chat_name": chat_session.name,
            },
        )
