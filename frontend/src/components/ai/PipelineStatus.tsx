import React from "react";

export type PipelineState = "complete" | "active" | "pending" | "failed";

export interface PipelineStep {
  label: string;
  detail: string;
  state: PipelineState;
}

export default function PipelineStatus({ steps, label = "Request pipeline" }: { steps: PipelineStep[]; label?: string }) {
  return (
    <section className="surface prep-pipeline" aria-label={label} aria-live="polite">
      <div className="section-heading">
        <div><p className="eyebrow">LIVE PIPELINE</p><h2>{label}</h2></div>
      </div>
      <ol className="pipeline">
        {steps.map((step) => (
          <li className={`pipeline-step pipeline-${step.state}`} key={step.label}>
            <span className="pipeline-mark" aria-label={step.state}>
              {step.state === "complete" ? "✓" : step.state === "failed" ? "×" : step.state === "active" ? "·" : ""}
            </span>
            <span className="pipeline-copy"><strong>{step.label}</strong><small>{step.detail}</small></span>
          </li>
        ))}
      </ol>
    </section>
  );
}