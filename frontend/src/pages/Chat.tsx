import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import StartChat from "../components/StartChat";
import ChatRoom from "../components/ChatRoom";
import { signOut } from "../services/authApi";
import "../styles/chat.css";

import {
  clearCurrentUserCache,
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

import type {
  ChatInvitation,
  ChatMember,
  ChatMessage,
  ChatRoomRelation,
} from "../types/chat";

function sortMessages(list: ChatMessage[]): ChatMessage[] {
  return [...list].sort((a, b) => {
    const t1 = new Date(a.create_date ?? "").getTime();
    const t2 = new Date(b.create_date ?? "").getTime();
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
  const { uri } = useParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [invitations, setInvitations] = useState<ChatInvitation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [searchKeywordInput, setSearchKeywordInput] = useState("");
  const [appliedSearchKeyword, setAppliedSearchKeyword] = useState("");
  const [chatRooms, setChatRooms] = useState<ChatRoomRelation[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const notificationSocketRef = useRef<WebSocket | null>(null);

  
  async function loadCurrentUser() {
    try {
      const me = await fetchCurrentUser();
      setCurrentUsername(me.username);
      setCurrentUserId(me.user_id);
    } catch {
      navigate("/auth");
    }
  }

  async function loadChatRooms() {
    try {
      const rooms = await fetchMyChatRooms();
      setChatRooms(rooms);
    } catch {
      navigate("/auth");
    }
  }

  async function loadInvitations() {
    try {
      const data = await fetchPendingInvitations();
      setInvitations(data);
    } catch {
      setInvitations([]);
    }
  }

  async function loadMessages() {
    if (!uri) return;

    try {
      const page = await fetchChatMessages(uri, {
        limit: 50,
        keyword: appliedSearchKeyword || undefined,
      });
      setMessages(sortMessages(page.results));
      setHasMoreMessages(page.has_more);
      setNextBefore(page.next_before ?? null);
    } catch {
      alert("Load messages failed");
    }
  }

  async function loadOlderMessages() {
    if (!uri || !hasMoreMessages || isLoadingOlderMessages) return;

    try {
      setIsLoadingOlderMessages(true);
      const page = await fetchChatMessages(uri, {
        before: nextBefore ?? undefined,
        limit: 50,
        keyword: appliedSearchKeyword || undefined,
      });
      setMessages((prev) => sortMessages([...page.results, ...prev]));
      setHasMoreMessages(page.has_more);
      setNextBefore(page.next_before ?? null);
    } catch {
      alert("Load older messages failed");
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }

  async function loadMembers() {
    if (!uri) return;

    try {
      const data = await fetchChatMembers(uri);
      setMembers(data);
    } catch {
      setMembers([]);
    }
  }

  async function handleStartChat() {
    try {
      const data = await createChatSession();
      navigate(`/chats/${data.uri}`);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleStartDirectChat(targetUsername: string) {
    try {
      const data = await createDirectChatSession(targetUsername);
      navigate(`/chats/${data.uri}`);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleRespondInvitation(
    invitationId: number,
    action: "accept" | "reject"
  ) {
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
  }

  function handleSendMessage(text: string) {
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
  }

  async function handleInviteMember(username: string) {
    if (!uri) return;

    try {
      await inviteChatMember(uri, username);
      alert("Invitation sent");
    } catch (err: any) {
      alert(err.message);
    }
  }

  function handleApplyKeywordSearch() {
    setAppliedSearchKeyword(searchKeywordInput.trim());
  }

  function handleClearKeywordSearch() {
    setSearchKeywordInput("");
    setAppliedSearchKeyword("");
  }

  async function handleRenameRoom(name: string) {
    if (!uri) return;

    try {
      const updatedRoom = await updateChatRoomName(uri, name);
      setChatRooms((prev) =>
        prev.map((room) => (room.uri === uri ? updatedRoom : room))
      );
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleLogout() {
    try {
      await signOut();
    } catch (err: any) {
      alert(err?.message || "Logout failed");
      return;
    }

    clearCurrentUserCache();
    setMessages([]);
    setMembers([]);
    setInvitations([]);
    setChatRooms([]);
    setCurrentUserId(null);
    setCurrentUsername(null);
    navigate("/auth", { replace: true });
  }


  useEffect(() => {
    loadCurrentUser();
  }, [navigate]);

  useEffect(() => {
    loadChatRooms();
    if (!uri) {
      loadInvitations();
    }
  }, [uri, navigate]);

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

  useEffect(() => {
    if (!uri) return;

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

      if (payload.type === "member_joined") {
        loadMembers();
        const systemNotice: ChatMessage = {
          message: `${payload.username} joined the room`,
          user: { username: "system" },
          create_date: new Date().toISOString(),
        };
        setMessages((prev) => sortMessages([...prev, systemNotice]));
        return;
      }

      const msg: ChatMessage = payload;
      if ("error" in msg) {
        return;
      }

      setMessages((prev) => sortMessages([...prev, msg]));
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




  return (
    <div className="chat-page">
      <div className="chat-shell">
        <aside className="chat-sidebar">
          <div className="sidebar-top">
            <h2 className="sidebar-title">Conversations</h2>
            <button type="button" className="btn-danger-soft" onClick={handleLogout}>
              Logout
            </button>
          </div>
          <div className="sidebar-user">
            Logged in as <strong>{currentUsername ?? "..."}</strong>
          </div>
          <button
            type="button"
            className="btn-primary-solid"
            onClick={handleStartChat}
            style={{ marginBottom: "10px" }}
          >
            + New Group Chat
          </button>
          <div className="chat-list">
            {chatRooms.map((room) => {
              const roomName = getRoomDisplayName(room);
              const isActive = room.uri === uri;
              const roomType = room.chat_type === "direct" ? "Direct" : "Group";

              return (
                <button
                  key={room.uri}
                  type="button"
                  className={`chat-list-item ${isActive ? "active" : ""}`}
                  onClick={() => navigate(`/chats/${room.uri}`)}
                >
                  <div className="chat-list-name">{roomName}</div>
                  <div className="chat-list-meta">
                    <span
                      className={`badge-pill ${
                        room.chat_type === "direct" ? "badge-direct" : "badge-group"
                      }`}
                    >
                      {roomType}
                    </span>
                  </div>
                </button>
              );
            })}
            {chatRooms.length === 0 && (
              <div className="chat-list-meta">No rooms yet. Create your first chat.</div>
            )}
          </div>
        </aside>

        <main className="chat-main">
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
              onEnterRoom={(roomUri) => navigate(`/chats/${roomUri}`)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
