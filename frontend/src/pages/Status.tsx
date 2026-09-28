import React from "react";
import { Link } from "react-router-dom";
import AgentStatus from "../components/status/AgentStatus";
import AppLayout from "../components/layout/AppLayout";
import { useHealth } from "../hooks/useHealth";

export default function Status() {
  const { health, loading, error, refresh } = useHealth(30000);

  return (
    <AppLayout>
      <div className="page-wrap">
        <div className="page-heading">
          <div><p className="eyebrow">CONNECTED SERVICES</p><h1>Agent status</h1><p>Live health from the existing FastAPI, configured LLM, and Hindsight services.</p></div>
          <Link className="button button-accent" to="/ai-prep">Open AI Prep <span aria-hidden="true">→</span></Link>
        </div>
        <div className="status-page-grid">
          <AgentStatus health={health} loading={loading} error={Boolean(error)} onRefresh={() => void refresh()} />
          <section className="surface section-block">
            <p className="eyebrow">ARCHITECTURE</p><h2>Recall, reflect, prepare</h2>
            <p className="section-copy">The application calls the backend only. Provider credentials remain server-side.</p>
            <div className="architecture-flow architecture-map">
              <div className="architecture-root">RECALLMEET <span>USER CONTEXT</span></div>
              <b aria-hidden="true">↓</b>
              <div className="architecture-root">AI AGENT <span>FASTAPI CHAT</span></div>
              <div className="architecture-branches">
                <div>PRIMARY LLM <span>{health?.llm?.provider || "Status unavailable"}</span></div>
                <div>BACKUP LLM <span>Not configured</span></div>
              </div>
              <b aria-hidden="true">↓</b>
              <div className="architecture-root">HINDSIGHT <span>RETAIN · RECALL</span></div>
              <b aria-hidden="true">↓</b>
              <div className="architecture-output">PERSONALIZED MEETING PREPARATION</div>
            </div>
            {health?.llm?.error && <p className="error-state">Primary LLM: {health.llm.error}</p>}
            {health?.hindsight?.error && <p className="error-state">Hindsight: {health.hindsight.error}</p>}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}