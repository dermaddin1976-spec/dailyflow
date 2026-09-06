'use client';
import { useState } from 'react';

function dayLabel(dateStr) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  if (dateStr === today) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// Groups already-fetched log entries by their `date` field and renders each day
// as a collapsible row instead of one long flat scrolling list. Today is always
// expanded; every other day starts collapsed and expands on click, so a click
// on a day is effectively "show me what I logged that day."
export default function LogHistory({ items, renderItem, summarize, emptyText }) {
  const [openDates, setOpenDates] = useState(() => new Set());

  if (!items || items.length === 0) {
    return <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 16 }}>{emptyText || 'Nothing logged yet.'}</p>;
  }

  const groups = [];
  const byDate = new Map();
  for (const item of items) {
    let g = byDate.get(item.date);
    if (!g) {
      g = { date: item.date, items: [] };
      byDate.set(item.date, g);
      groups.push(g);
    }
    g.items.push(item);
  }

  const today = new Date().toISOString().slice(0, 10);

  function toggle(date) {
    setOpenDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  }

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 4, display: 'flex', flexDirection: 'column' }}>
      {groups.map(group => {
        const isOpen = group.date === today || openDates.has(group.date);
        return (
          <div key={group.date} style={{ borderBottom: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => toggle(group.date)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
                background: 'none', border: 'none', padding: '10px 0', cursor: 'pointer', color: 'var(--text)',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              }}
            >
              <span>{dayLabel(group.date)}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mono" style={{ color: 'var(--muted)', fontSize: 11.5, fontWeight: 400 }}>
                  {summarize ? summarize(group.items) : `${group.items.length} ${group.items.length === 1 ? 'entry' : 'entries'}`}
                </span>
                <span style={{ color: 'var(--muted)', fontSize: 10, display: 'inline-block', transition: 'transform 0.15s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>
                  &#9656;
                </span>
              </span>
            </button>
            {isOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 12 }}>
                {group.items.map(renderItem)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
