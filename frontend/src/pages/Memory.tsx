import React, { FormEvent, useEffect, useState } from "react";
import AppLayout from "../components/layout/AppLayout";
import { postChat } from "../services/chatApi";
import { recallMemory } from "../services/memoryApi";
import { ChatResponse, MemoryItem } from "../types/api";
import { useMemoryOperation } from "../hooks/useMemoryOperation";

export default function Memory() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("What should I remember about my previous meetings?");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ChatResponse | null>(null);
  const testStorageStatus = useMemoryOperation(testResult);

  useEffect(() => {
    let active = true;
    recallMemory({
      user_id: "user_dev",
      query: "Important context, decisions, people, and responsibilities from previous meetings",
      limit: 15,
    })
      .then((result) => {
        if (active) setMemories(result.memories);
      })
      .catch((reason: { message?: string }) => {
        if (active) setError(reason?.message ?? "Memory could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function testRecall(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    setTesting(true);
    setError(null);
    try {
      setTestResult(await postChat({ user_id: "user_dev", message: question.trim() }));
    } catch (reason: any) {
      setError(reason?.message ?? "The AI request failed.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <AppLayout>
      <div className="page-wrap memory-page">
        <div className="page-heading">
          <div>
            <p className="eyebrow">PERSISTENT CONTEXT</p>
            <h1>AI memory</h1>
            <p>What RECALLMEET remembers from previous meetings.</p>
          </div>
          <span className="count-mark">{memories.length.toString().padStart(2, "0")} <small>recalled</small></span>
        </div>

        <section className="memory-flow" aria-label="Memory pipeline">
          {[
            ["01", "RETAIN"],
            ["02", "HINDSIGHT"],
            ["03", "RECALL"],
            ["04", "REFLECT"],
          ].map(([number, label], index) => (
            <React.Fragment key={label}>
              <div className="memory-flow-step">
                <small>{number}</small>
                <strong>{label}</strong>
              </div>
              {index < 3 && <span className="flow-arrow" aria-hidden="true">→</span>}
            </React.Fragment>
          ))}
        </section>

        <div className="memory-columns">
          <section className="surface memory-list">
            <div className="section-heading">
              <div>
                <p className="eyebrow">HINDSIGHT BANK</p>
                <h2>Remembered context</h2>
              </div>
              <span className="quiet-tag">Live recall</span>
            </div>
            {loading && <p className="empty-state">Searching Hindsight for meeting context…</p>}
            {error && !testResult && <p className="error-state">{error}</p>}
            {!loading && !error && memories.length === 0 && (
              <p className="empty-state">No relevant memories found in the current bank.</p>
            )}
            <ul className="memory-items">
              {memories.map((memory) => (
                <li key={memory.id ?? `${memory.text}-${memory.context}`}>
                  <div className="memory-item-top">
                    <span>{memory.type || "MEMORY"}</span>
                    {memory.score != null && <span>RELEVANCE {Math.min(100, Math.max(0, Math.round(memory.score * 100)))}%</span>}
                  </div>
                  <p>{memory.text}</p>
                  <div className="memory-item-meta">
                    <span>{memory.context || "Hindsight memory"}</span>
                    <time>{memory.mentioned_at ? new Date(memory.mentioned_at).toLocaleDateString() : "Date unavailable"}</time>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface recall-test">
            <p className="eyebrow">LIVE MEMORY CHECK</p>
            <h2>Ask what you remember</h2>
            <p className="section-copy">This sends your question to the existing chat API. Hindsight recall and the AI response are returned by the backend.</p>
            <form onSubmit={testRecall}>
              <label htmlFor="memory-question">Your question</label>
              <textarea
                id="memory-question"
                rows={4}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask about a past meeting, decision, or responsibility"
              />
              <button className="button button-accent" disabled={testing || !question.trim()} type="submit">
                {testing ? "Recalling context…" : "Test memory recall"}
                <span aria-hidden="true">↗</span>
              </button>
            </form>
            {testResult && (
              <div className="test-result" aria-live="polite">
                <div className="result-status-row">
                  <span>Memories recalled</span>
                  <strong>{testResult.memory_recall_success ? testResult.memories_recalled_count : "Recall failed"}</strong>
                </div>
                <p>{testResult.response}</p>
                <div className="result-status-row result-secondary">
                  <span>AI generation</span><strong>{testResult.ai_generation_success ? "Success" : "Failed"}</strong>
                  <span>Retention</span><strong>{testStorageStatus === "pending" ? "Queued in Hindsight" : testStorageStatus === "stored" ? "Stored" : "Failed"}</strong>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}