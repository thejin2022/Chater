"""
ASGI config for chater project.
"""

import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "chater.settings")

import django
django.setup()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.sessions import CookieMiddleware
from django.core.asgi import get_asgi_application

import chat.routing
from chat.middleware import JwtAuthMiddlewareStack

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": CookieMiddleware(          # 把 WS 握手請求的 Cookie header 解析成 scope["cookies"]
        JwtAuthMiddlewareStack(              # 再解析 JWT，設定 scope["user"]
            URLRouter(chat.routing.websocket_urlpatterns)
        )
    ),
})
