import React, { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";

function parseRoomId(value: string): string | null {
  const input = value.trim();
  if (!input) return null;
  let candidate = input;
  if (/^https?:\/\//i.test(input)) {
    try {
      const path = new URL(input).pathname.split("/").filter(Boolean);
      candidate = path[0] === "meeting" ? path[1] ?? "" : "";
    } catch {
      return null;
    }
  }
  return /^[A-Za-z0-9_-]{8,80}$/.test(candidate) ? candidate : null;
}

export default function JoinMeeting() {
  const navigate = useNavigate();
  const [invite, setInvite] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const roomId = parseRoomId(invite);
    if (!roomId) {
      setError("Enter a valid RECALLMEET room link or room ID.");
      return;
    }
    navigate(`/meeting/${encodeURIComponent(roomId)}`);
  }

  return (
    <AppLayout>
      <div className="page-wrap">
        <div className="page-heading">
          <div><p className="eyebrow">LIVE MEETINGS</p><h1>Join a meeting</h1><p>Paste an invite link or enter the room ID shared by the host.</p></div>
        </div>
        <form className="surface join-meeting-panel" onSubmit={submit}>
          <label htmlFor="meeting-invite">Meeting link or room ID</label>
          <input id="meeting-invite" autoComplete="url" value={invite} onChange={(event) => { setInvite(event.target.value); setError(null); }} placeholder="https://recallmeet.example/meeting/…" />
          {error && <p className="error-state" role="alert">{error}</p>}
          <div className="button-row"><button className="button button-accent" type="submit">Continue to room <span aria-hidden="true">→</span></button><Link className="button button-quiet" to="/meetings">Back to meetings</Link></div>
          <p className="room-security-note">Room IDs act as invite links. Account authentication and access controls are not configured; only share links with intended participants.</p>
        </form>
      </div>
    </AppLayout>
  );
}