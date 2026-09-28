import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import { deleteMeeting, getMeeting } from "../services/meetingApi";
import { Meeting } from "../types/meeting";

export default function MeetingDetails() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);

  useEffect(() => setMeeting(getMeeting(id) ?? null), [id]);

  function remove() {
    if (!window.confirm("Delete this meeting from this browser?")) return;
    deleteMeeting(id);
    navigate("/meetings");
  }

  return (
    <AppLayout>
      <div className="page-wrap">
        {!meeting ? <section className="surface section-block"><p className="eyebrow">MEETING DETAILS</p><h1>Meeting not found</h1><p className="section-copy">This record is not available in this browser.</p><Link className="button button-accent" to="/meetings">Back to meetings</Link></section> : <>
          <div className="page-heading">
            <div><p className="eyebrow">{meeting.organization || "MEETING DETAILS"}</p><h1>{meeting.title}</h1><p>{meeting.date || "Date not set"}{meeting.time ? ` · ${meeting.time}` : ""}</p></div>
            <div className="button-row">
              <Link className="button" to={`/meeting/${meeting.id}`}>Join video room</Link>
              <Link className="button button-accent" to={`/meetings/${meeting.id}/prepare`}>Prepare with AI <span aria-hidden="true">→</span></Link>
              <Link className="button button-quiet" to={`/meetings/${meeting.id}/edit`}>Edit</Link>
            </div>
          </div>
          <div className="meeting-detail-grid">
            <div className="dashboard-main">
              <section className="surface section-block">
                <p className="eyebrow">AGENDA</p><h2>What this meeting is about</h2>
                <p className="detail-copy">{meeting.agenda || "No agenda provided yet."}</p>
              </section>
              <section className="surface section-block">
                <p className="eyebrow">PREVIOUS CONTEXT</p><h2>Notes to carry forward</h2>
                <p className="detail-copy">{meeting.notes || "No previous notes provided yet."}</p>
              </section>
            </div>
            <aside className="dashboard-aside">
              <section className="surface section-block">
                <p className="eyebrow">PEOPLE</p><h2>Participants</h2>
                <p className="detail-copy">{meeting.participants || "Participants not listed."}</p>
              </section>
              <section className="surface section-block">
                <p className="eyebrow">AI MEMORY</p><h2>Context status</h2>
                <p className="detail-copy">{meeting.memoryStored === true ? "Meeting context was stored successfully in Hindsight." : meeting.memoryStored === false ? "Hindsight did not confirm storage. Edit and save to retry." : "Meeting context has not been sent to the AI agent yet."}</p>
                {meeting.preparedAt && <p className="detail-copy">Last prepared {new Date(meeting.preparedAt).toLocaleString()}.</p>}
              </section>
              <button className="button button-quiet button-danger" onClick={remove}>Delete meeting</button>
            </aside>
          </div>
        </>}
      </div>
    </AppLayout>
  );
}
