import { useEffect, useState } from "react";
import { getMemoryOperation } from "../services/memoryApi";
import { ChatResponse } from "../types/api";

export type MemoryStorageState = "pending" | "stored" | "failed";

export function useMemoryOperation(response: ChatResponse | null) {
  const [status, setStatus] = useState<MemoryStorageState>("failed");

  useEffect(() => {
    if (!response) {
      setStatus("failed");
      return;
    }
    setStatus(response.memory_storage_status);
    if (response.memory_storage_status !== "pending" || !response.memory_operation_id) return;

    let active = true;
    let finished = false;
    const check = async () => {
      if (!active || finished) return;
      try {
        const result = await getMemoryOperation(response.user_id, response.memory_operation_id!);
        if (!active || !result.success) return;
        const operationStatus = result.status.toLowerCase();
        if (["completed", "complete", "succeeded", "success"].includes(operationStatus)) {
          finished = true;
          setStatus("stored");
        } else if (["failed", "cancelled", "canceled", "error"].includes(operationStatus)) {
          finished = true;
          setStatus("failed");
        }
      } catch {
        // Keep a pending write pending during transient status-service errors.
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [response?.memory_operation_id, response?.memory_storage_status, response?.user_id]);

  return status;
}