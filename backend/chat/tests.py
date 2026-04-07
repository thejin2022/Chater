from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from .models import (
    ChatInvitation,
    ChatInvitationStatus,
    ChatSession,
    ChatSessionMember,
    ChatSessionMessage,
    ChatSessionType,
)
from .services import create_chat_message, create_or_get_direct_chat_session
from .views import ChatSessionMessageView, ChatSessionView, DirectChatSessionView

User = get_user_model()


def _build_member_and_session():
    user = User.objects.create_user(username="alice", password="password123")
    chat_session = ChatSession.objects.create(owner=user)
    ChatSessionMember.objects.create(chat_session=chat_session, user=user)
    return user, chat_session


def _create_message(chat_session, user, message_text, at_dt):
    msg = ChatSessionMessage.objects.create(
        chat_session=chat_session,
        user=user,
        message=message_text,
    )
    ChatSessionMessage.objects.filter(pk=msg.pk).update(create_date=at_dt)
    msg.refresh_from_db()
    return msg


def _get_messages_via_api(user, uri, keyword):
    request = APIRequestFactory().get(
        f"/api/chat/chatrooms/{uri}/messages/",
        {"keyword": keyword},
    )
    force_authenticate(request, user=user)
    response = ChatSessionMessageView.as_view()(request, uri=uri)
    return response


@pytest.mark.django_db
def test_search_messages_partial_match_in_same_session():
    user, chat_session = _build_member_and_session()
    now = timezone.now()

    _create_message(chat_session, user, "Hello Django world", now - timedelta(minutes=3))
    _create_message(chat_session, user, "No hit here", now - timedelta(minutes=2))
    _create_message(chat_session, user, "Django REST is great", now - timedelta(minutes=1))
    other_session = ChatSession.objects.create(owner=user)
    ChatSessionMember.objects.create(chat_session=other_session, user=user)
    _create_message(other_session, user, "Django in other room", now)

    response = _get_messages_via_api(user, chat_session.uri, "Djan")

    assert response.status_code == 200
    result_messages = [item["message"] for item in response.data["results"]]
    assert result_messages == ["Hello Django world", "Django REST is great"]


@pytest.mark.django_db
def test_search_messages_empty_result_when_session_has_no_messages():
    user, chat_session = _build_member_and_session()

    response = _get_messages_via_api(user, chat_session.uri, "anything")

    assert response.status_code == 200
    assert response.data["results"] == []


@pytest.mark.django_db
def test_search_messages_keyword_not_exists_returns_empty():
    user, chat_session = _build_member_and_session()
    now = timezone.now()

    _create_message(chat_session, user, "hello world", now - timedelta(minutes=2))
    _create_message(chat_session, user, "django framework", now - timedelta(minutes=1))

    response = _get_messages_via_api(user, chat_session.uri, "typescript")

    assert response.status_code == 200
    assert response.data["results"] == []


@pytest.mark.django_db
def test_search_messages_are_sorted_by_create_date_ascending():
    user, chat_session = _build_member_and_session()
    now = timezone.now()

    _create_message(chat_session, user, "keyword third", now - timedelta(minutes=1))
    _create_message(chat_session, user, "keyword first", now - timedelta(minutes=3))
    _create_message(chat_session, user, "keyword second", now - timedelta(minutes=2))

    response = _get_messages_via_api(user, chat_session.uri, "keyword")

    assert response.status_code == 200
    result_messages = [item["message"] for item in response.data["results"]]
    assert result_messages == ["keyword first", "keyword second", "keyword third"]


@pytest.mark.django_db
def test_get_messages_requires_membership():
    owner = User.objects.create_user(username="owner", password="password123")
    outsider = User.objects.create_user(username="outsider", password="password123")
    chat_session = ChatSession.objects.create(owner=owner)
    ChatSessionMember.objects.create(chat_session=chat_session, user=owner)

    request = APIRequestFactory().get(f"/api/chat/chatrooms/{chat_session.uri}/messages/")
    force_authenticate(request, user=outsider)
    response = ChatSessionMessageView.as_view()(request, uri=chat_session.uri)

    assert response.status_code == 403
    assert response.data["detail"] == "You are not a member of this chat session."


@pytest.mark.django_db
def test_create_chat_message_service_persists_message():
    user, chat_session = _build_member_and_session()

    message = create_chat_message(
        chat_session=chat_session,
        user=user,
        message_text="hello from service",
    )

    assert message.chat_session == chat_session
    assert message.user == user
    assert message.message == "hello from service"


@pytest.mark.django_db
def test_direct_chat_post_auto_accepts_reverse_pending_invitation():
    alice = User.objects.create_user(username="alice", password="password123")
    bob = User.objects.create_user(username="bob", password="password123")

    chat_session, _ = create_or_get_direct_chat_session(
        initiator=alice,
        invitee=bob,
    )
    invitation = ChatInvitation.objects.create(
        chat_session=chat_session,
        inviter=alice,
        invitee=bob,
        status=ChatInvitationStatus.PENDING,
    )

    request = APIRequestFactory().post(
        "/api/chat/chatrooms/direct/",
        {"username": "alice"},
        format="json",
    )
    force_authenticate(request, user=bob)
    response = DirectChatSessionView.as_view()(request)

    invitation.refresh_from_db()

    assert response.status_code == 200
    assert response.data["uri"] == chat_session.uri
    assert invitation.status == ChatInvitationStatus.ACCEPTED
    assert chat_session.members.filter(user=bob).exists()


@pytest.mark.django_db
def test_group_chat_creation_requires_name():
    user = User.objects.create_user(username="creator", password="password123")
    request = APIRequestFactory().post("/api/chat/chatrooms/", {}, format="json")
    force_authenticate(request, user=user)

    response = ChatSessionView.as_view()(request)

    assert response.status_code == 400
    assert response.data["detail"] == "name is required"


@pytest.mark.django_db
def test_group_chat_creation_uses_trimmed_name():
    user = User.objects.create_user(username="creator2", password="password123")
    request = APIRequestFactory().post(
        "/api/chat/chatrooms/",
        {"name": "  Product Team  "},
        format="json",
    )
    force_authenticate(request, user=user)

    response = ChatSessionView.as_view()(request)

    assert response.status_code == 201
    assert response.data["name"] == "Product Team"
    assert response.data["chat_type"] == ChatSessionType.GROUP
