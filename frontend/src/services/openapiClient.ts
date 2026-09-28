import api from './api';
import {
  ChatRequest,
  ChatResponse,
  RetainRequest,
  RetainResponse,
  RecallRequest,
  RecallResponse,
  HealthResponse,
  MemorySuggestionRequest,
  MemorySuggestionResponse,
  MemoryOperationStatusResponse,
} from '../types/api';

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const res = await api.post<ChatResponse>('/api/chat', req, { timeout: 540_000 });
  return res.data;
}

export async function retain(req: RetainRequest): Promise<RetainResponse> {
  const res = await api.post<RetainResponse>('/api/memory/retain', req, { timeout: 540_000 });
  return res.data;
}

export async function recall(req: RecallRequest): Promise<RecallResponse> {
  const res = await api.post<RecallResponse>('/api/memory/recall', req);
  return res.data;
}

export async function suggestMemories(req: MemorySuggestionRequest): Promise<MemorySuggestionResponse> {
  const res = await api.post<MemorySuggestionResponse>('/api/memory/suggestions', req, { timeout: 240_000 });
  return res.data;
}

export async function getMemoryOperationStatus(userId: string, operationId: string): Promise<MemoryOperationStatusResponse> {
  const res = await api.get<MemoryOperationStatusResponse>(`/api/memory/operations/${encodeURIComponent(operationId)}`, { params: { user_id: userId } });
  return res.data;
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await api.get<HealthResponse>('/api/health');
  return res.data;
}

export default {
  chat,
  retain,
  recall,
  suggestMemories,
  getHealth,
};
