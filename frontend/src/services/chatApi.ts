import { authorizedRequest } from "./httpClient";
import type {
  ChatInvitation,
  ChatMember,
  ChatMessage,
  ChatRoomRelation,
} from "../types/chat";

/**
 * =========================
 * Chat rooms (list)
 * =========================
 * 取得「目前使用者有關聯的聊天室」
 */
export async function fetchMyChatRooms(): Promise<ChatRoomRelation[]> {
  const res = await authorizedRequest(
    "/chat/chatrooms/" 
  );

  if (!res.ok) {
    throw new Error("Failed to load chat rooms");
  }

  return res.json();
}

/**
 * =========================
 * Auth
 * =========================
 * 取得目前登入的使用者
 */
export async function fetchCurrentUser() {
  const response = await authorizedRequest(
    "/auth/me/" 
  );

  if (!response.ok) {
    throw new Error("Unauthenticated");
  }

  return response.json();
}

/**
 * =========================
 * Chat session
 * =========================
 * 建立聊天室（回傳 uri）
 */
export async function createChatSession() {
  const response = await authorizedRequest(
    "/chat/chatrooms/", 
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to create chat session");
  }

  return response.json(); // { uri }
}

/**
 * 建立/取得 1:1 聊天室（依 username）
 */
export async function createDirectChatSession(username: string) {
  const response = await authorizedRequest(
    "/chat/chatrooms/direct/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username }),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail || "Failed to create direct chat");
  }

  return response.json(); // { uri, chat_type, ... }
}

/**
 * =========================
 * Messages
 * =========================
 * 載入聊天室歷史訊息
 */
export async function fetchChatMessages(
  uri: string
): Promise<ChatMessage[]> {
  const response = await authorizedRequest(
    `/chat/chatrooms/${uri}/messages/` // ✅
  );

  if (!response.ok) {
    throw new Error("Failed to load messages");
  }

  return response.json();
}

/**
 * =========================
 * Members
 * =========================
 * 載入聊天室成員清單
 */
export async function fetchChatMembers(
  uri: string
): Promise<ChatMember[]> {
  const response = await authorizedRequest(
    `/chat/chatrooms/${uri}/members/`
  );

  if (!response.ok) {
    throw new Error("Failed to load members");
  }

  return response.json();
}

export async function inviteChatMember(
  uri: string,
  username: string
) {
  const response = await authorizedRequest(
    `/chat/chatrooms/${uri}/members/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username }),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail || "Failed to send invitation");
  }

  return response.json();
}

export async function fetchPendingInvitations(): Promise<ChatInvitation[]> {
  const response = await authorizedRequest("/chat/invitations/");

  if (!response.ok) {
    throw new Error("Failed to load invitations");
  }

  return response.json();
}

export async function respondInvitation(
  invitationId: number,
  action: "accept" | "reject"
): Promise<ChatInvitation> {
  const response = await authorizedRequest(
    `/chat/invitations/${invitationId}/respond/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action }),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail || "Failed to respond invitation");
  }

  return response.json();
}

export async function updateChatRoomName(
  uri: string,
  name: string
): Promise<ChatRoomRelation> {
  const response = await authorizedRequest(
    `/chat/chatrooms/${uri}/`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail || "Failed to update room name");
  }

  return response.json();
}
