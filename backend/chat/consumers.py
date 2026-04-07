import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model

from .models import ChatSession
from .services import (
    ChatSessionAccessError,
    create_chat_message,
    get_chat_session_for_member,
)

User = get_user_model()


class ChatSessionMessageConsumer(AsyncWebsocketConsumer):
 

    async def connect(self):
        print(
            "chat socket scope:",
            {
                "keys": list(self.scope.keys()),
                "path": self.scope.get("path"),
                "url_kwargs": self.scope.get("url_route", {}).get("kwargs", {}),
                "user": getattr(self.scope.get("user"), "username", None),
            },
            flush=True,
        )

        self.chat_uri = self.scope["url_route"]["kwargs"]["uri"]

        # JwtAuthMiddleware already populated scope["user"].
        self.user = self.scope["user"]

        # Each chat room maps to one channel layer group.
        self.room_group_name = f"chat_{self.chat_uri}"

        

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4401)
            return

        is_member = await self._is_member()
        if not is_member:
            await self.close(code=4403)
            return

        # Add the current websocket connection to the room group.
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()


    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return

        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(json.dumps({
                "error": "Invalid JSON format"
            }))
            return

        event_type = data.get("type")
        if event_type != "send_message":
            await self.send(json.dumps({
                "type": "error",
                "error": "Unsupported event type"
            }))
            return

        message_text = data.get("message")
        if not message_text:
            await self.send(json.dumps({
                "type": "error",
                "error": "message is required"
            }))
            return

        try:
            message = await self._create_message(message_text)
        except PermissionError as e:
            await self.send(json.dumps({
                "type": "error",
                "error": str(e)
            }))
            return

      
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_message",  # Matches the handler method name below.
                "id": message.id,
                "username": self.user.username,
                "message": message.message,
                "create_date": message.create_date.isoformat(),
            }
        )


    # This method is called after group_send dispatches the event.
    async def chat_message(self, event):
        await self.send(json.dumps({
            "type": "chat_message",
            "id": event["id"],
            "user": {
                "username": event["username"],  # Match the response shape expected by the frontend.
            },
            "message": event["message"],
            "create_date": event["create_date"],
        }))

    async def member_joined(self, event):
        await self.send(json.dumps({
            "type": "member_joined",
            "username": event["username"],
        }))


    async def disconnect(self, close_code):
        # Remove the socket from the group on disconnect.
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )


    @database_sync_to_async
    def _is_member(self):
        try:
            get_chat_session_for_member(uri=self.chat_uri, user=self.user)
        except (ChatSession.DoesNotExist, ChatSessionAccessError):
            return False
        return True


    # Wrap synchronous ORM work for async usage.
    @database_sync_to_async
    def _create_message(self, message_text):
        # Not authenticated.
        if not self.user or not self.user.is_authenticated:
            raise PermissionError("Authentication required.")

        try:
            chat_session = get_chat_session_for_member(uri=self.chat_uri, user=self.user)
        except ChatSession.DoesNotExist as exc:
            raise PermissionError("Chat session not found.") from exc
        except ChatSessionAccessError as exc:
            raise PermissionError(str(exc)) from exc

        return create_chat_message(
            chat_session=chat_session,
            user=self.user,
            message_text=message_text,
        )


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    User-level notification socket.
    Used to push invitation events in real time.
    """

    async def connect(self):
        print(
            "notification socket scope:",
            {
                "keys": list(self.scope.keys()),
                "path": self.scope.get("path"),
                "user": getattr(self.scope.get("user"), "username", None),
            },
            flush=True,
        )

        self.user = self.scope["user"]
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4401)
            return

        self.user_group_name = f"user_{self.user.id}"
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name,
        )
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "user_group_name"):
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name,
            )

    async def invitation_created(self, event):
        await self.send(json.dumps({
            "type": "invitation_created",
            "invitation_id": event["invitation_id"],
            "chat_uri": event["chat_uri"],
            "chat_type": event["chat_type"],
            "inviter_username": event["inviter_username"],
        }))

    async def room_renamed(self, event):
        await self.send(json.dumps({
            "type": "room_renamed",
            "chat_uri": event["chat_uri"],
            "chat_name": event["chat_name"],
        }))
