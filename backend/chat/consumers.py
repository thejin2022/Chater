import json
import os

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model

from .models import ChatSession, ChatSessionMessage

User = get_user_model()


class ChatSessionMessageConsumer(AsyncWebsocketConsumer):
 

    async def connect(self):
        
        self.chat_uri = self.scope["url_route"]["kwargs"]["uri"]

        # JwtAuthMiddleware 已經把 scope["user"] 設好了
        self.user = self.scope["user"]

        # 新增：每個聊天室對應一個 group 名稱
        self.room_group_name = f"chat_{self.chat_uri}"

        

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4401)
            return

        is_member = await self._is_member()
        if not is_member:
            await self.close(code=4403)
            return

        # 新增：將目前 websocket 連線加入 group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        print("WS connected, user =", self.user)


    async def receive(self, text_data=None, bytes_data=None):
        print("Message handled by PID:", os.getpid())

        if not text_data:
            return

        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(json.dumps({
                "error": "Invalid JSON format"
            }))
            return

        message_text = data.get("message")
        if not message_text:
            await self.send(json.dumps({
                "error": "message is required"
                
            }))
            return

        try:
            message = await self._create_message(message_text)
        except PermissionError as e:
            await self.send(json.dumps({
                "error": str(e)
            }))
            return

      
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_message",  # 對應下面的 method 名稱
                "id": message.id,
                "username": self.user.username,
                "message": message.message,
                "create_date": message.create_date.isoformat(),
            }
        )


    # group_send 觸發後會呼叫這個 method
    async def chat_message(self, event):
        await self.send(json.dumps({
            "id": event["id"],
            "user": {
                "username": event["username"],  # 回應成前端需要的格式
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
        print("WS disconnected", close_code)

        # 離線時從 group 移除
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )


    @database_sync_to_async
    def _is_member(self):
        return ChatSession.objects.filter(
            uri=self.chat_uri,
            members__user=self.user,
        ).exists()


    # 同步 ORM 轉換成非同步
    @database_sync_to_async
    def _create_message(self, message_text):
        # 尚未登入
        if not self.user or not self.user.is_authenticated:
            raise PermissionError("Authentication required.")

        chat_session = get_object_or_404(ChatSession, uri=self.chat_uri)

        
        if not chat_session.members.filter(user=self.user).exists():
            raise PermissionError("You are not a member of this chat session.")

        return ChatSessionMessage.objects.create(
            chat_session=chat_session,
            user=self.user,
            message=message_text,
        )


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    User-level notification socket.
    Used to push invitation events in real time.
    """

    async def connect(self):
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
