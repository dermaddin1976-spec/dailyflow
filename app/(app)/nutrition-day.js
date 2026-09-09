'use client';
import { useState, useEffect, useMemo } from 'react';

function todayStr(){ return new Date().toISOString().slice(0, 10); }
function shiftDate(dateStr, offset) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function dayChipLabel(dateStr, today) {
  if (dateStr === today) return 'Today';
  const yesterday = shiftDate(today, -1);
  if (dateStr === yesterday) return 'Yest';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

function dayFullLabel(dateStr, today) {
  if (dateStr === today) return 'Today';
  const yesterday = shiftDate(today, -1);
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

// A quick day browser for "what did I eat on X" — a row of the last 7 days
// plus a date picker for anything further back, instead of needing to scroll
// past the logging form into the collapsed day-by-day history to check.
// Read-only by design: editing/deleting stays in the log form's history below,
// which already supports it.
export default function NutritionDayPicker() {
  const today = todayStr();
  const [selected, setSelected] = useState(today);
  const [items, setItems] = useState(null); // null = still loading

  useEffect(() => {
    fetch('/api/logs/meal').then(r => r.json()).then(d => setItems(d.logs || [])).catch(() => setItems([]));
  }, []);

  const days = useMemo(() => {
    const list = [];
    for (let i = 6; i >= 0; i--) list.push(shiftDate(today, -i));
    return list;
  }, [today]);

  const dayItems = useMemo(
    () => (items || []).filter(i => i.date === selected).sort((a, b) => (a.id || 0) - (b.id || 0)),
    [items, selected],
  );
  const totals = dayItems.reduce((acc, i) => ({
    calories: acc.calories + (i.calories || 0),
    protein: acc.protein + (i.protein || 0),
    carbs: acc.carbs + (i.carbs || 0),
    fat: acc.fat + (i.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1 }}>
          {days.map(d => {
            const active = d === selected;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setSelected(d)}
                style={{
                  flex: '1 0 40px', padding: '7px 4px', borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border-strong)'}`,
                  background: active ? 'var(--accent-soft)' : 'var(--surface)',
                  color: active ? 'var(--accent)' : 'var(--text-2)',
                  fontSize: 11.5, fontWeight: 600, cursor: 'pointer', textAlign: 'center',
                  fontFamily: 'inherit',
                }}
              >
                {dayChipLabel(d, today)}
              </button>
            );
          })}
        </div>
        <input
          type="date"
          max={today}
          value={selected}
          onChange={e => e.target.value && setSelected(e.target.value)}
          aria-label="Pick a date"
          style={{
            border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)',
            color: 'var(--text)', fontSize: 12, padding: '6px 8px', fontFamily: 'inherit', flexShrink: 0,
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{dayFullLabel(selected, today)}</span>
        {dayItems.length > 0 && (
          <span className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            {totals.calories} cal · {totals.protein}p · {totals.carbs}c · {totals.fat}f
          </span>
        )}
      </div>

      {items === null ? (
        <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>Loading&hellip;</p>
      ) : dayItems.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>Nothing logged {dayFullLabel(selected, today) === 'Today' ? 'yet today' : 'that day'}.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {dayItems.map(i => (
            <div key={i.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {i.photo_data_url && (
                <img
                  src={i.photo_data_url} alt=""
                  style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-strong)', flexShrink: 0 }}
                />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.description}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                  {[i.calories && `${i.calories} cal`, i.protein && `${i.protein}p`, i.carbs && `${i.carbs}c`, i.fat && `${i.fat}f`].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
