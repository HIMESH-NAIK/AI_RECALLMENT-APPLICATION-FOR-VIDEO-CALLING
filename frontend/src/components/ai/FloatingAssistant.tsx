import React, { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { postChat } from "../../services/chatApi";
import { getMeeting } from "../../services/meetingApi";

type Turn = { role: "user" | "assistant"; text: string };

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/meetings": "Meetings",
  "/ai-prep": "AI meeting preparation",
  "/memory": "Memory",
  "/ai": "AI Agent chat",
  "/status": "Service status",
};

function currentContext(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const roomIndex = segments.indexOf("meeting");
  if (roomIndex >= 0) {
    const roomId = segments[roomIndex + 1] ?? "";
    const meeting = getMeeting(roomId);
    return meeting
      ? `Current page: live meeting room. Meeting: ${meeting.title}. Organization: ${meeting.organization || "not set"}. Agenda: ${meeting.agenda || "not set"}. Room ID: ${roomId}.`
      : `Current page: live meeting room. Room ID: ${roomId}. No transcript is available.`;
  }
  const meetingIndex = segments.indexOf("meetings");
  if (meetingIndex >= 0 && segments[meetingIndex + 1] && segments[meetingIndex + 1] !== "new") {
    const meeting = getMeeting(segments[meetingIndex + 1]);
    if (meeting) return `Current page: ${pathname.endsWith("prepare") ? "AI meeting preparation" : "meeting details"}. Meeting: ${meeting.title}. Organization: ${meeting.organization || "not set"}. Agenda: ${meeting.agenda || "not set"}.`;
  }
  return `Current page: ${PAGE_LABELS[pathname] ?? "RECALLMEET"}.`;
}

export default function FloatingAssistant() {
  const location = useLocation();
  const isMeetingRoom = location.pathname.startsWith("/meeting/");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || loading) return;
    setDraft("");
    setError(null);
    setTurns((current) => [...current, { role: "user", text: question }]);
    setLoading(true);
    try {
      const response = await postChat({
        user_id: "user_dev",
        message: `${currentContext(location.pathname)}\nUser request: ${question}`,
      });
      setTurns((current) => [...current, { role: "assistant", text: response.response }]);
    } catch (reason: any) {
      setError(reason?.message ?? "The AI assistant is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(draft);
  }

  function joinRoom(event: FormEvent) {
    event.preventDefault();
    const safeId = roomId.trim();
    if (/^[A-Za-z0-9_-]{8,80}$/.test(safeId)) navigate(`/meeting/${encodeURIComponent(safeId)}`);
    else setError("Enter a valid meeting link or room ID.");
  }

  return (
    <div className={`floating-assistant-root ${isMeetingRoom ? "floating-assistant-in-room" : ""}`}>
      {open && <section className="surface floating-assistant-panel" role="dialog" aria-label="AI Agent">
        <header className="assistant-panel-header">
          <div><p className="eyebrow">RECALLMEET AI</p><h2>AI Agent</h2><span>Context-aware help powered by your existing assistant.</span></div>
          <button className="assistant-close" aria-label="Close AI Agent" onClick={() => setOpen(false)}>×</button>
        </header>
        <div className="assistant-suggestions" aria-label="Suggested actions">
          <Link to="/meetings/new" onClick={() => setOpen(false)}>Create a meeting</Link>
          <button onClick={() => setJoinOpen((value) => !value)}>Join a meeting</button>
          <Link to="/ai-prep" onClick={() => setOpen(false)}>Prepare me for a meeting</Link>
          <button onClick={() => void ask("What do you remember about me?")}>What do you remember?</button>
          <button onClick={() => void ask("Explain this page and what I can do here.")}>Explain this page</button>
          <button onClick={() => void ask("Help me with this meeting.")}>Help with this meeting</button>
        </div>
        {joinOpen && <form className="assistant-join-form" onSubmit={joinRoom}>
          <label htmlFor="assistant-room-id">Meeting link or room ID</label>
          <div><input id="assistant-room-id" value={roomId} onChange={(event) => setRoomId(event.target.value)} placeholder="Paste a RECALLMEET link or ID" /><button className="button button-accent" type="submit">Join</button></div>
        </form>}
        <div className="assistant-turns" aria-live="polite">
          {turns.length === 0 && <p className="section-copy">Hi! I can help you navigate RECALLMEET and answer using relevant remembered context.</p>}
          {turns.map((turn, index) => <p className={`assistant-turn assistant-turn-${turn.role}`} key={`${turn.role}-${index}`}>{turn.text}</p>)}
          {loading && <p className="ai-processing"><span className="processing-bars" aria-hidden="true"><i /><i /><i /></span>Recalling memory, then preparing a response…</p>}
          {error && <p className="error-state" role="alert">{error}</p>}
        </div>
        <form className="assistant-compose" onSubmit={submit}>
          <textarea value={draft} rows={2} aria-label="Ask the AI Agent" placeholder="Ask about a meeting or remembered context…" onChange={(event) => setDraft(event.target.value)} />
          <button type="submit" className="button button-accent" disabled={loading || !draft.trim()}>Ask <span aria-hidden="true">↗</span></button>
        </form>
        <p className="assistant-retention-note">Uses the existing AI chat and memory policy.</p>
      </section>}
      <button className="floating-assistant-trigger" aria-expanded={open} aria-label={open ? "Close AI Agent" : "Open AI Agent"} onClick={() => setOpen((value) => !value)}>
        <span aria-hidden="true">✳</span> AI Agent
      </button>
    </div>
  );
}