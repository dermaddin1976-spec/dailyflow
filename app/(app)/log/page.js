import Link from 'next/link';
import { getCurrentUser } from '../../../lib/auth.js';
import db from '../../../lib/db.js';
import InfoTip from '../info-tip.js';

const SECTIONS = [
  { href: '/nutrition', label: 'Nutrition' },
  { href: '/sport', label: 'Sport' },
  { href: '/sleep', label: 'Sleep' },
  { href: '/study', label: 'Study' },
];

const KIND_META = {
  sleep: { label: 'SLEEP', href: '/sleep' },
  study: { label: 'STUDY', href: '/study' },
  workout: { label: 'TRAINING', href: '/sport' },
  meal: { label: 'MEAL', href: '/nutrition' },
};

function describeEntry(row) {
  switch (row.kind) {
    case 'sleep':
      return { title: 'Sleep', meta: `${row.b}h${row.c ? ` · quality ${row.c}` : ''}`, note: row.d };
    case 'study':
      return { title: row.a || 'Study session', meta: `${row.b}m${row.c ? ` · focus ${row.c}` : ''}`, note: row.d };
    case 'workout':
      return { title: row.a || 'Session', meta: `${row.b}m${row.c ? ` · intensity ${row.c}` : ''}`, note: row.d };
    case 'meal':
      return { title: row.a || 'Meal', meta: `${row.b} cal${row.c ? ` · ${row.c}p` : ''}`, note: row.d };
    default:
      return { title: '', meta: '', note: '' };
  }
}

export default async function LogPage() {
  const user = await getCurrentUser();

  const rows = await db.prepare(`
    SELECT 'sleep' as kind, id, date, created_at, NULL as a, hours as b, quality as c, note as d FROM sleep_logs WHERE user_id=?
    UNION ALL
    SELECT 'study' as kind, id, date, created_at, subject as a, minutes as b, focus as c, note as d FROM study_logs WHERE user_id=?
    UNION ALL
    SELECT 'workout' as kind, id, date, created_at, type as a, minutes as b, intensity as c, note as d FROM workout_logs WHERE user_id=?
    UNION ALL
    SELECT 'meal' as kind, id, date, created_at, description as a, calories as b, protein as c, note as d FROM meal_logs WHERE user_id=?
    ORDER BY date DESC, created_at DESC
    LIMIT 60
  `).all(user.id, user.id, user.id, user.id);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Log</h1>
        <InfoTip>
          Everything you've logged across Nutrition, Sport, Sleep and Study, newest first, in one place. Click a
          kind of entry to open the tab it lives on, where you can edit or delete it.
        </InfoTip>
      </div>
      <p style={{ color: 'var(--text-2)', marginBottom: 20, fontSize: 13.5 }}>
        Each area has its own logging tools built in &mdash; jump straight there, or scan what you've logged recently below.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
        {SECTIONS.map(s => (
          <Link key={s.href} href={s.href} className="btn secondary" style={{ textDecoration: 'none' }}>{s.label}</Link>
        ))}
      </div>

      <h2 style={{ fontSize: 17, marginBottom: 14 }}>Recent activity</h2>
      {rows.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 28px', border: '1px dashed var(--border-strong)', boxShadow: 'none' }}>
          <h3 style={{ marginBottom: 8 }}>Nothing logged yet</h3>
          <p style={{ color: 'var(--text-2)', fontSize: 13.5, maxWidth: 380, margin: '0 auto' }}>
            Pick a tab above and log your first meal, session, night, or study block.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {rows.map((row, i) => {
            const meta = KIND_META[row.kind];
            const entry = describeEntry(row);
            return (
              <Link
                key={`${row.kind}-${row.id}`}
                href={meta.href}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14,
                  padding: '14px 20px', textDecoration: 'none', color: 'inherit',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <span className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', letterSpacing: 0.5, width: 62, flexShrink: 0 }}>{meta.label}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                      {entry.title} <span className="mono" style={{ color: 'var(--muted)', fontSize: 11.5 }}>&middot; {entry.meta}</span>
                    </span>
                    {entry.note && (
                      <span style={{ fontSize: 11.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {entry.note}
                      </span>
                    )}
                  </span>
                </span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{row.date}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
