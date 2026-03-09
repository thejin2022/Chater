print(">>> WS JwtAuthMiddleware module loaded <<<")
# asgi.py 會呼叫此 module的 JwtAuthMiddleware，為 WebSocket 連線驗證 JWT token，並設定 scope["user"]。
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
    供 WebSocket Channels 用的 JWT Auth Middleware

    功能：
    - 從 WebSocket 的 cookie 取出 access_token
    - 使用 SimpleJWT 驗證
    - 解析出對應的 Django User
    - 設定 scope["user"] 防止 UserLazyObject
    """

    def __init__(self, inner: Callable):
        self.inner = inner
        self.jwt_auth = JWTAuthentication()

    async def __call__(self, scope, receive, send):
        scope["user"] = AnonymousUser()
        #print(">>> JwtAuthMiddleware __call__ <<<")
        #print("WS cookies =", scope.get("cookies"))
        cookies = scope.get("cookies", {})
        access_token = cookies.get("access_token")

        if access_token:
            try:
                validated_token = self.jwt_auth.get_validated_token(access_token)
                user = await self._get_user(validated_token)
                scope["user"] = user
            except (InvalidToken, TokenError, User.DoesNotExist):
                # token 無效或 user 不存在，保持 AnonymousUser
                pass

        return await self.inner(scope, receive, send)

    @database_sync_to_async
    def _get_user(self, validated_token):
        """
        SimpleJWT validated token → Django User
        解決以下錯誤：
        TypeError: Field 'id' expected a number but got
         <channels.auth.UserLazyObject object at 0x...>
        """
        user_id = validated_token[settings.SIMPLE_JWT["USER_ID_CLAIM"]]
        return User.objects.get(pk=user_id)


# 為了使用方便，提供一個 wrapper function（和 AuthMiddlewareStack 用法一致）
def JwtAuthMiddlewareStack(inner):
    return JwtAuthMiddleware(inner)
