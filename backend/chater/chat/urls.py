from django.urls import path
from .views import (
    ChatInvitationListView,
    ChatInvitationRespondView,
    ChatSessionDetailView,
    ChatSessionView,
    ChatSessionMessageView,
    ChatSessionMemberView,
    DirectChatSessionView,
)

urlpatterns = [
    # 建立聊天室（POST）
    path("chatrooms/", ChatSessionView.as_view(), name="chat-session-create"),

    # 建立/取得 1:1 聊天室（POST）
    path("chatrooms/direct/", DirectChatSessionView.as_view(), name="chat-session-direct"),

    # 邀請列表 / 回覆邀請
    path("invitations/", ChatInvitationListView.as_view(), name="chat-invitations"),
    path(
        "invitations/<int:invitation_id>/respond/",
        ChatInvitationRespondView.as_view(),
        name="chat-invitation-respond",
    ),

    # 加入聊天室（PATCH）
    path("chatrooms/<str:uri>/", ChatSessionDetailView.as_view(), name="chat-session-detail"),

    # 取得 / 發送聊天室訊息（GET / POST）
    path(
        "chatrooms/<str:uri>/messages/",
        ChatSessionMessageView.as_view(),
        name="chat-session-messages",
    ),
    path(
    "chatrooms/<str:uri>/members/",
    ChatSessionMemberView.as_view(),
    name="chat-session-members",
    ),
]
