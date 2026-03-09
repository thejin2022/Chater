from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import (
    ChatSession,
    ChatSessionMember,
    ChatSessionMessage,
    ChatInvitation,
)

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """
    Public user representation.
    """

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
        )


class ChatSessionSerializer(serializers.ModelSerializer):
    """
    Serializer for chat sessions.
    """

    owner = UserSerializer(read_only=True)

    class Meta:
        model = ChatSession
        fields = (
            "id",
            "uri",
            "name",
            "chat_type",
            "owner",
            "create_date",
        )


class ChatSessionMemberSerializer(serializers.ModelSerializer):
    """
    Serializer for chat session members.
    """

    user = UserSerializer(read_only=True)

    class Meta:
        model = ChatSessionMember
        fields = (
            "id",
            "user",
            "create_date",
        )


class ChatSessionMessageSerializer(serializers.ModelSerializer):
    """
    Serializer for chat messages.
    """

    user = UserSerializer(read_only=True)

    class Meta:
        model = ChatSessionMessage
        fields = (
            "id",
            "user",
            "message",
            "create_date",
        )


class ChatInvitationSerializer(serializers.ModelSerializer):
    inviter = UserSerializer(read_only=True)
    chat_session = ChatSessionSerializer(read_only=True)

    class Meta:
        model = ChatInvitation
        fields = (
            "id",
            "chat_session",
            "inviter",
            "status",
            "create_date",
        )
