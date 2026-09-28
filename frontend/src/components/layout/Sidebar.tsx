import { Link, useLocation } from "react-router-dom";

const items = [
  { to: '/dashboard', label: 'Dashboard', glyph: '⌂' },
  { to: '/meetings', label: 'Meetings', glyph: '▤' },
  { to: '/ai-prep', label: 'AI Prep', glyph: '✳' },
  { to: '/memory', label: 'Memory', glyph: '◉' },
  { to: '/ai', label: 'AI Agent', glyph: '↗' },
];

function NavigationLinks({ mobile }: { mobile: boolean }) {
  const loc = useLocation();
  return (
    <nav className={mobile ? "mobile-nav-links" : "nav-list"} aria-label={mobile ? undefined : "Workspace navigation"}>
      {items.map((item) => {
        const active = loc.pathname === item.to ||
          (item.to === '/meetings' && loc.pathname.startsWith('/meetings/') && !loc.pathname.endsWith('/prepare')) ||
          (item.to === '/ai-prep' && loc.pathname.startsWith('/meetings/') && loc.pathname.endsWith('/prepare'));
        return (
          <Link key={item.to} to={item.to} aria-current={active ? 'page' : undefined} className={`nav-link ${active ? 'nav-link-active' : ''}`}>
            <span className="nav-glyph" aria-hidden="true">{item.glyph}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar({ mobile = false }: { mobile?: boolean }) {
  if (mobile) return <NavigationLinks mobile />;
  return (
    <aside className="nav-rail">
      <div className="brand-lockup">
        <div className="brand-monogram" aria-hidden="true">R</div>
        <div>
          <div className="brand-name">RECALLMEET</div>
          <div className="brand-subtitle">AI meeting preparation</div>
        </div>
      </div>
      <p className="nav-section-label">Workspace</p>
      <NavigationLinks mobile={false} />
      <div className="nav-bottom">
        <Link className="nav-link" to="/status"><span className="nav-glyph" aria-hidden="true">⌁</span><span>Agent status</span></Link>
        <div className="nav-memory-note">
          <span>Persistent memory</span>
          <strong>Hindsight-connected agent</strong>
          <p>Your meeting context can travel with you.</p>
        </div>
      </div>
    </aside>
  );
}
