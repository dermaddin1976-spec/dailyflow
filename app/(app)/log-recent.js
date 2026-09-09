'use client';
import Link from 'next/link';
import LogHistory from './log-history.js';

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

// The cross-domain "everything you've logged" list, grouped by day and capped
// to the most recent few days (same LogHistory component each individual tab's
// logger uses) instead of one long flat list of up to 60 rows.
export default function RecentActivity({ rows }) {
  return (
    <div className="card">
      <LogHistory
        items={rows}
        emptyText="Nothing logged yet."
        initialGroups={6}
        renderItem={row => {
          const meta = KIND_META[row.kind];
          const entry = describeEntry(row);
          return (
            <Link
              key={`${row.kind}-${row.id}`}
              href={meta.href}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 11,
                textDecoration: 'none', color: 'inherit',
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
            </Link>
          );
        }}
        summarize={items => `${items.length} ${items.length === 1 ? 'entry' : 'entries'}`}
      />
    </div>
  );
}
