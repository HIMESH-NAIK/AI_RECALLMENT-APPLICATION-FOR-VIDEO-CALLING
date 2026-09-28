import React from "react";
import { ChatResponse, HealthResponse } from "../../types/api";

type Props = {
  health: HealthResponse | null;
  loading?: boolean;
  error?: boolean;
  lastResponse?: ChatResponse | null;
  onRefresh?: () => void;
  compact?: boolean;
};

function StateValue({ value, tone }: { value: string; tone: "ok" | "warn" | "bad" | "unknown" }) {
  return (
    <span className="agent-status-value">
      <i aria-hidden="true" className={`status-dot ${tone === "ok" ? "status-dot-ok" : tone === "warn" ? "status-dot-warn" : tone === "bad" ? "status-dot-fail" : ""}`} />
      {value}
    </span>
  );
}

export default function AgentStatus({ health, loading = false, error = false, lastResponse, onRefresh, compact = false }: Props) {
  const apiStatus = health?.backend === "online" ? "Connected" : loading ? "Checking" : "Status unavailable";
  const llmStatus = health?.llm?.status ?? (loading ? "Checking" : "Status unavailable");
  const memoryStatus = health?.hindsight?.status ?? (loading ? "Checking" : "Status unavailable");
  const recallStatus = lastResponse
    ? lastResponse.memory_recall_success
      ? `Working · ${lastResponse.memories_recalled_count} found`
      : "Failed · fallback active"
    : "Status unavailable";
  const retentionStatus = lastResponse
    ? lastResponse.memory_storage_status === "pending"
      ? "Queued · Hindsight processing"
      : lastResponse.memory_storage_status === "stored" ? "Working · last write stored" : "Failed"
    : "Status unavailable";
  const agentConnected = health?.backend === "online" && health.llm.status === "connected";
  const provider = health?.llm.provider?.replace(/_/g, " ") || health?.llm.details?.model || "Primary LLM";

  const rows: Array<[string, string, "ok" | "warn" | "bad" | "unknown"]> = [
    ["API", apiStatus, apiStatus === "Connected" ? "ok" : loading ? "warn" : "unknown"],
    ["Primary LLM", `${provider} · ${llmStatus}`, llmStatus === "connected" ? "ok" : loading ? "warn" : "unknown"],
    ["Backup LLM", "Not configured", "unknown"],
    ["Hindsight", memoryStatus, memoryStatus === "connected" ? "ok" : loading ? "warn" : "bad"],
    ["Memory recall", recallStatus, lastResponse ? lastResponse.memory_recall_success ? "ok" : "bad" : "unknown"],
    ["Memory retention", retentionStatus, lastResponse ? lastResponse.memory_storage_status === "pending" ? "warn" : lastResponse.memory_stored ? "ok" : "bad" : "unknown"],
  ];

  return (
    <section className={`surface agent-status ${compact ? "agent-status-compact" : ""}`} aria-label="AI agent status">
      <div className="agent-status-header">
        <div>
          <strong>AI agent</strong>
          <small>{agentConnected ? "Ready for meeting context" : loading ? "Checking connected services" : "Connection status unavailable"}</small>
        </div>
        {onRefresh && <button className="text-button" type="button" onClick={onRefresh} disabled={loading}>Refresh</button>}
      </div>
      {error && <p className="error-state">Health status could not be loaded.</p>}
      <div className="agent-status-list">
        {rows.map(([label, value, tone]) => (
          <div className="agent-status-row" key={label}>
            <span>{label}</span><StateValue value={value} tone={tone} />
          </div>
        ))}
      </div>
    </section>
  );
}