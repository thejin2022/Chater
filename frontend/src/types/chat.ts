/*
 * Chat-related frontend types.
 * Keep message shape centralized here so API changes only need one update point.
 */
export type ChatMessage = {
  id?: number;
  message: string;
  user: {
    username: string;
  };
  create_date?: string;
};

export type ChatMessagePage = {
  results: ChatMessage[];
  has_more: boolean;
  next_before?: string | null;
};

export type ChatMember = {
  id: number;
  user: {
    id: number;
    username: string;
  };
  create_date?: string;
};

export type ChatRoomRelation = {
  id: number;
  uri: string;
  name?: string | null;
  display_name?: string;
  chat_type?: "group" | "direct";
  owner?: {
    id: number;
    username: string;
  };
  create_date?: string;
};

export type ChatInvitation = {
  id: number;
  status: "pending" | "accepted" | "rejected";
  inviter: {
    id: number;
    username: string;
  };
  chat_session: ChatRoomRelation;
  create_date?: string;
};
