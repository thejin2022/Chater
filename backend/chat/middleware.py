# asgi.py calls JwtAuthMiddleware from this module to validate JWT for
# WebSocket connections and set scope["user"].
from typing import Callable

from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from django.conf import settings

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from channels.db import database_sync_to_async


User = get_user_model()


class JwtAuthMiddleware:
    """
    JWT auth middleware for Django Channels WebSocket connections.

    Responsibilities:
    - Read access_token from the WebSocket cookies
    - Validate it with SimpleJWT
    - Resolve the corresponding Django user
    - Set scope["user"] to avoid UserLazyObject issues
    """

    def __init__(self, inner: Callable):
        self.inner = inner
        self.jwt_auth = JWTAuthentication()

    async def __call__(self, scope, receive, send):
        scope["user"] = AnonymousUser()
        cookies = scope.get("cookies", {})
        access_token = cookies.get(settings.SIMPLE_JWT["AUTH_COOKIE"])

        if access_token:
            try:
                validated_token = self.jwt_auth.get_validated_token(access_token)
                user = await self._get_user(validated_token)
                scope["user"] = user
            except (InvalidToken, TokenError, User.DoesNotExist):
                # If the token is invalid or the user does not exist, keep AnonymousUser.
                pass

        return await self.inner(scope, receive, send)

    @database_sync_to_async
    def _get_user(self, validated_token):
        """
        Convert a validated SimpleJWT token into a Django user.
        This avoids the following error:
        TypeError: Field 'id' expected a number but got
         <channels.auth.UserLazyObject object at 0x...>
        """
        user_id = validated_token[settings.SIMPLE_JWT["USER_ID_CLAIM"]]
        return User.objects.get(pk=user_id)


# Provide a wrapper function for convenience, similar to AuthMiddlewareStack.
def JwtAuthMiddlewareStack(inner):
    return JwtAuthMiddleware(inner)
