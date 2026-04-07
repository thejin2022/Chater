from typing import TYPE_CHECKING

from django.contrib.auth.models import AbstractBaseUser
from django.db import transaction

from .models import (
    ChatInvitation,
    ChatInvitationStatus,
    ChatSession,
    ChatSessionMember,
    ChatSessionMessage,
    ChatSessionType,
    generate_direct_pair_key,
)

if TYPE_CHECKING:
    UserType = AbstractBaseUser


class ChatSessionAccessError(PermissionError):
    pass



def get_chat_session_for_member(uri: str, user: "UserType") -> ChatSession:
    chat_session = ChatSession.objects.select_related("owner").prefetch_related(
        "members__user"
    ).filter(uri=uri).first()

    if chat_session is None:
        raise ChatSession.DoesNotExist

    if not chat_session.members.filter(user=user).exists():
        raise ChatSessionAccessError("You are not a member of this chat session.")

    return chat_session



def create_group_chat_session(owner: "UserType", name: str) -> ChatSession:
    """
    Create a group chat and ensure owner membership is created atomically.
    """
    with transaction.atomic():
        chat_session = ChatSession.objects.create(
            owner=owner,
            chat_type=ChatSessionType.GROUP,
            name=name,
        )
        ChatSessionMember.objects.get_or_create(
            chat_session=chat_session,
            user=owner,
        )
    return chat_session


def create_or_get_direct_chat_session(
    initiator: "UserType",
    invitee: "UserType",
) -> tuple[ChatSession, bool]:
    """
    Create or get a direct chat session between two users.
    Returns (chat_session, created).
    """
    pair_key = generate_direct_pair_key(initiator.id, invitee.id)

    with transaction.atomic():
        chat_session, created = ChatSession.objects.get_or_create(
            direct_pair_key=pair_key,
            defaults={
                "owner": initiator,
                "chat_type": ChatSessionType.DIRECT,
                "name": None,
            },
        )
        ChatSessionMember.objects.get_or_create(
            chat_session=chat_session,
            user=initiator,
        )

    return chat_session, created


def create_or_get_invitation(
    chat_session: ChatSession,
    inviter: "UserType",
    invitee: "UserType",
) -> tuple[ChatInvitation, bool]:
    """
    Create invitation if not exists. If an existing accepted invitation exists,
    the inviter will get that row back with created=False.
    """
    invitation, created = ChatInvitation.objects.get_or_create(
        chat_session=chat_session,
        inviter=inviter,
        invitee=invitee,
        defaults={"status": ChatInvitationStatus.PENDING},
    )

    # Re-open a previously rejected invitation.
    if not created and invitation.status == ChatInvitationStatus.REJECTED:
        invitation.status = ChatInvitationStatus.PENDING
        invitation.save(update_fields=["status", "update_date"])

    return invitation, created



def create_chat_message(
    chat_session: ChatSession,
    user: "UserType",
    message_text: str,
) -> ChatSessionMessage:
    return ChatSessionMessage.objects.create(
        chat_session=chat_session,
        user=user,
        message=message_text,
    )


def accept_invitation(
    invitation: ChatInvitation,
) -> tuple[ChatSessionMember, bool]:
    with transaction.atomic():
        invitation.status = ChatInvitationStatus.ACCEPTED
        invitation.save(update_fields=["status", "update_date"])
        member, created = ChatSessionMember.objects.get_or_create(
            chat_session=invitation.chat_session,
            user=invitation.invitee,
        )
    return member, created


def reject_invitation(invitation: ChatInvitation) -> None:
    invitation.status = ChatInvitationStatus.REJECTED
    invitation.save(update_fields=["status", "update_date"])
