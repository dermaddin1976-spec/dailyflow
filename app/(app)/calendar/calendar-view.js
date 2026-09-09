'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad(n) { return String(n).padStart(2, '0'); }

// Formats a Date as a naive "YYYY-MM-DDTHH:MM:SS" local string — no
// timezone offset, no UTC conversion. This matches how event start_at/end_at
// are stored (either typed in directly, or normalized from Google's payload),
// so range comparisons on the server stay simple string comparisons.
function naiveLocal(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// Monday-start 6-week (42 day) grid that fully covers the given month.
function buildGrid(year, month) {
  const first = new Date(year, month, 1);
  const firstWeekday = (first.getDay() + 6) % 7; // 0 = Monday
  const gridStart = addDays(first, -firstWeekday);
  const days = [];
  for (let i = 0; i < 42; i++) days.push(addDays(gridStart, i));
  return days;
}

function timeLabel(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const fieldStyle = {
  border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)',
  color: 'var(--text)', padding: '9px 11px', fontSize: 13.5, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
};

function emptyForm(dateKeyStr) {
  const base = dateKeyStr || dateKey(new Date());
  return {
    id: null, title: '', location: '', notes: '',
    date: base, startTime: '09:00', endTime: '10:00', allDay: false,
  };
}

export default function CalendarView({ deadlines, googleCalendarConnected, googleCalendarEmail, gcalStatus }) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [selected, setSelected] = useState(dateKey(today));
  const [form, setForm] = useState(null); // null = no editor open; else the form object
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const grid = useMemo(() => buildGrid(cursor.year, cursor.month), [cursor]);
  const gridStart = grid[0];
  const gridEnd = addDays(grid[41], 1);

  const refresh = useCallback(() => {
    setLoading(true);
    setErr('');
    const params = new URLSearchParams({ start: naiveLocal(gridStart), end: naiveLocal(gridEnd) });
    fetch(`/api/calendar/events?${params.toString()}`)
      .then(res => res.json())
      .then(data => setEvents(data.events || []))
      .catch(() => setErr('Could not load events.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridStart.getTime(), gridEnd.getTime()]);

  useEffect(() => { refresh(); }, [refresh]);

  // Buckets events (and deadlines, shown read-only) by local day key.
  const byDay = useMemo(() => {
    const map = new Map();
    const add = (key, item) => {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    };
    for (const ev of events) {
      const d = new Date(ev.start_at);
      if (Number.isNaN(d.getTime())) continue;
      add(dateKey(d), { kind: 'event', ...ev, sortAt: d.getTime() });
    }
    for (const dl of deadlines) {
      const d = new Date(`${dl.due_date}T00:00:00`);
      if (Number.isNaN(d.getTime())) continue;
      add(dateKey(d), { kind: 'deadline', ...dl, sortAt: d.getTime() });
    }
    for (const list of map.values()) list.sort((a, b) => a.sortAt - b.sortAt);
    return map;
  }, [events, deadlines]);

  function goToMonth(delta) {
    setCursor(c => {
      const m = c.month + delta;
      const year = c.year + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      return { year, month };
    });
  }

  function goToday() {
    setCursor({ year: today.getFullYear(), month: today.getMonth() });
    setSelected(dateKey(today));
  }

  function openAdd(dayKeyStr) {
    setForm(emptyForm(dayKeyStr));
  }

  function openEdit(ev) {
    const start = new Date(ev.start_at);
    const end = ev.end_at ? new Date(ev.end_at) : null;
    setForm({
      id: ev.id, title: ev.title, location: ev.location || '', notes: ev.notes || '',
      date: dateKey(start),
      startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
      endTime: end ? `${pad(end.getHours())}:${pad(end.getMinutes())}` : '',
      allDay: !!ev.all_day,
      source: ev.source,
    });
  }

  async function saveForm(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const startAt = form.allDay ? `${form.date}T00:00:00` : `${form.date}T${form.startTime}:00`;
    const endAt = form.allDay ? null : (form.endTime ? `${form.date}T${form.endTime}:00` : null);
    const payload = {
      title: form.title.trim(), location: form.location.trim() || null, notes: form.notes.trim() || null,
      start_at: startAt, end_at: endAt, all_day: form.allDay,
    };
    const url = form.id ? `/api/calendar/events/${form.id}` : '/api/calendar/events';
    const method = form.id ? 'PATCH' : 'POST';
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error || 'Could not save that event.'); return; }
      setForm(null);
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(id) {
    if (!window.confirm('Delete this event?')) return;
    await fetch(`/api/calendar/events/${id}`, { method: 'DELETE' });
    setForm(null);
    refresh();
  }

  async function syncGoogle() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch('/api/integrations/google-calendar/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setSyncMsg(data.error || 'Sync failed.'); return; }
      setSyncMsg(`Synced ${data.synced} of ${data.total} events.`);
      refresh();
    } catch (err2) {
      setSyncMsg('Something went wrong reaching Google.');
    } finally {
      setSyncing(false);
    }
  }

  const selectedItems = byDay.get(selected) || [];
  const todayKey = dateKey(today);

  return (
    <div>
      {gcalStatus === 'connected' && (
        <p style={{ color: 'var(--good)', fontSize: 13, marginBottom: 11 }}>Google Calendar connected — hit &ldquo;Sync&rdquo; below to pull in your events.</p>
      )}
      {gcalStatus === 'error' && (
        <p className="error-text" style={{ marginBottom: 11 }}>Couldn&rsquo;t connect to Google Calendar. Try again from Settings.</p>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn secondary" onClick={() => goToMonth(-1)} aria-label="Previous month" style={{ padding: '8px 14px' }}>&larr;</button>
            <h2 style={{ fontSize: 18, minWidth: 170, textAlign: 'center' }}>{MONTH_LABELS[cursor.month]} {cursor.year}</h2>
            <button className="btn secondary" onClick={() => goToMonth(1)} aria-label="Next month" style={{ padding: '8px 14px' }}>&rarr;</button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn secondary" onClick={goToday}>Today</button>
            {googleCalendarConnected ? (
              <button className="btn secondary" onClick={syncGoogle} disabled={syncing}>
                {syncing ? 'Syncing…' : 'Sync Google Calendar'}
              </button>
            ) : (
              <a className="btn secondary" href="/settings">Connect Google Calendar</a>
            )}
          </div>
        </div>
        {syncMsg && <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 10 }}>{syncMsg}</p>}
        {err && <p className="error-text">{err}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginTop: 14 }}>
          {WEEKDAY_LABELS.map(l => (
            <div key={l} style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)', textAlign: 'center', padding: '2px 0' }}>{l}</div>
          ))}
          {grid.map(day => {
            const key = dateKey(day);
            const inMonth = day.getMonth() === cursor.month;
            const isToday = key === todayKey;
            const isSelected = key === selected;
            const items = byDay.get(key) || [];
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                onDoubleClick={() => openAdd(key)}
                style={{
                  textAlign: 'left', minHeight: 74, borderRadius: 'var(--radius-sm)', padding: '6px 7px',
                  background: isSelected ? 'color-mix(in srgb, var(--accent) 16%, var(--surface-2))' : 'var(--surface-2)',
                  border: isToday ? '1px solid var(--accent)' : '1px solid var(--border)',
                  opacity: inMonth ? 1 : 0.45,
                  display: 'flex', flexDirection: 'column', gap: 3, cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: isToday ? 700 : 600, color: isToday ? 'var(--accent)' : 'var(--text)' }}>{day.getDate()}</span>
                {items.slice(0, 3).map((it, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 10.5, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      color: it.kind === 'deadline' ? 'var(--warning)' : 'var(--text-2)',
                    }}
                  >
                    {it.kind === 'deadline' ? `📌 ${it.title}` : it.title}
                  </span>
                ))}
                {items.length > 3 && (
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>+{items.length - 3} more</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <h3>{new Date(`${selected}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
          <button className="btn" onClick={() => openAdd(selected)}>Add event</button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 12 }}>Loading…</p>
        ) : selectedItems.length === 0 ? (
          <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 12 }}>Nothing on the calendar for this day.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 11 }}>
            {selectedItems.map(it => (
              <div
                key={`${it.kind}-${it.id}`}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', border: '1px solid var(--border)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 13.5 }}>
                    {it.kind === 'deadline' ? '📌 ' : ''}{it.title}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                    {it.kind === 'deadline'
                      ? 'Deadline'
                      : (it.all_day ? 'All day' : `${timeLabel(it.start_at)}${it.end_at ? ` – ${timeLabel(it.end_at)}` : ''}`)}
                    {it.location ? ` · ${it.location}` : ''}
                    {it.source === 'google' ? ' · Google' : ''}
                  </p>
                  {it.notes && <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{it.notes}</p>}
                </div>
                {it.kind === 'event' && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => openEdit(it)}>Edit</button>
                    <button className="btn secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => deleteEvent(it.id)}>Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {form && (
        <div
          onClick={() => setForm(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 13 }}
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={saveForm}
            className="card"
            style={{ maxWidth: 420, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <h3>{form.id ? 'Edit event' : 'Add event'}</h3>
            {form.source === 'google' && (
              <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>
                This came from Google Calendar — edits stay here until the next sync overwrites them.
              </p>
            )}
            <div className="field">
              <label>Title</label>
              <input style={fieldStyle} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required autoFocus />
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" style={fieldStyle} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11, fontSize: 13 }}>
              <input type="checkbox" checked={form.allDay} onChange={e => setForm({ ...form, allDay: e.target.checked })} />
              All day
            </label>
            {!form.allDay && (
              <div style={{ display: 'flex', gap: 10, marginTop: 11 }}>
                <div className="field" style={{ marginTop: 0, flex: 1 }}>
                  <label>Starts</label>
                  <input type="time" style={fieldStyle} value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
                </div>
                <div className="field" style={{ marginTop: 0, flex: 1 }}>
                  <label>Ends</label>
                  <input type="time" style={fieldStyle} value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
                </div>
              </div>
            )}
            <div className="field">
              <label>Location</label>
              <input style={fieldStyle} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea style={{ ...fieldStyle, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              <button type="button" className="btn secondary" onClick={() => setForm(null)}>Cancel</button>
              {form.id && (
                <button type="button" className="btn secondary" style={{ marginLeft: 'auto', color: 'var(--critical)' }} onClick={() => deleteEvent(form.id)}>Delete</button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
