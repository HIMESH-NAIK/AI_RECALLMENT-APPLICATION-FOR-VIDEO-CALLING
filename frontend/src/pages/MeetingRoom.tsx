import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import { getMeeting } from "../services/meetingApi";
import { postChat } from "../services/chatApi";
import { recallMemory, retainMemory, suggestMeetingMemories } from "../services/memoryApi";
import { MemoryItem, MemorySuggestion } from "../types/api";
import { useVideoMeeting } from "../hooks/useVideoMeeting";

function VideoTile({ name, stream, local = false, audioEnabled = false, videoEnabled = false }: {
  name: string;
  stream: MediaStream | null;
  local?: boolean;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => undefined);
    }
    return () => {
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [stream]);

  return (
    <article className="video-tile">
      {stream && videoEnabled
        ? <video ref={videoRef} autoPlay playsInline muted={local} aria-label={`${name} video`} />
        : <div className="video-avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase() || "?"}</div>}
      <div className="video-tile-footer"><strong>{name}{local ? " (you)" : ""}</strong><span>{audioEnabled ? "Mic on" : "Mic off"}</span></div>
    </article>
  );
}

export default function MeetingRoom() {
  const { roomId = "" } = useParams();
  const meeting = useMemo(() => getMeeting(roomId), [roomId]);
  const title = meeting?.title || "RECALLMEET video meeting";
  const [displayName, setDisplayName] = useState(() => {
    try { return localStorage.getItem("recallmeet_display_name") || ""; } catch { return ""; }
  });
  const [publishMedia, setPublishMedia] = useState(true);
  const [joined, setJoined] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "assistant" | "people" | "context">("context");
  const [chatDraft, setChatDraft] = useState("");
  const [assistantDraft, setAssistantDraft] = useState("");
  const [assistantAnswer, setAssistantAnswer] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [contextMemories, setContextMemories] = useState<MemoryItem[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextLoaded, setContextLoaded] = useState(false);
  const [meetingNotes, setMeetingNotes] = useState("");
  const [suggestions, setSuggestions] = useState<MemorySuggestion[]>([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [savingSuggestion, setSavingSuggestion] = useState<string | null>(null);
  const [savedSuggestions, setSavedSuggestions] = useState<string[]>([]);
  const [ended, setEnded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const room = useVideoMeeting(roomId);
  const localAudio = room.localStream?.getAudioTracks().some((track) => track.enabled) ?? false;
  const localVideo = room.localStream?.getVideoTracks().some((track) => track.enabled) ?? false;

  useEffect(() => {
    if (!joined || !room.participantId) return;
    const timer = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [joined, room.participantId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [room.chatMessages]);

  useEffect(() => {
    if (!joined || activeTab !== "context" || contextLoaded) return;
    let active = true;
    setContextLoading(true);
    recallMemory({
      user_id: "user_dev",
      query: ["Relevant context for this meeting:", title, meeting?.organization, meeting?.agenda].filter(Boolean).join(" "),
      limit: 5,
    })
      .then((response) => { if (active) setContextMemories(response.memories); })
      .catch(() => { if (active) setSuggestionError("Previous context is temporarily unavailable."); })
      .finally(() => { if (active) { setContextLoading(false); setContextLoaded(true); } });
    return () => { active = false; };
  }, [joined, activeTab, contextLoaded, title, meeting?.agenda, meeting?.organization]);

  const shareUrl = `${window.location.origin}/meeting/${encodeURIComponent(roomId)}`;
  const duration = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  async function enterRoom(event: FormEvent) {
    event.preventDefault();
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(roomId)) {
      setSuggestionError("This meeting link has an invalid room ID.");
      return;
    }
    try { localStorage.setItem("recallmeet_display_name", displayName.trim()); } catch { /* The room can still be joined without saving a name. */ }
    const connected = await room.join(displayName.trim() || "Guest", publishMedia);
    if (!connected) return;
    setJoined(true);
    setEnded(false);
  }

  function leaveRoom() {
    room.leave();
    setJoined(false);
    setEnded(true);
    setElapsed(0);
  }

  function sendChat(event: FormEvent) {
    event.preventDefault();
    if (chatDraft.trim()) room.sendChat(chatDraft);
    setChatDraft("");
  }

  async function askAssistant(event: FormEvent) {
    event.preventDefault();
    if (!assistantDraft.trim() || assistantLoading) return;
    setAssistantLoading(true);
    setAssistantAnswer("");
    try {
      const context = `Current page: live meeting room. Meeting: ${title}. Room ID: ${roomId}. Agenda: ${meeting?.agenda || "not provided"}. The room chat is ephemeral and is not a transcript.`;
      const response = await postChat({ user_id: "user_dev", message: `${context}\nUser request: ${assistantDraft.trim()}` });
      setAssistantAnswer(response.response);
    } catch (reason: any) {
      setAssistantAnswer(reason?.message ?? "AI is temporarily unavailable. The meeting remains active.");
    } finally {
      setAssistantLoading(false);
    }
  }

  async function generateSuggestions(event: FormEvent) {
    event.preventDefault();
    if (!meetingNotes.trim() || suggestionLoading) return;
    setSuggestionLoading(true);
    setSuggestionError(null);
    setSuggestions([]);
    try {
      const result = await suggestMeetingMemories({ meeting_title: title, notes: meetingNotes.trim() });
      if (!result.success) throw new Error(result.message || "AI memory suggestions could not be generated.");
      setSuggestions(result.suggestions);
      if (result.suggestions.length === 0) setSuggestionError("No durable facts were identified in these notes. Nothing was stored.");
    } catch (reason: any) {
      setSuggestionError(reason?.message ?? "Memory suggestions are unavailable. Your notes were not stored.");
    } finally {
      setSuggestionLoading(false);
    }
  }

  async function rememberSuggestion(suggestion: MemorySuggestion) {
    setSavingSuggestion(suggestion.content);
    setSuggestionError(null);
    try {
      const result = await retainMemory({
        user_id: "user_dev",
        content: suggestion.content,
        context: `${title} · ${suggestion.category}`,
      });
      if (!result.success) throw new Error(result.message || "Hindsight did not confirm storage.");
      setSavedSuggestions((current) => [...current, suggestion.content]);
      setSuggestions((current) => current.filter((item) => item.content !== suggestion.content));
    } catch (reason: any) {
      setSuggestionError(reason?.message ?? "Hindsight could not store this suggestion.");
    } finally {
      setSavingSuggestion(null);
    }
  }

  async function copyMeetingLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setSuggestionError("Meeting link copied. Anyone with the link can attempt to join this room.");
    } catch {
      setSuggestionError(`Share this meeting link: ${shareUrl}`);
    }
  }

  return (
    <AppLayout>
      <div className="page-wrap meeting-room-page">
        <header className="room-header">
          <div className="room-heading"><p className="eyebrow">LIVE MEETING</p><h1>{title}</h1><p>Room <code>{roomId.slice(0, 8)}</code> · {duration}</p></div>
          <div className="room-header-status"><span className={`status-dot ${room.status === "connected" ? "status-dot-ok" : room.status === "error" ? "status-dot-fail" : "status-dot-warn"}`} />{room.status === "connected" ? "Signaling connected" : room.status === "connecting" ? "Connecting" : room.status === "error" ? "Connection error" : ended ? "Meeting ended" : "Not connected"}</div>
        </header>

        {!joined && ended ? <section className="surface room-join-panel room-wrapup-panel">
          <p className="eyebrow">MEETING ENDED</p><h2>Capture what matters.</h2>
          <p className="section-copy">Speech-to-text is not configured, so no transcript was created. Enter notes you choose to share with the existing AI; it will suggest durable facts without storing them automatically.</p>
          <form className="room-notes-form" onSubmit={generateSuggestions}>
            <label htmlFor="wrapup-notes">Meeting notes</label>
            <textarea id="wrapup-notes" rows={6} value={meetingNotes} onChange={(event) => setMeetingNotes(event.target.value)} placeholder="Decisions, owners, deadlines, action items, or open issues" />
            <button className="button button-accent" type="submit" disabled={suggestionLoading || !meetingNotes.trim()}>{suggestionLoading ? "Finding useful facts…" : "Review memory suggestions"}</button>
          </form>
          {suggestionError && <p className="error-state" role="status">{suggestionError}</p>}
          {savedSuggestions.map((content) => <div className="suggestion-saved" key={content}>Stored in Hindsight: {content}</div>)}
          {suggestions.map((suggestion) => <article className="memory-suggestion" key={suggestion.content}><span className="quiet-tag">{suggestion.category}</span><p>{suggestion.content}</p><small>{suggestion.reason}</small><div><button className="button button-accent" disabled={Boolean(savingSuggestion)} onClick={() => void rememberSuggestion(suggestion)}>{savingSuggestion === suggestion.content ? "Storing…" : "Remember"}</button><button className="button button-quiet" disabled={Boolean(savingSuggestion)} onClick={() => setSuggestions((current) => current.filter((item) => item.content !== suggestion.content))}>Don't remember</button></div></article>)}
          <div className="button-row"><button className="button button-quiet" onClick={() => setEnded(false)}>Rejoin meeting</button><Link className="button" to="/meetings">Back to meetings</Link></div>
        </section> : !joined ? <section className="surface room-join-panel">
          <p className="eyebrow">JOIN MEETING</p><h2>Come on in.</h2>
          <p className="section-copy">Peer-to-peer audio/video requires browser media permissions and a secure origin (HTTPS or localhost). Meeting media is not sent to Hindsight.</p>
          <form onSubmit={enterRoom} className="room-join-form">
            <label htmlFor="room-display-name">Display name</label>
            <input id="room-display-name" value={displayName} maxLength={60} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" />
            <label className="room-media-option"><input type="checkbox" checked={publishMedia} onChange={(event) => setPublishMedia(event.target.checked)} /> Join with camera and microphone</label>
            <div className="button-row"><button className="button button-accent" type="submit">Join room <span aria-hidden="true">→</span></button><button className="button" type="button" onClick={() => void copyMeetingLink()}>Copy invite link</button><Link className="button button-quiet" to="/meetings">Back to meetings</Link></div>
          </form>
          {room.error && <p className="error-state" role="alert">{room.error}</p>}
          {suggestionError && <p className="section-copy" role="status">{suggestionError}</p>}
          <p className="room-security-note">This room uses an unguessable ID as its invite link. Account authentication and access controls are not configured; share the link only with intended participants.</p>
        </section> : <>
          <div className="room-layout">
            <main className="room-main">
              <section className="room-video-grid" aria-label="Meeting participants">
                {room.localStream && <VideoTile name={displayName || "Guest"} stream={room.localStream} local audioEnabled={localAudio} videoEnabled={cameraEnabled && localVideo} />}
                {!room.localStream && <VideoTile name={displayName || "Guest"} stream={null} local />}
                {room.participants.filter((participant) => participant.id !== room.participantId).map((participant) => (
                  <VideoTile key={participant.id} name={participant.name} stream={room.remoteStreams[participant.id] ?? null} audioEnabled={Boolean(room.remoteStreams[participant.id]?.getAudioTracks().length)} videoEnabled={Boolean(room.remoteStreams[participant.id]?.getVideoTracks().length)} />
                ))}
                {room.participants.length <= 1 && <div className="room-waiting-tile"><span className="room-pulse" /><strong>Waiting for others to join</strong><span>Share the invite link to connect another browser.</span><button className="text-button" type="button" onClick={() => void copyMeetingLink()}>Copy meeting link <span aria-hidden="true">↗</span></button></div>}
              </section>
              <div className="room-media-state">
                {room.localStream ? "Camera and microphone stream active" : "Joined without publishing camera or microphone"}
                <span>·</span>{Object.keys(room.remoteStreams).length} peer media streams
              </div>
              {room.error && <p className="error-state room-error" role="alert">{room.error}</p>}
              <nav className="room-control-bar" aria-label="Meeting controls">
                <button className={`room-control ${micEnabled ? "" : "room-control-off"}`} disabled={!room.localStream} onClick={() => { const next = !micEnabled; setMicEnabled(next); room.setTrackEnabled("audio", next); }}><span aria-hidden="true">{micEnabled ? "♩" : "♩̸"}</span>Microphone</button>
                <button className={`room-control ${cameraEnabled ? "" : "room-control-off"}`} disabled={!room.localStream} onClick={() => { const next = !cameraEnabled; setCameraEnabled(next); room.setTrackEnabled("video", next); }}><span aria-hidden="true">▣</span>Camera</button>
                <button className={`room-control ${room.isSharingScreen ? "room-control-active" : ""}`} disabled={!room.localStream} onClick={() => void room.toggleScreenShare()}><span aria-hidden="true">▱</span>Share screen</button>
                <button className={`room-control ${activeTab === "people" ? "room-control-active" : ""}`} onClick={() => setActiveTab("people")}><span aria-hidden="true">♙</span>People <small>{room.participants.length}</small></button>
                <button className={`room-control ${activeTab === "chat" ? "room-control-active" : ""}`} onClick={() => setActiveTab("chat")}><span aria-hidden="true">▤</span>Chat</button>
                <button className={`room-control ${activeTab === "assistant" ? "room-control-active" : ""}`} onClick={() => setActiveTab("assistant")}><span aria-hidden="true">✳</span>AI assistant</button>
                <button className="room-control room-leave" onClick={leaveRoom}><span aria-hidden="true">■</span>Leave</button>
              </nav>
            </main>

            <aside className="surface room-side-panel">
              <div className="room-side-tabs" role="tablist" aria-label="Meeting side panel">
                {(["context", "people", "chat", "assistant"] as const).map((tab) => <button key={tab} role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? "room-tab-active" : ""} onClick={() => setActiveTab(tab)}>{tab === "context" ? "Memory" : tab === "people" ? `People ${room.participants.length}` : tab === "assistant" ? "AI" : "Chat"}</button>)}
              </div>

              {activeTab === "people" && <section className="room-side-content"><h2>Participants</h2>{room.participants.map((participant) => <div className="room-person" key={participant.id}><span className="participant-avatar">{participant.name.charAt(0).toUpperCase()}</span><span>{participant.name}{participant.id === room.participantId ? " (you)" : ""}</span><span className="status-dot status-dot-ok" /></div>)}{!room.participants.length && <p className="empty-state">Participant list unavailable until signaling connects.</p>}</section>}

              {activeTab === "chat" && <section className="room-side-content room-chat-content"><h2>Meeting chat</h2><p className="section-copy">Live messages are ephemeral and are not stored as meeting memory.</p><div className="room-chat-messages">{room.chatMessages.map((message) => <article className="room-chat-message" key={message.id}><strong>{message.name}</strong><p>{message.text}</p><time>{new Date(message.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></article>)}</div><form className="room-inline-form" onSubmit={(event) => { event.preventDefault(); if (chatDraft.trim()) room.sendChat(chatDraft); setChatDraft(""); }}><input aria-label="Meeting chat message" value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} placeholder="Message participants" /><button className="button button-accent" type="submit" disabled={!chatDraft.trim() || room.status !== "connected"}>Send</button></form></section>}

              {activeTab === "assistant" && <section className="room-side-content"><h2>Meeting AI assistant</h2><p className="section-copy">Uses the existing chat and Hindsight flow with this meeting's title and agenda. Room chat and audio are not sent unless you enter them yourself.</p><form className="room-notes-form" onSubmit={askAssistant}><textarea rows={3} value={assistantDraft} onChange={(event) => setAssistantDraft(event.target.value)} placeholder="Ask about this meeting or recalled context" /><button className="button button-accent" type="submit" disabled={assistantLoading || !assistantDraft.trim()}>{assistantLoading ? "Thinking…" : "Ask AI"}</button></form>{assistantLoading && <p className="ai-processing"><span className="processing-bars" aria-hidden="true"><i /><i /><i /></span>Recalling memory, then generating…</p>}{assistantAnswer && <div className="room-ai-answer">{assistantAnswer}</div>}</section>}

              {activeTab === "context" && <section className="room-side-content">
                <h2>Meeting context</h2><p className="detail-copy">{meeting?.agenda || "No agenda saved for this meeting."}</p>
                {meeting?.participants && <p className="detail-copy"><strong>People:</strong> {meeting.participants}</p>}
                <div className="stt-status"><span className="status-dot status-dot-warn" /><div><strong>Speech-to-text</strong><small>Not configured. No recording or transcript is being created.</small></div></div>
                <h3>Recent Hindsight context</h3>
                {!contextLoaded && contextLoading && <p className="empty-state">Recalling relevant context…</p>}
                {contextLoaded && contextMemories.length === 0 && <p className="empty-state">No previous relevant memory found.</p>}
                <ul className="room-context-list">{contextMemories.map((memory) => <li key={memory.id ?? memory.text}><p>{memory.text}</p><small>{memory.context || "Hindsight"}</small></li>)}</ul>
                <h3>After meeting · memory suggestions</h3>
                {ended && <p className="section-copy">Add notes you want the AI to review. Nothing is stored until you select Remember.</p>}
                {!ended && <p className="section-copy">Audio is not transcribed. You can add written notes after leaving, then choose which facts to retain.</p>}
                <form className="room-notes-form" onSubmit={generateSuggestions}><textarea rows={4} value={meetingNotes} onChange={(event) => setMeetingNotes(event.target.value)} placeholder="Meeting notes or decisions (entered by you)" /><button className="button" type="submit" disabled={suggestionLoading || !meetingNotes.trim()}>{suggestionLoading ? "Finding useful facts…" : "Review memory suggestions"}</button></form>
                {suggestionError && <p className="section-copy" role="status">{suggestionError}</p>}
                {savedSuggestions.map((content) => <div className="suggestion-saved" key={content}>Stored in Hindsight: {content}</div>)}
                {suggestions.map((suggestion) => <article className="memory-suggestion" key={suggestion.content}><span className="quiet-tag">{suggestion.category}</span><p>{suggestion.content}</p><small>{suggestion.reason}</small><div><button className="button button-accent" disabled={Boolean(savingSuggestion)} onClick={() => void rememberSuggestion(suggestion)}>{savingSuggestion === suggestion.content ? "Storing…" : "Remember"}</button><button className="button button-quiet" disabled={Boolean(savingSuggestion)} onClick={() => setSuggestions((current) => current.filter((item) => item.content !== suggestion.content))}>Don't remember</button></div></article>)}
              </section>}
            </aside>
          </div>
        </>}
      </div>
    </AppLayout>
  );
}