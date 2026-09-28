export interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  participants: string;
  organization: string;
  agenda: string;
  notes: string;
  createdAt: string;
  preparedAt?: string;
  memoryStored?: boolean;
  memoryStorageStatus?: "pending" | "stored" | "failed";
  memoryOperationId?: string;
}

export type MeetingInput = Omit<Meeting, "id" | "createdAt">;