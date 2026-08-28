'use client';
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

  async function signOut() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="app-shell">
      <div className="app-sidebar">
        <div className="brand">
          <span className="brand-mark"><FlameMark /></span>
          DailyFlow
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
