import React, { useEffect, useState } from "react";
import { recallMemory } from "../../services/memoryApi";
import { MemoryItem } from "../../types/api";

type Props = {
  userId?: string;
  memories?: MemoryItem[]; // optional live memories passed from caller
  recallSucceeded?: boolean;
};

export default function MemoryPanel({ userId, memories: incoming, recallSucceeded }: Props) {
  const [memories, setMemories] = useState<MemoryItem[]>(incoming ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (incoming !== undefined) {
      setMemories(incoming);
      setError(recallSucceeded === false ? "Memory recall failed; chat continued without memory." : null);
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await recallMemory({ user_id: userId ?? "user_dev", query: "recent", limit: 5 });
        setMemories(res.memories || []);
      } catch (e: any) {
        setError(e?.message || "Failed to load memories");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId, incoming, recallSucceeded]);

  return (
    <div className="memory-panel">
      <div className="memory-panel-heading">
        <h3>MEMORY</h3>
        <span>{recallSucceeded === false ? "Recall failed" : incoming !== undefined ? `${memories.length} recalled` : "Recent context"}</span>
      </div>
      {loading && <p className="empty-state">Loading memories…</p>}
      {error && <p className="error-state">{error}</p>}
      {!loading && !error && memories.length === 0 && <p className="empty-state">{incoming !== undefined ? "No relevant memories recalled" : "No recent memories found"}</p>}
      <ul className="memory-panel-list">
        {memories.map((memory) => (
          <li key={memory.id || memory.text}>
            <p>{memory.text}</p>
            <div>{memory.context || "Hindsight"}{memory.mentioned_at ? ` · ${new Date(memory.mentioned_at).toLocaleDateString()}` : ""}</div>
          </li>
        ))}
      </ul>
      {incoming !== undefined && recallSucceeded === false && <p className="memory-fallback-note">AI continued without recalled context.</p>}
    </div>
  );
}
