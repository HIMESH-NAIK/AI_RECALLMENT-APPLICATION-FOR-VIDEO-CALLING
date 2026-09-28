import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AgentStatus from "../components/status/AgentStatus";
import AppLayout from "../components/layout/AppLayout";
import { useHealth } from "../hooks/useHealth";
import { listMeetings } from "../services/meetingApi";
import { recallMemory } from "../services/memoryApi";
import { MemoryItem } from "../types/api";
import { Meeting } from "../types/meeting";

function meetingDate(meeting: Meeting): string {
  if (!meeting.date) return "Date not set";
  const date = new Date(`${meeting.date}T${meeting.time || "00:00"}`);
  return Number.isNaN(date.getTime())
    ? meeting.date
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", ...(meeting.time ? { timeStyle: "short" as const } : {}) }).format(date);
}

export default function Dashboard() {
  const { health, loading: healthLoading, error: healthError, refresh } = useHealth(60000);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(true);
  const [memoryError, setMemoryError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setMeetings(listMeetings());
    let active = true;
    recallMemory({
      user_id: "user_dev",
      query: "Recent meeting context, decisions, key people and upcoming commitments",
      limit: 4,
    })
      .then((result) => {
        if (active) setMemories(result.memories);
      })
      .catch(() => {
        if (active) setMemoryError(true);
      })
      .finally(() => {
        if (active) setMemoryLoading(false);
      });
    return () => { active = false; };
  }, []);

  const dated = meetings
    .filter((meeting) => meeting.date)
    .sort((left, right) => new Date(`${left.date}T${left.time || "00:00"}`).getTime() - new Date(`${right.date}T${right.time || "00:00"}`).getTime());
  const upcoming = dated.find((meeting) => new Date(`${meeting.date}T${meeting.time || "23:59"}`).getTime() >= Date.now()) ?? meetings[0];

  return (
    <AppLayout>
      <div className="page-wrap">
        <div className="page-heading">
          <div>
            <p className="eyebrow">AI MEETING PREPARATION AGENT</p>
            <h1>Context, carried forward.</h1>
            <p>Meet RECALLMEET: your previous conversations, ready when the next one begins.</p>
          </div>
          <Link className="button button-accent" to="/ai-prep">Prepare for a meeting <span aria-hidden="true">↗</span></Link>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-main">
            <section className="surface next-meeting">
              <p className="eyebrow">NEXT MEETING</p>
              {upcoming ? <>
                <h2 className="next-meeting-title">{upcoming.title || "Untitled meeting"}</h2>
                <div className="meeting-meta-row">
                  <span><b>{meetingDate(upcoming)}</b></span>
                  {upcoming.organization && <span>Organization <b>{upcoming.organization}</b></span>}
                  {upcoming.participants && <span>With <b>{upcoming.participants}</b></span>}
                  <span>Preparation <b>{upcoming.preparedAt ? "Briefing generated" : "Not prepared"}</b></span>
                </div>
                <div className="next-meeting-actions">
                  <button className="button button-accent" onClick={() => navigate("/ai-prep", { state: { meetingId: upcoming.id } })}>Prepare me <span aria-hidden="true">→</span></button>
                  <Link className="button button-quiet" to={`/meetings/${upcoming.id}`}>Meeting details</Link>
                </div>
              </> : <>
                <h2 className="next-meeting-title">Make room for what matters.</h2>
                <p className="section-copy">No meetings added yet. Save a meeting and its context will be sent to your AI agent to remember.</p>
                <div className="next-meeting-actions"><Link className="button button-accent" to="/meetings/new">Add your first meeting <span aria-hidden="true">→</span></Link></div>
              </>}
            </section>

            <section className="surface section-block">
              <div className="section-heading"><div><p className="eyebrow">QUICK ACTIONS</p><h2>Pick up where you left off</h2></div></div>
              <div className="quick-actions">
                <Link className="quick-action" to="/ai-prep"><span aria-hidden="true">✳</span><strong>Prepare a meeting</strong></Link>
                <Link className="quick-action" to="/join"><span aria-hidden="true">↗</span><strong>Join a meeting</strong></Link>
                <Link className="quick-action" to="/meetings/new"><span aria-hidden="true">＋</span><strong>Add meeting</strong></Link>
                <Link className="quick-action" to="/ai"><span aria-hidden="true">↗</span><strong>Ask the agent</strong></Link>
                <Link className="quick-action" to="/memory"><span aria-hidden="true">◉</span><strong>Explore memory</strong></Link>
              </div>
            </section>

            <section className="surface section-block">
              <div className="section-heading">
                <div><p className="eyebrow">RECENT CONTEXT</p><h2>What the agent remembers</h2></div>
                <Link className="text-button" to="/memory">View memory <span aria-hidden="true">→</span></Link>
              </div>
              {memoryLoading && <p className="empty-state">Recalling recent meeting context…</p>}
              {memoryError && <p className="error-state">Memory could not be loaded. Check the Hindsight connection.</p>}
              {!memoryLoading && !memoryError && memories.length === 0 && <p className="empty-state">No relevant context found in the current memory bank.</p>}
              <div className="recent-context">
                {memories.map((memory, index) => (
                  <article className="recent-context-item" key={memory.id ?? `${memory.text}-${index}`}>
                    <span className="context-index">{String(index + 1).padStart(2, "0")}</span>
                    <div><p>{memory.text}</p><small>{memory.context || "Hindsight memory"}{memory.mentioned_at ? ` · ${new Date(memory.mentioned_at).toLocaleDateString()}` : ""}</small></div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className="dashboard-aside">
            <AgentStatus health={health} loading={healthLoading} error={Boolean(healthError)} onRefresh={() => void refresh()} />
            <section className="surface section-block">
              <p className="eyebrow">THE RECALL LOOP</p>
              <h2>Memory that moves with the meeting</h2>
              <div className="architecture-flow" aria-label="Meeting context flows through recall, reflection, and preparation">
                <span>MEETING CONTEXT</span><b aria-hidden="true">↓</b>
                <span>HINDSIGHT RECALL</span><b aria-hidden="true">↓</b>
                <span>AI REFLECTION</span><b aria-hidden="true">↓</b>
                <span className="architecture-output">PERSONALIZED PREP</span>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}