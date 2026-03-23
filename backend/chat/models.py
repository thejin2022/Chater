"""
Models for the chat app.
"""

from uuid import uuid4

from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


def generate_unique_uri():
    """
    Generates a short unique identifier for a chat session.
    """
    return str(uuid4()).replace("-", "")[:15]


def generate_direct_pair_key(user_a_id: int, user_b_id: int) -> str:
    """
    Make a stable key for 1:1 rooms so A-B and B-A map to the same value.
    """
    low, high = sorted([user_a_id, user_b_id])
    return f"{low}:{high}"

class TrackableDateModel(models.Model):
    """
    Abstract model to track creation / update timestamps.
    """

    create_date = models.DateTimeField(auto_now_add=True)
    update_date = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True



class ChatSessionType(models.TextChoices):
    GROUP = "group", "Group"
    DIRECT = "direct", "Direct"


class ChatSession(TrackableDateModel):
    """
    A chat session (chat room / conversation).
    """

    owner = models.ForeignKey( 
        User,
        on_delete=models.PROTECT,
        related_name="owned_chat_sessions",
    )
    uri = models.CharField(
        max_length=32,
        default=generate_unique_uri,
        unique=True,
    )
    name = models.CharField(
        max_length=100,
        null=True,
        blank=True,
    )
    chat_type = models.CharField(
        max_length=10,
        choices=ChatSessionType.choices,
        default=ChatSessionType.GROUP,
    )
    # Only used by direct chat sessions. Null for group chats.
    direct_pair_key = models.CharField(
        max_length=128,
        unique=True,
        null=True,
        blank=True,
    )

    def __str__(self):
        return f"ChatSession({self.uri})"


class ChatSessionMember(TrackableDateModel):
    """
    Store chatroom membership information, including both group and direct chat sessions.
    """

    chat_session = models.ForeignKey(
        ChatSession,
        related_name="members", 
        on_delete=models.PROTECT,
    )
    user = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="chat_memberships",
    )

    class Meta:
        unique_together = ("chat_session", "user") # prevent duplicate memberships

    def __str__(self):
        return f"{self.user_id} in {self.chat_session_id}"


class ChatSessionMessage(TrackableDateModel):
    """
    Store messages sent in a chat session.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="chat_messages",
    )
    chat_session = models.ForeignKey(
        ChatSession,
        related_name="messages",
        on_delete=models.PROTECT,
    )
    message = models.TextField(max_length=2000)

    class Meta:
        indexes = [
            models.Index(
                fields=["chat_session", "create_date"],
                name="idx_msg_room_created_at",
            ),
        ]

    def __str__(self):
        return f"Message({self.user_id} → {self.chat_session_id})"


class ChatInvitationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACCEPTED = "accepted", "Accepted"
    REJECTED = "rejected", "Rejected"


class ChatInvitation(TrackableDateModel):
    """
    Invitation workflow for both group and direct chat sessions.
    Invitee joins the room only after accepting.
    """

    chat_session = models.ForeignKey(
        ChatSession,
        related_name="invitations",
        on_delete=models.PROTECT,
    )
    inviter = models.ForeignKey(
        User,
        related_name="sent_chat_invitations",
        on_delete=models.PROTECT,
    )
    invitee = models.ForeignKey(
        User,
        related_name="received_chat_invitations",
        on_delete=models.PROTECT,
    )
    status = models.CharField(
        max_length=16,
        choices=ChatInvitationStatus.choices,
        default=ChatInvitationStatus.PENDING,
    )

    class Meta:
        # Prevent same inviter from creating duplicate invitation rows for same room+invitee.
        unique_together = ("chat_session", "inviter", "invitee")

    def __str__(self):
        return f"Invitation({self.chat_session_id}: {self.inviter_id}->{self.invitee_id}, {self.status})"
