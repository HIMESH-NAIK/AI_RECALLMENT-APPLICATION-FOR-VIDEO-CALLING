import { chat } from "./openapiClient";
import { ChatRequest, ChatResponse } from "../types/api";

export async function postChat(req: ChatRequest): Promise<ChatResponse> {
  return chat(req);
}
