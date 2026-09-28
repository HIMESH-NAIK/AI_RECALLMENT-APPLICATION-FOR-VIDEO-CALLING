import React, { FormEvent, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { postChat } from '../services/chatApi';
import { getMeeting, meetingMemoryMessage, meetingPersistenceNote, saveMeeting } from '../services/meetingApi';
import { Meeting, MeetingInput } from '../types/meeting';

const emptyMeeting: MeetingInput = {
  title: '', date: '', time: '', participants: '', organization: '', agenda: '', notes: '',
};

export default function MeetingForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const [meeting, setMeeting] = useState<MeetingInput>(emptyMeeting);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) {
      setMeeting(emptyMeeting);
      setMissing(false);
      return;
    }
    const existing = id ? getMeeting(id) : undefined;
    if (!existing) {
      setMissing(true);
      return;
    }
    const { id: _id, createdAt: _createdAt, ...fields } = existing;
    setMeeting(fields);
    setMissing(false);
  }, [id, isNew]);

  function update<K extends keyof MeetingInput>(key: K, value: MeetingInput[K]) {
    setMeeting((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!meeting.title.trim()) {
      setError('Add a meeting title before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    let saved: Meeting;
    try {
      saved = saveMeeting({ ...meeting, title: meeting.title.trim() }, isNew ? undefined : id);
    } catch {
      setError('This meeting could not be saved in this browser. Check available storage and try again.');
      setSaving(false);
      return;
    }

    try {
      const response = await postChat({ user_id: 'user_dev', message: meetingMemoryMessage(saved) });
      saveMeeting({ ...saved, memoryStored: response.memory_stored }, saved.id);
      if (!response.memory_stored) {
        setError('Meeting saved in this browser, but Hindsight did not confirm storage. You can retry by saving again.');
        setSaving(false);
        return;
      }
      navigate('/meetings');
    } catch (reason: any) {
      saveMeeting({ ...saved, memoryStored: false }, saved.id);
      setError(reason?.message ? `Meeting saved in this browser, but AI memory could not be updated: ${reason.message}` : 'Meeting saved in this browser, but AI memory could not be updated.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <div className="page-wrap">
        <div className="page-heading">
          <div><p className="eyebrow">MEETING CONTEXT</p><h1>{isNew ? 'Add a meeting' : 'Edit meeting'}</h1><p>Share the details that will help your AI agent prepare you later.</p></div>
        </div>
        {missing ? <section className="surface section-block"><h2>Meeting not found</h2><p className="section-copy">This meeting may have been removed from this browser.</p><div className="button-row" style={{ marginTop: 16 }}><button className="button" onClick={() => navigate('/meetings')}>Back to meetings</button></div></section> :
          <div className="meeting-form-layout">
            <form className="surface form-panel" onSubmit={submit}>
              <div className="form-grid">
                <div className="field field-wide"><label htmlFor="meeting-title">Meeting title *</label><input id="meeting-title" required maxLength={140} value={meeting.title} onChange={(event) => update('title', event.target.value)} placeholder="Quarterly product review" /></div>
                <div className="field"><label htmlFor="meeting-org">Organization</label><input id="meeting-org" value={meeting.organization} onChange={(event) => update('organization', event.target.value)} placeholder="Team or company" /></div>
                <div className="field"><label htmlFor="meeting-people">Participants and responsibilities</label><input id="meeting-people" value={meeting.participants} onChange={(event) => update('participants', event.target.value)} placeholder="Name (responsibility), name (role)" /></div>
                <div className="field"><label htmlFor="meeting-date">Date</label><input id="meeting-date" type="date" value={meeting.date} onChange={(event) => update('date', event.target.value)} /></div>
                <div className="field"><label htmlFor="meeting-time">Time</label><input id="meeting-time" type="time" value={meeting.time} onChange={(event) => update('time', event.target.value)} /></div>
                <div className="field field-wide"><label htmlFor="meeting-agenda">Agenda</label><textarea id="meeting-agenda" value={meeting.agenda} onChange={(event) => update('agenda', event.target.value)} placeholder="Topics to cover, desired outcomes, and anything already agreed" /></div>
                <div className="field field-wide"><label htmlFor="meeting-notes">Previous notes and context</label><textarea id="meeting-notes" value={meeting.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Decisions, commitments, open questions, or context from earlier conversations" /></div>
              </div>
              {error && <p className="error-state" role="alert">{error}</p>}
              <div className="button-row">
                <button className="button button-accent" disabled={saving} type="submit">{saving ? 'Saving context…' : 'Save & remember context'}<span aria-hidden="true">→</span></button>
                <button className="button button-quiet" disabled={saving} onClick={() => navigate('/meetings')} type="button">Cancel</button>
              </div>
              {saving && <div className="ai-processing" aria-live="polite"><span className="processing-bars" aria-hidden="true"><i /><i /><i /></span>Sending meeting context to AI and Hindsight…</div>}
            </form>
            <aside className="surface form-side-note">
              <p className="eyebrow">HOW IT'S SAVED</p>
              <h2>Your context, remembered</h2>
              <p>{meetingPersistenceNote}</p>
              <p>Saving sends these details through the existing AI chat endpoint, which recalls relevant Hindsight context, acknowledges the meeting, and retains the conversation. No separate LLM or memory store is used.</p>
              <p>Hindsight can take a little time to process new facts. The confirmation below reflects the backend response.</p>
            </aside>
          </div>}
      </div>
    </AppLayout>
  );
}
