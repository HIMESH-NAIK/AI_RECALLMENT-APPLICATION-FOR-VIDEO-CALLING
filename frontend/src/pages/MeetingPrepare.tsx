import React, { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Link, useLocation, useParams } from 'react-router-dom';
import AgentStatus from '../components/status/AgentStatus';
import MemoryPanel from '../components/ai/MemoryPanel';
import PipelineStatus, { PipelineStep } from '../components/ai/PipelineStatus';
import PreparationBrief from '../components/ai/PreparationBrief';
import { useHealth } from '../hooks/useHealth';
import { postChat } from '../services/chatApi';
import { listMeetings, saveMeeting } from '../services/meetingApi';
import { ChatResponse } from '../types/api';
import { Meeting } from '../types/meeting';
import { useMemoryOperation } from '../hooks/useMemoryOperation';

export default function MeetingPrepare() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ChatResponse | null>(null);
  const memoryStorageStatus = useMemoryOperation(result);
  const resultWithStorageStatus = result ? {
    ...result,
    memory_stored: memoryStorageStatus === 'stored',
    memory_storage_status: memoryStorageStatus,
  } : null;
  const [error, setError] = useState<string | null>(null);
  const { health, loading: healthLoading, error: healthError, refresh } = useHealth(60000);
  const [pipeline, setPipeline] = useState<PipelineStep[]>([
    { label: 'User request', detail: 'Choose a meeting and ask for preparation', state: 'pending' },
    { label: 'Memory recall', detail: 'Relevant Hindsight context', state: 'pending' },
    { label: 'AI agent', detail: 'Generate preparation from recalled context', state: 'pending' },
    { label: 'Meeting context', detail: 'Combine meeting details with previous context', state: 'pending' },
    { label: 'Personalized briefing', detail: 'Return the generated preparation', state: 'pending' },
    { label: 'Memory storage', detail: 'Retain interaction in Hindsight', state: 'pending' },
  ]);

  useEffect(() => {
    const list = listMeetings();
    setMeetings(list);
    const routeState = location.state as { meetingId?: string } | null;
    const requested = routeId ?? routeState?.meetingId ?? '';
    setSelectedId(list.some((meeting) => meeting.id === requested) ? requested : list[0]?.id ?? '');
  }, [location.state, routeId]);

  const meeting = meetings.find((item) => item.id === selectedId);

  useEffect(() => {
    if (!meeting || !result || memoryStorageStatus === 'pending') return;
    const memoryStored = memoryStorageStatus === 'stored';
    if (meeting.memoryStorageStatus === memoryStorageStatus && meeting.memoryStored === memoryStored) return;
    saveMeeting({ ...meeting, memoryStored, memoryStorageStatus, memoryOperationId: undefined }, meeting.id);
    setMeetings(listMeetings());
  }, [meeting, memoryStorageStatus, result]);

  async function prepare() {
    if (!meeting) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setPipeline([
      { label: 'User request', detail: 'Request sent to the configured backend', state: 'complete' },
      { label: 'Memory recall', detail: 'Searching Hindsight for relevant meeting context', state: 'active' },
      { label: 'AI agent', detail: 'Generating the briefing', state: 'pending' },
      { label: 'Meeting context', detail: 'Current meeting details are attached', state: 'complete' },
      { label: 'Personalized briefing', detail: 'Waiting for the generated response', state: 'pending' },
      { label: 'Memory storage', detail: 'Queued after generation', state: 'pending' },
    ]);
    try {
      const prompt = [
        `Prepare me for my next ${meeting.organization || ''} meeting.`.replace(/\s+/g, ' ').trim(),
        'Use relevant facts recalled from previous conversations together with the current meeting details below.',
        'Return a concise briefing with these sections: Meeting Overview, Previous Context, Important People, Previous Decisions, Open Items, Suggested Talking Points, Questions to Ask, and Things to Remember.',
        'Only state previous decisions, open items, dates, or responsibilities when supported by the provided meeting details or recalled memories. Label suggestions as suggestions and say when no relevant previous context was recalled. Do not invent facts.',
        '',
        'CURRENT MEETING DETAILS',
        `Meeting: ${meeting.title}`,
        meeting.organization && `Organization: ${meeting.organization}`,
        meeting.date && `Date: ${meeting.date}`,
        meeting.time && `Time: ${meeting.time}`,
        meeting.participants && `Participants and responsibilities: ${meeting.participants}`,
        meeting.agenda && `Agenda: ${meeting.agenda}`,
        meeting.notes && `Previous notes provided for this meeting: ${meeting.notes}`,
      ].filter(Boolean).join('\n');
      const res = await postChat({ user_id: 'user_dev', message: prompt });
      setResult(res);
      const prepared = {
        ...meeting,
        preparedAt: new Date().toISOString(),
        memoryStored: res.memory_stored,
        memoryStorageStatus: res.memory_storage_status,
        memoryOperationId: res.memory_operation_id ?? undefined,
      };
      saveMeeting(prepared, meeting.id);
      setMeetings(listMeetings());
      setPipeline([
        { label: 'User request', detail: 'Request received by the existing chat API', state: 'complete' },
        {
          label: 'Memory recall',
          detail: res.memory_recall_success ? `Success — ${res.memories_recalled_count} relevant memories found` : 'Recall failed; AI continued without memory',
          state: res.memory_recall_success ? 'complete' : 'failed',
        },
        { label: 'AI agent', detail: res.ai_generation_success ? `Generated by ${res.llm_provider} · ${res.llm_model}` : 'Generation was not confirmed', state: res.ai_generation_success ? 'complete' : 'failed' },
        { label: 'Meeting context', detail: `${meeting.title}${meeting.organization ? ` · ${meeting.organization}` : ''}`, state: 'complete' },
        { label: 'Personalized briefing', detail: res.ai_generation_success ? 'Briefing generated' : 'No successful briefing returned', state: res.ai_generation_success ? 'complete' : 'failed' },
        { label: 'Memory storage', detail: res.memory_storage_status === 'pending' ? 'Accepted by Hindsight; extraction pending' : res.memory_stored ? 'Stored successfully' : 'Storage failed', state: res.memory_storage_status === 'pending' ? 'active' : res.memory_stored ? 'complete' : 'failed' },
      ]);
    } catch (e: any) {
      setError(e?.message ?? 'The preparation request failed.');
      setPipeline((current) => current.map((step, index) => index === 0 ? step : { ...step, detail: index === 1 ? 'The API request failed before recall status was returned' : step.detail, state: index === 1 ? 'failed' : 'pending' }));
    } finally { setLoading(false); }
  }

  return (
    <AppLayout>
      <div className="page-wrap">
        <div className="page-heading">
          <div><p className="eyebrow">MEETING PREPARATION</p><h1>Prepare for your meeting</h1><p>Bring the details in front and relevant Hindsight memories into the same briefing.</p></div>
        </div>
        <div className="prep-layout">
          <div>
            <section className="surface prep-control">
              <p className="eyebrow">SELECT A MEETING</p>
              <h2 className="prep-title">Walk in with the whole story.</h2>
              {meetings.length ? <>
                <label className="field" htmlFor="prep-meeting"><span>Meeting</span>
                  <select id="prep-meeting" className="prep-select" value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setResult(null); }}>
                    {meetings.map((item) => <option key={item.id} value={item.id}>{item.title}{item.organization ? ` · ${item.organization}` : ''}</option>)}
                  </select>
                </label>
                {meeting && <div className="meeting-meta-row" style={{ marginTop: 14 }}>
                  {meeting.date && <span><b>{meeting.date}</b></span>}
                  {meeting.participants && <span>With <b>{meeting.participants}</b></span>}
                </div>}
                <button className="button button-accent prepare-button" disabled={loading || !meeting} onClick={prepare}>
                  {loading ? <><span className="processing-bars" aria-hidden="true"><i /><i /><i /></span>Preparing with recalled context…</> : <>Prepare me <span aria-hidden="true">→</span></>}
                </button>
              </> : <>
                <p className="section-copy">Create a meeting first so RECALLMEET can combine its agenda with relevant memories.</p>
                <Link className="button button-accent" style={{ marginTop: 17 }} to="/meetings/new">Add a meeting <span aria-hidden="true">→</span></Link>
              </>}
              {error && <p className="error-state" role="alert">{error}</p>}
            </section>

            <div style={{ marginTop: 16 }}><PipelineStatus steps={pipeline.map((step) => step.label === 'Memory storage' && resultWithStorageStatus
              ? { ...step, detail: memoryStorageStatus === 'pending' ? 'Accepted by Hindsight; extraction pending' : memoryStorageStatus === 'stored' ? 'Stored successfully' : 'Storage failed', state: memoryStorageStatus === 'pending' ? 'active' : memoryStorageStatus === 'stored' ? 'complete' : 'failed' }
              : step)} label="Preparation pipeline" /></div>
            {result && <>
              <PreparationBrief result={result} />
              <section className="surface section-block" style={{ marginTop: 16 }}>
                <p className="eyebrow">MEMORY DEBUG</p><h2>Recalled Hindsight context</h2>
                <MemoryPanel userId="user_dev" memories={result.memories_recalled} recallSucceeded={result.memory_recall_success} />
                <div className="result-status-row" style={{ marginTop: 14 }}>
                  <span>Memory storage</span><strong>{memoryStorageStatus === 'pending' ? 'Queued in Hindsight' : memoryStorageStatus === 'stored' ? 'Stored successfully' : 'Failed'}</strong>
                </div>
              </section>
            </>}
            {!result && !loading && <section className="surface briefing-empty"><p className="eyebrow">YOUR BRIEFING</p><h2>What happened last time can shape what happens next.</h2><p className="section-copy">Choose a meeting to request a live briefing. Recall, generation, and storage outcomes will appear here.</p></section>}
          </div>
          <aside className="dashboard-aside">
            <AgentStatus health={health} loading={healthLoading} error={Boolean(healthError)} lastResponse={resultWithStorageStatus} onRefresh={() => void refresh()} />
            {meeting && <section className="surface section-block">
              <p className="eyebrow">CURRENT CONTEXT</p><h2>{meeting.title}</h2>
              <p className="detail-copy">{meeting.agenda || 'No agenda provided.'}</p>
              {meeting.notes && <><p className="eyebrow" style={{ marginTop: 18 }}>PREVIOUS NOTES</p><p className="detail-copy">{meeting.notes}</p></>}
              <Link className="text-button" to={`/meetings/${meeting.id}`}>Open meeting details <span aria-hidden="true">→</span></Link>
            </section>}
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
