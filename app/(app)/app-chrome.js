'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import FlameMark from '../brand-mark.js';

const LINKS = [
  { href: '/today', label: 'Today' },
  { href: '/log', label: 'Log' },
  { href: '/nutrition', label: 'Nutrition' },
  { href: '/sport', label: 'Sport' },
  { href: '/sleep', label: 'Sleep' },
  { href: '/study', label: 'Study' },
  { href: '/trends', label: 'Trends' },
  { href: '/settings', label: 'Settings' },
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
            <Link key={l.href} href={l.href} className={pathname === l.href ? 'active' : ''}>{l.label}</Link>
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
