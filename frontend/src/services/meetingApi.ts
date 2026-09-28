import { Meeting, MeetingInput } from "../types/meeting";

const STORAGE_KEY = "mp_meetings_v1";

export const meetingPersistenceNote =
  "Meeting records are stored in this browser. The backend does not currently provide a meetings API; meeting context is separately sent to the AI and Hindsight.";

export function listMeetings(): Meeting[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const meetings = raw ? JSON.parse(raw) : [];
    return Array.isArray(meetings) ? meetings : [];
  } catch {
    return [];
  }
}

export function getMeeting(id: string): Meeting | undefined {
  return listMeetings().find((meeting) => meeting.id === id);
}

export function saveMeeting(input: MeetingInput, id?: string): Meeting {
  const meetings = listMeetings();
  const existing = id ? meetings.find((meeting) => meeting.id === id) : undefined;
  const meeting: Meeting = {
    ...input,
    id: existing?.id ?? id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  const next = [meeting, ...meetings.filter((item) => item.id !== meeting.id)];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return meeting;
}

export function deleteMeeting(id: string): void {
  const next = listMeetings().filter((meeting) => meeting.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function meetingMemoryMessage(meeting: Meeting): string {
  return [
    "Meeting information shared by the user:",
    `Meeting: ${meeting.title}`,
    meeting.organization && `Organization: ${meeting.organization}`,
    meeting.date && `Date: ${meeting.date}`,
    meeting.time && `Time: ${meeting.time}`,
    meeting.participants && `Participants and responsibilities: ${meeting.participants}`,
    meeting.agenda && `Agenda: ${meeting.agenda}`,
    meeting.notes && `Notes: ${meeting.notes}`,
    "Please acknowledge the information briefly. Do not add or infer meeting details that were not provided.",
  ]
    .filter(Boolean)
    .join("\n");
}