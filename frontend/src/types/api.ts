export interface MemoryItem {
  id?: string | null;
  text: string;
  context?: string | null;
  type?: string | null;
  occurred_start?: string | null;
  mentioned_at?: string | null;
  score?: number | null;
}

export interface ChatRequest {
  user_id?: string;
  session_id?: string | null;
  message: string;
}

export interface ChatResponse {
  response: string;
  user_id: string;
  session_id: string;
  memories_recalled: MemoryItem[];
  memory_retained?: string | null;
  memory_stored: boolean;
  memory_storage_status: "pending" | "stored" | "failed";
  memory_operation_id?: string | null;
  memory_recall_attempted: boolean;
  memory_recall_success: boolean;
  memories_recalled_count: number;
  ai_generation_success: boolean;
  llm_provider: string;
  llm_model: string;
  interaction_count: number;
  status: string;
}

export interface MemoryOperationStatusResponse {
  success: boolean;
  operation_id: string;
  bank_id: string;
  status: string;
  error?: string | null;
}

export interface RetainRequest {
  bank_id?: string | null;
  user_id?: string | null;
  content: string;
  context?: string | null;
}

export interface RetainResponse {
  success: boolean;
  bank_id: string;
  message: string;
  operation_id?: string | null;
  details?: Record<string, any> | null;
}

export interface RecallRequest {
  bank_id?: string | null;
  user_id?: string | null;
  query: string;
  limit?: number;
}

export interface RecallResponse {
  bank_id: string;
  query: string;
  memories: MemoryItem[];
  total: number;
  prompt_context_string?: string | null;
}

export interface MemorySuggestion {
  content: string;
  category: string;
  reason: string;
}

export interface MemorySuggestionRequest {
  meeting_title: string;
  notes: string;
}

export interface MemorySuggestionResponse {
  success: boolean;
  suggestions: MemorySuggestion[];
  message?: string | null;
}

export interface ServiceHealth {
  status: string;
  provider?: string | null;
  url?: string | null;
  details?: Record<string, any> | null;
  error?: string | null;
}

export interface HealthResponse {
  status: string;
  backend: string;
  llm: ServiceHealth;
  hindsight: ServiceHealth;
}
