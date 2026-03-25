from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from .models import ChatSession, ChatSessionMember, ChatSessionMessage
from .views import ChatSessionMessageView

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
