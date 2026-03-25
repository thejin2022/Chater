import { useEffect, useRef, useState } from "react";
import type { ChatMember, ChatMessage } from "../types/chat";

/**
 * ChatRoom Props
 * -------------------------
 * ChatRoom 是「純 UI component」
 * 它不定義資料結構，只使用外部定義好的型別
 */
type Props = {
  messages: ChatMessage[];
  members: ChatMember[];
  currentUsername: string | null;
  onSendMessage: (text: string) => void;
  onInviteMember?: (username: string) => void;
  chatType?: "group" | "direct";
  canInvite?: boolean;
  roomTitle?: string;
  canRenameRoom?: boolean;
  onRenameRoom?: (name: string) => void;
  onBack?: () => void;
  onLoadOlderMessages?: () => void;
  hasMoreMessages?: boolean;
  isLoadingOlderMessages?: boolean;
  searchKeyword: string;
  onSearchKeywordChange: (keyword: string) => void;
  onSearch: () => void;
  onClearSearch: () => void;
  isSearchActive?: boolean;
};

export default function ChatRoom({
  messages,
  members,
  currentUsername,
  onSendMessage,
  onInviteMember,
  chatType,
  canInvite = false,
  roomTitle = "Chat Room",
  canRenameRoom = false,
  onRenameRoom,
  onBack,
  onLoadOlderMessages,
  hasMoreMessages = false,
  isLoadingOlderMessages = false,
  searchKeyword,
  onSearchKeywordChange,
  onSearch,
  onClearSearch,
  isSearchActive = false,
}: Props) {
  const [input, setInput] = useState("");
  const [showMembers, setShowMembers] = useState(true);
  const [inviteUsername, setInviteUsername] = useState("");
  const [showInviteInput, setShowInviteInput] = useState(false);
  const [isEditingRoomName, setIsEditingRoomName] = useState(false);
  const [roomNameInput, setRoomNameInput] = useState(roomTitle);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldRestoreScrollRef = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const prevMessageCountRef = useRef(messages.length);

  useEffect(() => {
    setRoomNameInput(roomTitle);
  }, [roomTitle]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (shouldRestoreScrollRef.current) {
      const heightDiff = container.scrollHeight - prevScrollHeightRef.current;
      container.scrollTop = heightDiff;
      shouldRestoreScrollRef.current = false;
    } else if (messages.length > prevMessageCountRef.current) {
      // 新訊息新增時，預設捲到最底部。
      container.scrollTop = container.scrollHeight;
    }

    prevMessageCountRef.current = messages.length;
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    onSendMessage(input);
    setInput("");
  };

  return (
    <div
      className="card"
      style={{
        height: "70vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ===== Header ===== */}
      <div
        className="card-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {onBack && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={onBack}
            >
              Back
            </button>
          )}

          {isEditingRoomName ? (
            <div className="d-flex gap-2 align-items-center">
              <input
                className="form-control form-control-sm"
                style={{ width: "220px" }}
                value={roomNameInput}
                onChange={(e) => setRoomNameInput(e.target.value)}
                placeholder="Chat room name"
              />
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  onRenameRoom?.(roomNameInput);
                  setIsEditingRoomName(false);
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  setRoomNameInput(roomTitle);
                  setIsEditingRoomName(false);
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span>{roomTitle}</span>
              {canRenameRoom && onRenameRoom && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => setIsEditingRoomName(true)}
                >
                  Rename
                </button>
              )}
            </div>
          )}
        </div>
        {/* 成員名單切換按鈕，讓畫面不會一直被側欄佔滿。 */}
        {chatType !== "direct" && (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setShowMembers((prev) => !prev)}
          >
            {showMembers ? "Hide Members" : `Members (${members.length})`}
          </button>
        )}
      </div>

      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #ddd",
          backgroundColor: "#fff",
          display: "flex",
          gap: "8px",
        }}
      >
        <input
          type="text"
          className="form-control form-control-sm"
          placeholder="Search keyword in this chat"
          value={searchKeyword}
          onChange={(e) => onSearchKeywordChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSearch();
            }
          }}
        />
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          onClick={onSearch}
        >
          Search
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={onClearSearch}
          disabled={!isSearchActive}
        >
          Clear
        </button>
      </div>
      {isSearchActive && (
        <div
          style={{
            padding: "4px 12px",
            fontSize: "12px",
            color: "#555",
            borderBottom: "1px solid #eee",
            backgroundColor: "#fff",
          }}
        >
          Filtering messages by keyword: "{searchKeyword.trim()}"
        </div>
      )}

      {/* ===== Message area + Members panel ===== */}
      <div
        style={{
          flex: 1,
          display: "flex",
          minHeight: 0,
        }}
      >
        <div
          ref={messagesContainerRef}
          onScroll={(e) => {
            if (!onLoadOlderMessages || !hasMoreMessages || isLoadingOlderMessages) {
              return;
            }

            const target = e.currentTarget;
            if (target.scrollTop > 24) return;

            prevScrollHeightRef.current = target.scrollHeight;
            shouldRestoreScrollRef.current = true;
            onLoadOlderMessages();
          }}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px",
            backgroundColor: "#fafafa",
          }}
        >
          {isLoadingOlderMessages && (
            <div style={{ textAlign: "center", color: "#777", marginBottom: "8px" }}>
              Loading older messages...
            </div>
          )}

          {messages.length === 0 && (
            <div
              style={{
                textAlign: "center",
                color: "#999",
                marginTop: "20px",
              }}
            >
              No messages yet
            </div>
          )}

          {messages.map((msg, index) => {
            /**
             * 正規化 username
             * - 避免大小寫 / 空白導致比較失敗
             */
            const normalizedCurrentUser =
              currentUsername?.trim().toLowerCase() ?? "";

            const normalizedMessageUser =
              msg.user.username.trim().toLowerCase();

            const isMe =
              normalizedMessageUser === normalizedCurrentUser;

            // 只有在「第一則」或「前一則不是同一個人」時才顯示名稱。
            const prevMessage = index > 0 ? messages[index - 1] : null;
            const normalizedPrevUser =
              prevMessage?.user.username.trim().toLowerCase() ?? "";
            const showUsername =
              index === 0 || normalizedPrevUser !== normalizedMessageUser;

            return (
              <div
                key={`${msg.id ?? "msg"}-${msg.createdAt ?? index}-${index}`}
                style={{
                  display: "flex",
                  justifyContent: isMe
                    ? "flex-end"
                    : "flex-start",
                  marginBottom: "8px",
                }}
              >
                <div
                  style={{
                    maxWidth: "70%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {showUsername && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#666",
                        marginBottom: "4px",
                        textAlign: isMe ? "right" : "left",
                      }}
                    >
                      {msg.user.username}
                    </div>
                  )}
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: "12px",
                      backgroundColor: isMe
                        ? "#0d6efd"
                        : "#e9ecef",
                      color: isMe ? "#fff" : "#000",
                    }}
                  >
                    {msg.message}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {chatType !== "direct" && showMembers && (
          <aside
            style={{
              width: "220px",
              borderLeft: "1px solid #ddd",
              backgroundColor: "#fff",
              padding: "12px",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                marginBottom: "10px",
              }}
            >
              Members ({members.length})
            </div>

            {chatType === "group" && canInvite && onInviteMember && (
              <div style={{ marginBottom: "12px" }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div style={{ fontSize: "12px" }}>Group invite</div>
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => {
                      setShowInviteInput((prev) => !prev);
                    }}
                  >
                    {showInviteInput ? "Cancel" : "Invite member"}
                  </button>
                </div>

                {showInviteInput && (
                  <div className="d-flex gap-2">
                    <input
                      className="form-control form-control-sm"
                      value={inviteUsername}
                      onChange={(e) => setInviteUsername(e.target.value)}
                      placeholder="username"
                    />
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        const trimmed = inviteUsername.trim();
                        if (!trimmed) return;
                        onInviteMember(trimmed);
                        setInviteUsername("");
                        setShowInviteInput(false);
                      }}
                    >
                      Send
                    </button>
                  </div>
                )}
              </div>
            )}

            {chatType === "group" && !canInvite && (
              <div style={{ marginBottom: "12px", fontSize: "12px", color: "#666" }}>
                Only the room owner can invite members.
              </div>
            )}

            {members.length === 0 && (
              <div style={{ color: "#777", fontSize: "14px" }}>
                No members found
              </div>
            )}

            {members.map((member) => (
              <div
                key={member.id}
                style={{
                  padding: "6px 0",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                {member.user.username}
              </div>
            ))}
          </aside>
        )}
      </div>

      {/* ===== Input ===== */}
      <form
        onSubmit={handleSubmit}
        style={{
          padding: "8px",
          borderTop: "1px solid #ddd",
          display: "flex",
          gap: "8px",
        }}
      >
        <input
          type="text"
          className="form-control"
          placeholder="Type a message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="btn btn-primary">
          Send
        </button>
      </form>
    </div>
  );
}
