import React, { useEffect, useState } from "react";
import AppLayout from "../components/layout/AppLayout";
import { Link, useNavigate } from "react-router-dom";
import { deleteMeeting, listMeetings, meetingPersistenceNote } from "../services/meetingApi";
import { Meeting } from "../types/meeting";

function dateLabel(meeting: Meeting): string {
  if (!meeting.date) return "Date not set";
  const date = new Date(`${meeting.date}T${meeting.time || "00:00"}`);
  return Number.isNaN(date.getTime()) ? meeting.date : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export default function Meetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [shareNotice, setShareNotice] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setMeetings(listMeetings());
  }, []);

  function remove(id: string) {
    if (!window.confirm("Delete this meeting from this browser?")) return;
    deleteMeeting(id);
    setMeetings(listMeetings());
  }

  function createInstantRoom() {
    navigate(`/meeting/${crypto.randomUUID()}`);
  }

  async function copyRoomLink(roomId: string) {
    const url = `${window.location.origin}/meeting/${encodeURIComponent(roomId)}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareNotice("Meeting invite link copied.");
    } catch {
      setShareNotice(`Copy this meeting link: ${url}`);
    }
  }

  return (
    <AppLayout>
      <div className="page-wrap">
        <div className="page-heading">
          <div><p className="eyebrow">YOUR CONVERSATIONS</p><h1>Meetings</h1><p>Keep the details together. Your AI agent remembers the context you share.</p></div>
          <div className="button-row"><Link className="button" to="/join">Join meeting</Link><button className="button" onClick={createInstantRoom}>Start video meeting <span aria-hidden="true">↗</span></button><Link className="button button-accent" to="/meetings/new">Add meeting <span aria-hidden="true">＋</span></Link></div>
        </div>

        <p className="meeting-notice">{meetingPersistenceNote}</p>
        {shareNotice && <p className="meeting-notice" role="status">{shareNotice}</p>}
        <div className="meetings-toolbar">
          <div className="quiet-tag">{meetings.length} {meetings.length === 1 ? "meeting" : "meetings"}</div>
          {meetings.length > 0 && <Link className="text-button" to="/ai-prep">Prepare with AI <span aria-hidden="true">→</span></Link>}
        </div>

        {meetings.length === 0 ? <section className="surface section-block">
          <p className="eyebrow">START WITH CONTEXT</p>
          <h2>No meetings yet</h2>
          <p className="section-copy">Add a meeting, share its agenda and notes, and send that context to the existing AI and Hindsight memory flow.</p>
          <div className="button-row" style={{ marginTop: 18 }}><Link className="button button-accent" to="/meetings/new">Create a meeting</Link></div>
        </section> : <>
          <div className="meeting-list" role="list" aria-label="Meetings">
            {meetings.map((meeting) => (
              <article className="meeting-row" key={meeting.id} role="listitem">
                <div>
                  <Link to={`/meetings/${meeting.id}`} className="meeting-name">{meeting.title || "Untitled meeting"}</Link>
                  <span className="meeting-sub">{meeting.organization || "Organization not set"}</span>
                </div>
                <div><span className="meeting-sub">DATE</span><span className="meeting-status">{dateLabel(meeting)}{meeting.time ? ` · ${meeting.time}` : ""}</span></div>
                <div><span className="meeting-sub">PARTICIPANTS</span><span className="meeting-status">{meeting.participants || "Not set"}</span></div>
                <div className="button-row">
                  <Link className="button button-accent" to={`/meetings/${meeting.id}/prepare`}>Prepare</Link>
                  <Link className="button" to={`/meeting/${meeting.id}`}>Join room</Link>
                  <button className="button button-quiet" onClick={() => void copyRoomLink(meeting.id)} aria-label={`Copy invite link for ${meeting.title}`}>Share link</button>
                  <Link className="button button-quiet" to={`/meetings/${meeting.id}/edit`} aria-label={`Edit ${meeting.title}`}>Edit</Link>
                  <button className="button button-quiet button-danger" onClick={() => remove(meeting.id)} aria-label={`Delete ${meeting.title}`}>Delete</button>
                </div>
                <div className="meeting-sub" aria-live="polite">
                  {meeting.memoryStored === true ? "Meeting context stored in Hindsight" : meeting.memoryStored === false ? "Hindsight storage not confirmed" : "Context not yet sent to the AI agent"}
                  {meeting.preparedAt && ` · Prepared ${new Date(meeting.preparedAt).toLocaleDateString()}`}
                </div>
              </article>
            ))}
          </div>
        </>}
      </div>
    </AppLayout>
  );
}
