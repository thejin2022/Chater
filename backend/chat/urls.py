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
 
    path("chatrooms/", ChatSessionView.as_view(), name="chat-session-create"),

    path("chatrooms/direct/", DirectChatSessionView.as_view(), name="chat-session-direct"),

    # Invitation list / invitation response
    path("invitations/", ChatInvitationListView.as_view(), name="chat-invitations"),
    path(
        "invitations/<int:invitation_id>/respond/",
        ChatInvitationRespondView.as_view(),
        name="chat-invitation-respond",
    ),

    # Update chat room (PATCH)
    path("chatrooms/<str:uri>/", ChatSessionDetailView.as_view(), name="chat-session-detail"),

    # Retrieve / send chat room messages (GET / POST)
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
