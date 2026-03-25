import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

/* UI components */
import StartChat from "../components/StartChat";
import ChatRoom from "../components/ChatRoom";
import { signOut } from "../services/authApi";

/* API */
import {
  fetchCurrentUser,
  createChatSession,
  createDirectChatSession,
  fetchChatMessages,
  fetchChatMembers,
  fetchMyChatRooms,
  fetchPendingInvitations,
  inviteChatMember,
  respondInvitation,
  updateChatRoomName,
} from "../services/chatApi";

/* 訊息格式 */
import type {
  ChatInvitation,
  ChatMember,
  ChatMessage,
  ChatRoomRelation,
} from "../types/chat";

// 將 REST / WS 的時間欄位統一成 createdAt，方便排序與 UI 分組判斷。
function normalizeMessage(raw: ChatMessage): ChatMessage {
  return {
    ...raw,
    createdAt:
      raw.createdAt ??
      raw.created_at ??
      raw.create_date ??
      new Date().toISOString(),
  };
}

// 依時間排序，若時間相同再用 id 做次排序，避免訊息插隊時顯示不穩定。
function sortMessages(list: ChatMessage[]): ChatMessage[] {
  return [...list].sort((a, b) => {
    const t1 = new Date(a.createdAt ?? "").getTime();
    const t2 = new Date(b.createdAt ?? "").getTime();
    if (t1 !== t2) return t1 - t2;
    return (a.id ?? 0) - (b.id ?? 0);
  });
}

function getRoomDisplayName(room?: ChatRoomRelation): string {
  if (!room) return "Chat Room";
  if (room.display_name?.trim()) return room.display_name;
  return room.name?.trim() ? room.name : room.uri;
}

