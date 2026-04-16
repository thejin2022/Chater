import { useState } from "react";
import type { ChatInvitation, ChatRoomRelation } from "../types/chat";

type Props = {
  username: string | null;
  onStart: () => void;
  onStartDirect?: (targetUsername: string) => void;
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
  const [targetUsername, setTargetUsername] = useState("");

  return (
    <div className="chat-placeholder">
      <h2 style={{ margin: 0 }}>Hello {username || "there"}</h2>
      <p style={{ margin: 0 }}>Pick a room from the left, or start a new conversation.</p>

      <div className="chat-cta-row">
        <button onClick={onStart} className="btn-primary-solid">
          Create Group Room
        </button>
      </div>

      {onStartDirect && (
        <div className="direct-box" style={{ width: "min(520px, 100%)", textAlign: "left" }}>
          <div style={{ fontSize: "13px", marginBottom: "8px", color: "var(--muted)" }}>
            Start direct chat by username
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              placeholder="target username"
              value={targetUsername}
              onChange={(e) => setTargetUsername(e.target.value)}
            />
            <button
              className="btn-primary-solid"
              onClick={() => {
                const trimmed = targetUsername.trim();
                if (!trimmed) return;
                onStartDirect(trimmed);
                setTargetUsername("");
              }}
            >
              Start
            </button>
          </div>
        </div>
      )}

      {invitations.length > 0 && onRespondInvitation && (
        <div className="invite-box" style={{ width: "min(520px, 100%)", textAlign: "left" }}>
          <div style={{ fontWeight: 700, marginBottom: "8px" }}>Pending invitations</div>
          {invitations.map((invitation) => (
            <div key={invitation.id} className="invite-item">
              <div>
                <strong>{invitation.inviter.username}</strong> invited you
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                Room: {invitation.chat_session.display_name || invitation.chat_session.name || invitation.chat_session.uri}
              </div>
              <div className="invite-actions">
                <button
                  className="btn-primary-solid"
                  onClick={() => onRespondInvitation(invitation.id, "accept")}
                >
                  Accept
                </button>
                <button
                  className="btn-secondary-soft"
                  onClick={() => onRespondInvitation(invitation.id, "reject")}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {chatRooms.length > 0 && onEnterRoom && (
        <div style={{ fontSize: "12px", color: "var(--muted)" }}>
          You have {chatRooms.length} room(s). Open one from the left sidebar.
        </div>
      )}
    </div>
  );
}
