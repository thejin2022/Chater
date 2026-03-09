from typing import TYPE_CHECKING

from django.contrib.auth import get_user_model
from django.contrib.auth.models import AbstractBaseUser
from django.db import transaction

from .models import (
    ChatInvitation,
    ChatInvitationStatus,
    ChatSession,
    ChatSessionMember,
    ChatSessionType,
    generate_direct_pair_key,
)

User = get_user_model()

if TYPE_CHECKING:

    UserType = AbstractBaseUser


def create_group_chat_session(owner: "UserType") -> ChatSession:
    """
    Create a group chat and ensure owner membership is created atomically.
    """
    with transaction.atomic():
        chat_session = ChatSession.objects.create(
            owner=owner,
            chat_type=ChatSessionType.GROUP,
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
