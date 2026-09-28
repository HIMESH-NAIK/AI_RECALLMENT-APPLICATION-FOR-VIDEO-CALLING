import { retain, recall, suggestMemories as requestSuggestions, getMemoryOperationStatus as getOperationStatus } from "./openapiClient";
import { RetainRequest, RetainResponse, RecallRequest, RecallResponse, MemorySuggestionRequest, MemorySuggestionResponse, MemoryOperationStatusResponse } from "../types/api";

export async function retainMemory(req: RetainRequest): Promise<RetainResponse> {
  return retain(req);
}

export async function recallMemory(req: RecallRequest): Promise<RecallResponse> {
  return recall(req);
}

export async function suggestMeetingMemories(req: MemorySuggestionRequest): Promise<MemorySuggestionResponse> {
  return requestSuggestions(req);
}

export async function getMemoryOperation(userId: string, operationId: string): Promise<MemoryOperationStatusResponse> {
  return getOperationStatus(userId, operationId);
}
