import Link from 'next/link';
import { requireUser } from '../../../lib/auth.js';
import db from '../../../lib/db.js';
import InfoTip from '../info-tip.js';
import RecentActivity from '../log-recent.js';

const SECTIONS = [
  { href: '/nutrition', label: 'Nutrition' },
  { href: '/sport', label: 'Sport' },
  { href: '/sleep', label: 'Sleep' },
  { href: '/study', label: 'Study' },
];

export default async function LogPage() {
  const user = await requireUser();

  const rows = await db.prepare(`
    SELECT 'sleep' as kind, id, date, created_at, NULL as a, hours as b, quality as c, note as d FROM sleep_logs WHERE user_id=?
    UNION ALL
    SELECT 'study' as kind, id, date, created_at, subject as a, minutes as b, focus as c, note as d FROM study_logs WHERE user_id=?
    UNION ALL
    SELECT 'workout' as kind, id, date, created_at, type as a, minutes as b, intensity as c, note as d FROM workout_logs WHERE user_id=?
    UNION ALL
    SELECT 'meal' as kind, id, date, created_at, description as a, calories as b, protein as c, note as d FROM meal_logs WHERE user_id=?
    ORDER BY date DESC, created_at DESC
    LIMIT 300
  `).all(user.id, user.id, user.id, user.id);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Log</h1>
        <InfoTip>
          Everything you've logged across Nutrition, Sport, Sleep and Study, grouped by day &mdash; today's always
          open, older days are one click away. Click a kind of entry to open the tab it lives on, where you can
          edit or delete it.
        </InfoTip>
      </div>
      <p style={{ color: 'var(--text-2)', marginBottom: 16, fontSize: 13.5 }}>
        Each area has its own logging tools built in &mdash; jump straight there, or scan what you've logged recently below.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {SECTIONS.map(s => (
          <Link key={s.href} href={s.href} className="btn secondary" style={{ textDecoration: 'none' }}>{s.label}</Link>
        ))}
      </div>

      <h2 style={{ fontSize: 17, marginBottom: 11 }}>Recent activity</h2>
      {rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '30px 20px', border: '1px dashed var(--border-strong)', boxShadow: 'none' }}>
          <h3 style={{ marginBottom: 8 }}>Nothing logged yet</h3>
          <p style={{ color: 'var(--text-2)', fontSize: 13.5, maxWidth: 380, margin: '0 auto' }}>
            Pick a tab above and log your first meal, session, night, or study block.
          </p>
        </div>
      ) : (
        <RecentActivity rows={rows} />
      )}
    </div>
  );
}
