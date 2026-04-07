import pytest
from rest_framework.test import APIRequestFactory

from .auth import CookieJWTAuthentication


@pytest.mark.django_db
def test_cookie_jwt_authentication_reads_configured_cookie_name(settings, monkeypatch):
    settings.SIMPLE_JWT["AUTH_COOKIE"] = "custom_access_cookie"

    factory = APIRequestFactory()
    request = factory.get("/api/auth/me/")
    request.COOKIES["custom_access_cookie"] = "token-from-cookie"

    auth = CookieJWTAuthentication()
    fake_user = object()

    monkeypatch.setattr(
        auth,
        "get_validated_token",
        lambda raw_token: {"raw": raw_token},
    )
    monkeypatch.setattr(
        auth,
        "get_user",
        lambda validated_token: fake_user,
    )

    user, validated_token = auth.authenticate(request)

    assert user is fake_user
    assert validated_token == {"raw": "token-from-cookie"}
