'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import FlameMark from '../brand-mark.js';

const ICONS = {
  today: <><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9h12v-9"/></>,
  log: <><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>,
  nutrition: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></>,
  sport: <path d="M3 12h4l2 6 4-12 2 6h6"/>,
  sleep: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>,
  study: <><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5Z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5Z"/></>,
  trends: <path d="M5 20V10M11 20V4M17 20v-7"/>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></>,
};

function NavIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

const LINKS = [
  { href: '/today', label: 'Today', icon: 'today' },
  { href: '/log', label: 'Log', icon: 'log' },
  { href: '/nutrition', label: 'Nutrition', icon: 'nutrition' },
  { href: '/sport', label: 'Sport', icon: 'sport' },
  { href: '/sleep', label: 'Sleep', icon: 'sleep' },
  { href: '/study', label: 'Study', icon: 'study' },
  { href: '/trends', label: 'Trends', icon: 'trends' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

export default function AppChrome({ user, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the drawer whenever the route changes (covers link clicks reliably,
  // including any navigation that doesn't go through the onClick handler).
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Lock page scroll behind the drawer while it's open, and let Escape close it.
  useEffect(() => {
    if (!menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e) { if (e.key === 'Escape') setMenuOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  async function signOut() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="app-shell">
      <div className="app-topbar">
        <button className="menu-toggle" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="brand-mark"><FlameMark size={16} /></span>
        <span className="app-topbar-name">DailyFlow</span>
      </div>

      {menuOpen && <div className="app-sidebar-backdrop" onClick={() => setMenuOpen(false)} />}

      <div className={`app-sidebar${menuOpen ? ' open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><FlameMark /></span>
          DailyFlow
          <button className="drawer-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
            </svg>
          </button>
        </div>
        <nav>
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} className={pathname === l.href ? 'active' : ''}>
              <NavIcon name={l.icon} />
              {l.label}
            </Link>
          ))}
        </nav>
        <button className="signout" onClick={signOut}>Sign out ({user.name || user.email})</button>
      </div>
      <div className="app-main">
        <div className="app-main-inner">
          {children}
        </div>
      </div>
    </div>
  );
}