export default function Chat() {
  const navigate = useNavigate();
  const { uri } = useParams(); // /chats/:uri

  /* =========================
     State
     ========================= */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [invitations, setInvitations] = useState<ChatInvitation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUsername, setCurrentUsername] =
    useState<string | null>(null);
  const [searchKeywordInput, setSearchKeywordInput] = useState("");
  const [appliedSearchKeyword, setAppliedSearchKeyword] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const notificationSocketRef = useRef<WebSocket | null>(null);


  // ⭐ 新增：聊天室列表
  const [chatRooms, setChatRooms] = useState<ChatRoomRelation[]>([]);

  /* =========================
     ① 驗證目前登入使用者
     ========================= */
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const me = await fetchCurrentUser();
        setCurrentUsername(me.username);
        setCurrentUserId(me.user_id);
        sessionStorage.setItem("username", me.username);
      } catch {
        navigate("/auth");
      }
    };

    loadCurrentUser();
  }, [navigate]);

  /* =========================
     ② 建立聊天室
     ========================= */
  const handleStartChat = async () => {
    try {
      const data = await createChatSession();
      navigate(`/chats/${data.uri}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStartDirectChat = async (targetUsername: string) => {
    try {
      const data = await createDirectChatSession(targetUsername);
      navigate(`/chats/${data.uri}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRespondInvitation = async (
    invitationId: number,
    action: "accept" | "reject"
  ) => {
    try {
      const data = await respondInvitation(invitationId, action);
      await loadInvitations();
      await loadChatRooms();

      if (action === "accept") {
        navigate(`/chats/${data.chat_session.uri}`);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const loadChatRooms = async () => {
    try {
      const rooms = await fetchMyChatRooms();
      setChatRooms(rooms);
    } catch {
      navigate("/auth");
    }
  };

  const loadInvitations = async () => {
    try {
      const data = await fetchPendingInvitations();
      setInvitations(data);
    } catch {
      setInvitations([]);
    }
  };

  /* =========================
     ③ 載入聊天室列表（只有 /chats）
     ========================= */
  useEffect(() => {
    loadChatRooms();
    // 邀請列表主要在 /chats 首頁顯示；房內不需要每次都載入。
    if (!uri) {
      loadInvitations();
    }
  }, [uri, navigate]);

  /* =========================
     ④ 載入聊天室訊息
     ========================= */
  const loadMessages = async () => {
    if (!uri) return;

    try {
      const page = await fetchChatMessages(uri, {
        limit: 50,
        keyword: appliedSearchKeyword || undefined,
      });
      const normalized = page.results.map(normalizeMessage);
      setMessages(sortMessages(normalized));
      setHasMoreMessages(page.has_more);
      setNextBefore(page.next_before ?? null);
    } catch {
      alert("Load messages failed");
    }
  };

  const loadOlderMessages = async () => {
    if (!uri || !hasMoreMessages || isLoadingOlderMessages) return;

    try {
      setIsLoadingOlderMessages(true);
      const page = await fetchChatMessages(uri, {
        before: nextBefore ?? undefined,
        limit: 50,
        keyword: appliedSearchKeyword || undefined,
      });
      const normalized = page.results.map(normalizeMessage);
      setMessages((prev) => sortMessages([...normalized, ...prev]));
      setHasMoreMessages(page.has_more);
      setNextBefore(page.next_before ?? null);
    } catch {
      alert("Load older messages failed");
    } finally {
      setIsLoadingOlderMessages(false);
    }
  };

  const loadMembers = async () => {
    if (!uri) return;

    try {
      const data = await fetchChatMembers(uri);
      setMembers(data);
    } catch {
      // 成員清單不是核心阻塞流程，失敗時保留空列表即可。
      setMembers([]);
    }
  };

  useEffect(() => {
    if (!uri) return;
    loadMessages();
  }, [uri, appliedSearchKeyword]);

  useEffect(() => {
    if (!uri) {
      setMembers([]);
      return;
    }

    loadMembers();
  }, [uri]);
/* =========================
   ④-1 WebSocket 連線（送 / 收訊息）
   ========================= */
useEffect(() => {
  if (!uri) return;

  // ⭐ 關鍵：一定要走「同 origin」，讓 Vite proxy 接手
  const protocol =
    window.location.protocol === "https:" ? "wss" : "ws";

  const socket = new WebSocket(
    `${protocol}://${window.location.host}/ws/chat/${uri}/`
  );

  socketRef.current = socket;

  socket.onopen = () => {
    console.log("WebSocket connected");
  };

  socket.onmessage = (event) => {
    const payload = JSON.parse(event.data);

    // 房間收到新成員加入事件：刷新成員列表，並顯示系統通知訊息。
    if (payload.type === "member_joined") {
      loadMembers();
      const systemNotice: ChatMessage = normalizeMessage({
        message: `${payload.username} joined the room`,
        user: { username: "system" },
      });
      setMessages((prev) => sortMessages([...prev, systemNotice]));
      return;
    }

    const msg: ChatMessage = payload;
    // 後端回 error payload 時不放進訊息列表。
    if ("error" in msg) {
      return;
    }

    const normalized = normalizeMessage(msg);
    setMessages((prev) => sortMessages([...prev, normalized]));
  };

  socket.onerror = (err) => {
    console.error("WebSocket error", err);
  };

  socket.onclose = (event) => {
    console.log("WebSocket closed", {
      code: event.code,
      reason: event.reason,
    });
  };

  return () => {
    socket.close();
    socketRef.current = null;
  };
}, [uri]);

  /* =========================
     ④-2 通知 WebSocket（邀請即時通知）
     ========================= */
  useEffect(() => {
    const protocol =
      window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(
      `${protocol}://${window.location.host}/ws/notifications/`
    );

    notificationSocketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "invitation_created") {
          loadInvitations();
          if (!uri) {
            loadChatRooms();
          }
          return;
        }

        if (data.type === "room_renamed") {
          const incomingUri: string | undefined = data.chat_uri;
          if (!incomingUri) return;

          setChatRooms((prev) =>
            prev.map((room) =>
              room.uri === incomingUri
                ? {
                    ...room,
                    name: data.chat_name ?? null,
                  }
                : room
            )
          );
        }
      } catch {
        // ignore malformed payload
      }
    };

    return () => {
      socket.close();
      notificationSocketRef.current = null;
    };
  }, [uri]);

  /* =========================
     ⑤ 傳送訊息
     ========================= */
const handleSendMessage = (text: string) => {
  if (!text.trim()) return;

  try {
    socketRef.current?.send(
      JSON.stringify({
        message: text,
      })
    );
  } catch {
    alert("Send message failed");
  }
};

  const handleInviteMember = async (username: string) => {
    if (!uri) return;

    try {
      await inviteChatMember(uri, username);
      alert("Invitation sent");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApplyKeywordSearch = () => {
    setAppliedSearchKeyword(searchKeywordInput.trim());
  };

  const handleClearKeywordSearch = () => {
    setSearchKeywordInput("");
    setAppliedSearchKeyword("");
  };

  useEffect(() => {
    setSearchKeywordInput("");
    setAppliedSearchKeyword("");
  }, [uri]);

  const activeRoom = uri
    ? chatRooms.find((room) => room.uri === uri)
    : undefined;
  const activeRoomTitle = activeRoom
    ? getRoomDisplayName(activeRoom)
    : uri ?? "Chat Room";

  const handleRenameRoom = async (name: string) => {
    if (!uri) return;

    try {
      const updatedRoom = await updateChatRoomName(uri, name);
      setChatRooms((prev) =>
        prev.map((room) => (room.uri === uri ? updatedRoom : room))
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err: any) {
      alert(err?.message || "Logout failed");
      return;
    }

    sessionStorage.removeItem("username");
    setMessages([]);
    setMembers([]);
    setInvitations([]);
    setChatRooms([]);
    setCurrentUserId(null);
    setCurrentUsername(null);
    navigate("/auth", { replace: true });
  };

  /* =========================
     ⑥ UI
     ========================= */
  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0c0707ff",
      }}
    >
      <div style={{ width: "100%", maxWidth: "900px", padding: "16px" }}>
        <div className="d-flex justify-content-end mb-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
        {uri ? (
          <ChatRoom
            messages={messages}
            members={members}
            currentUsername={currentUsername}
            onSendMessage={handleSendMessage}
            onInviteMember={handleInviteMember}
            chatType={activeRoom?.chat_type}
            canInvite={activeRoom?.owner?.id === currentUserId}
            roomTitle={activeRoomTitle}
            canRenameRoom={
              activeRoom?.chat_type === "group" &&
              activeRoom?.owner?.id === currentUserId
            }
            onRenameRoom={handleRenameRoom}
            onBack={() => navigate("/chats")}
            onLoadOlderMessages={loadOlderMessages}
            hasMoreMessages={hasMoreMessages}
            isLoadingOlderMessages={isLoadingOlderMessages}
            searchKeyword={searchKeywordInput}
            onSearchKeywordChange={setSearchKeywordInput}
            onSearch={handleApplyKeywordSearch}
            onClearSearch={handleClearKeywordSearch}
            isSearchActive={Boolean(appliedSearchKeyword)}
          />
        ) : (
          <StartChat
            username={currentUsername}
            onStart={handleStartChat}
            onStartDirect={handleStartDirectChat}
            chatRooms={chatRooms}
            invitations={invitations}
            onRespondInvitation={handleRespondInvitation}
            onEnterRoom={(uri) =>
              navigate(`/chats/${uri}`)
            }
          />
        )}
      </div>
    </div>
  );
}
