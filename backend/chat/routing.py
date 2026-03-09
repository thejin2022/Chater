from django.urls import re_path
from .consumers import ChatSessionMessageConsumer, NotificationConsumer

websocket_urlpatterns = [
    re_path(
        r"ws/chat/(?P<uri>[\w-]+)/$",
        ChatSessionMessageConsumer.as_asgi(),
    ),
    re_path(
        r"ws/notifications/$",
        NotificationConsumer.as_asgi(),
    ),
]
