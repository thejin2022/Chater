/**
 * ChatMessage
 * -------------------------
 * 這是「聊天室訊息」的唯一型別定義來源。
 *
 * 原則：
 * - 不要在 component / page / api 各自定義 Message
 * - 所有用到聊天室訊息的地方，一律 import 這個型別
 *
 * 好處：
 * - 型別不會衝突（解掉你現在看到的紅字）
 * - 後端欄位有變，只要改這一個檔案
 */
export type ChatMessage = {
  id?: number;
  message: string;
  user: {
    username: string;
  };
  // 統一後前端使用的時間欄位（可能由 created_at / create_date 轉來）
  createdAt?: string;
  // 後端目前可能回傳的原始時間欄位（保留以便相容）
  created_at?: string;
  create_date?: string;
};

/**
 * ChatMember
 * -------------------------
 * 聊天室成員資料型別（對應 /chatrooms/{uri}/members/）
 */
export type ChatMember = {
  id: number;
  user: {
    id: number;
    username: string;
    email?: string;
    first_name?: string;
    last_name?: string;
  };
  create_date?: string;
};

export type ChatRoomRelation = {
  id: number;
  uri: string;
  name?: string | null;
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
