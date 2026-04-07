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
    "websocket": CookieMiddleware(          # Parse the WS handshake Cookie header into scope["cookies"].
        JwtAuthMiddlewareStack(              # Then parse JWT and set scope["user"].
            URLRouter(chat.routing.websocket_urlpatterns)
        )
    ),
})
