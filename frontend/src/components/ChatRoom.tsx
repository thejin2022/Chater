import { useEffect, useRef, useState } from "react";
import type { ChatMember, ChatMessage } from "../types/chat";

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
    <div className="room-wrap">
      <div className="room-head">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          {onBack && (
            <button type="button" className="btn-outline" onClick={onBack}>
              Back
            </button>
          )}

          {isEditingRoomName ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                style={{ width: "220px" }}
                value={roomNameInput}
                onChange={(e) => setRoomNameInput(e.target.value)}
                placeholder="Chat room name"
              />
              <button
                type="button"
                className="btn-primary-solid"
                onClick={() => {
                  onRenameRoom?.(roomNameInput);
                  setIsEditingRoomName(false);
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="btn-secondary-soft"
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
              <span className="room-title">{roomTitle}</span>
              {canRenameRoom && onRenameRoom && (
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setIsEditingRoomName(true)}
                >
                  Rename
                </button>
              )}
            </div>
          )}
        </div>

        {chatType !== "direct" && (
          <button
            type="button"
            className="btn-outline"
            onClick={() => setShowMembers((prev) => !prev)}
          >
            {showMembers ? "Hide Members" : `Members (${members.length})`}
          </button>
        )}
      </div>

      <div className="room-search">
        <input
          type="text"
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
        <button type="button" className="btn-outline" onClick={onSearch}>
          Search
        </button>
        <button
          type="button"
          className="btn-outline"
          onClick={onClearSearch}
          disabled={!isSearchActive}
        >
          Clear
        </button>
      </div>

      {isSearchActive && (
        <div style={{ padding: "4px 12px", fontSize: "12px", color: "var(--muted)" }}>
          Filtering messages by keyword: "{searchKeyword.trim()}"
        </div>
      )}

      <div className="room-body">
        <div
          ref={messagesContainerRef}
          className="message-scroll"
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
        >
          {isLoadingOlderMessages && (
            <div style={{ textAlign: "center", color: "var(--muted)", marginBottom: "8px" }}>
              Loading older messages...
            </div>
          )}

          {messages.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--muted)", marginTop: "20px" }}>
              No messages yet
            </div>
          )}

          {messages.map((msg, index) => {
            const normalizedCurrentUser = currentUsername?.trim().toLowerCase() ?? "";
            const normalizedMessageUser = msg.user.username.trim().toLowerCase();
            const isMe = normalizedMessageUser === normalizedCurrentUser;
            const prevMessage = index > 0 ? messages[index - 1] : null;
            const normalizedPrevUser = prevMessage?.user.username.trim().toLowerCase() ?? "";
            const showUsername = index === 0 || normalizedPrevUser !== normalizedMessageUser;

            return (
              <div
                key={`${msg.id ?? "msg"}-${msg.create_date ?? index}-${index}`}
                className={`message-row ${isMe ? "mine" : ""}`}
              >
                <div className="message-stack">
                  {showUsername && (
                    <div className={`message-username ${isMe ? "mine" : ""}`}>
                      {msg.user.username}
                    </div>
                  )}
                  <div className={`message-bubble ${isMe ? "mine" : ""}`}>{msg.message}</div>
                </div>
              </div>
            );
          })}
        </div>

        {chatType !== "direct" && showMembers && (
          <aside className="member-panel">
            <div className="member-title">Members ({members.length})</div>

            {chatType === "group" && canInvite && onInviteMember && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>Group invite</div>
                  <button
                    className="btn-outline"
                    onClick={() => {
                      setShowInviteInput((prev) => !prev);
                    }}
                  >
                    {showInviteInput ? "Cancel" : "Invite member"}
                  </button>
                </div>
                {showInviteInput && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      value={inviteUsername}
                      onChange={(e) => setInviteUsername(e.target.value)}
                      placeholder="username"
                    />
                    <button
                      className="btn-primary-solid"
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
              <div style={{ marginBottom: "12px", fontSize: "12px", color: "var(--muted)" }}>
                Only the room owner can invite members.
              </div>
            )}

            {members.length === 0 && (
              <div style={{ color: "var(--muted)", fontSize: "14px" }}>No members found</div>
            )}

            {members.map((member) => (
              <div key={member.id} className="member-item">
                {member.user.username}
              </div>
            ))}
          </aside>
        )}
      </div>

      <form onSubmit={handleSubmit} className="room-input">
        <input
          type="text"
          placeholder="Type a message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="btn-primary-solid">Send</button>
      </form>
    </div>
  );
}
