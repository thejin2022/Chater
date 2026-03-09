import { useState } from "react";
import type { ChatInvitation, ChatRoomRelation } from "../types/chat";

type Props = {
  username: string | null;
  onStart: () => void;
  onStartDirect?: (targetUsername: string) => void;

  // 可選：已有聊天室時才會用到
  chatRooms?: ChatRoomRelation[];
  onEnterRoom?: (uri: string) => void;
  invitations?: ChatInvitation[];
  onRespondInvitation?: (
    invitationId: number,
    action: "accept" | "reject"
  ) => void;
};

export default function StartChat({
  username,
  onStart,
  onStartDirect,
  chatRooms = [],
  onEnterRoom,
  invitations = [],
  onRespondInvitation,
}: Props) {
  const hasChatRooms = chatRooms.length > 0;
  const [targetUsername, setTargetUsername] = useState("");
  const getRoomLabel = (room: ChatRoomRelation) =>
    room.name?.trim() ? room.name : room.uri;

  return (
    <div className="card p-4 text-center">
      <h3>Welcome {username || "!"}</h3>

      <p className="mt-3">
        To start chatting with friends click on the button below, it'll
        start a new chat session and then you can invite your friends
        over to chat!
      </p>

      {/* 原本的行為：建立新聊天室 */}
      <button
        onClick={onStart}
        className="btn btn-primary btn-lg mt-3"
      >
        Start Chatting
      </button>

      {/* 1:1 聊天入口：輸入對方 username 後建立/取得 direct room */}
      {onStartDirect && (
        <div className="mt-4 text-start">
          <label className="form-label">
            Start 1:1 Chat by Username
          </label>
          <div className="d-flex gap-2">
            <input
              className="form-control"
              placeholder="target username"
              value={targetUsername}
              onChange={(e) => setTargetUsername(e.target.value)}
            />
            <button
              className="btn btn-outline-primary"
              onClick={() => {
                const trimmed = targetUsername.trim();
                if (!trimmed) return;
                onStartDirect(trimmed);
                setTargetUsername("");
              }}
            >
              Start 1:1
            </button>
          </div>
        </div>
      )}

      {/* ⭐ 有聊天室資料時，才顯示下方區塊 */}
      {hasChatRooms && onEnterRoom && (
        <div className="mt-4">
          <hr />

          <h5 className="mb-3">
            Your chat rooms
          </h5>

          <div className="d-flex flex-column gap-2">
            {chatRooms.map((room) => (
              <button
                key={room.uri}
                className="btn btn-outline-secondary"
                onClick={() =>
                  onEnterRoom(room.uri)
                }
              >
                Enter {room.chat_type === "direct" ? "DM" : "chat"} {getRoomLabel(room)}
              </button>
            ))}
          </div>
        </div>
      )}

      {invitations.length > 0 && onRespondInvitation && (
        <div className="mt-4 text-start">
          <hr />
          <h5 className="mb-3">Pending invitations</h5>
          <div className="d-flex flex-column gap-2">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="border rounded p-2 d-flex justify-content-between align-items-center"
              >
                <div>
                  <div>
                    <strong>{invitation.inviter.username}</strong> invited you
                  </div>
                  <div className="text-muted" style={{ fontSize: "12px" }}>
                    room: {getRoomLabel(invitation.chat_session)}
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => onRespondInvitation(invitation.id, "accept")}
                  >
                    Accept
                  </button>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => onRespondInvitation(invitation.id, "reject")}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
