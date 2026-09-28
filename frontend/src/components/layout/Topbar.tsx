import { useLocation } from "react-router-dom";
import { useHealth } from "../../hooks/useHealth";

export default function Topbar() {
  const { health, loading } = useHealth(60000);
  const location = useLocation();
  const pageName = location.pathname.startsWith('/meetings/')
    ? location.pathname.endsWith('/prepare') ? 'AI Prep' : 'Meeting details'
    : ({
        '/dashboard': 'Dashboard',
        '/meetings': 'Meetings',
        '/ai-prep': 'AI Prep',
        '/memory': 'Memory',
        '/ai': 'AI Agent',
        '/status': 'Agent status',
        '/settings': 'Settings',
      } as Record<string, string>)[location.pathname] ?? 'Workspace';
  const apiReady = health?.backend === 'online';

  return (
    <header className="topbar">
      <div className="topbar-crumb"><span>RECALLMEET</span><span aria-hidden="true"> / </span><strong>{pageName}</strong></div>
      <div className="topbar-status" aria-live="polite">
        <span className={`status-dot ${apiReady ? 'status-dot-ok' : health || !loading ? 'status-dot-fail' : 'status-dot-warn'}`} />
        <span>{apiReady ? 'Agent API online' : loading ? 'Checking services' : 'Status unavailable'}</span>
      </div>
    </header>
  );
}
