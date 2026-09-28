import React from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import CursorGlow from "../common/CursorGlow";
import FloatingAssistant from "../ai/FloatingAssistant";
import { useSettings } from '../../context/SettingsContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { effectsEnabled } = useSettings();

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="workspace-column">
        <Topbar />
        <main className="workspace-content">{children}</main>
      </div>
      <nav className="mobile-nav" aria-label="Main navigation">
        <Sidebar mobile />
      </nav>
      {effectsEnabled && (
        <div className="pointer-events-none">
          <CursorGlow />
        </div>
      )}
      <FloatingAssistant />
    </div>
  );
}
