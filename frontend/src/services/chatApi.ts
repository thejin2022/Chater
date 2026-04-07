import { authorizedRequest } from "./httpClient";
import type {
  ChatInvitation,
  ChatMember,
  ChatMessagePage,
  ChatRoomRelation,
} from "../types/chat";

type CurrentUser = {
  user_id: number;
  username: string;
};

let currentUserCache: CurrentUser | null = null;
let currentUserRequest: Promise<CurrentUser> | null = null;

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
export function clearCurrentUserCache() {
  currentUserCache = null;
  currentUserRequest = null;
}

export async function fetchCurrentUser(
  options: { force?: boolean } = {}
): Promise<CurrentUser> {
  if (options.force) {
    clearCurrentUserCache();
  }

  if (currentUserCache) {
    return currentUserCache;
  }

  if (currentUserRequest) {
    return currentUserRequest;
  }

  currentUserRequest = (async () => {
    const response = await authorizedRequest("/auth/me/");

    if (!response.ok) {
      clearCurrentUserCache();
      throw new Error("Unauthenticated");
    }

    const me = (await response.json()) as CurrentUser;
    currentUserCache = me;
    return me;
  })();

  try {
    return await currentUserRequest;
  } finally {
    currentUserRequest = null;
  }
}


export async function createChatSession(name: string) {
  const response = await authorizedRequest(
    "/chat/chatrooms/", 
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to create chat session");
  }

  return response.json(); // { uri }
}


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




export async function fetchChatMessages(
  uri: string,
  params?: { before?: string; limit?: number; keyword?: string }
): Promise<ChatMessagePage> {
  const query = new URLSearchParams();
  if (params?.before) {
    query.set("before", params.before);
  }
  if (params?.limit) {
    query.set("limit", String(params.limit));
  }
  if (params?.keyword?.trim()) {
    query.set("keyword", params.keyword.trim());
  }
  const queryString = query.toString();

  const response = await authorizedRequest(
    `/chat/chatrooms/${uri}/messages/${queryString ? `?${queryString}` : ""}`
  );

  if (!response.ok) {
    throw new Error("Failed to load messages");
  }

  return response.json();
}



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
