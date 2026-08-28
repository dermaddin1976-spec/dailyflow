'use client';
import { useState, useEffect, useCallback } from 'react';
import InfoTip from './info-tip.js';

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  return Math.round((due - today) / 86400000);
}

function badgeColor(n) {
  if (n < 0) return 'var(--muted)';
  if (n <= 1) return 'var(--critical)';
  if (n <= 6) return 'var(--warning)';
  return 'var(--text-2)';
}

function badgeLabel(n) {
  if (n < 0) return 'past';
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  return `${n} days`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const miniFieldStyle = {
  border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)',
  color: 'var(--text)', padding: '7px 9px', fontSize: 13, fontFamily: 'inherit',
};

export default function DeadlinesCard() {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [msg, setMsg] = useState('');

  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState('');
  const [pending, setPending] = useState(null); // null = no review in progress; else array of {title, due_date, include}
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(() => {
    fetch('/api/deadlines').then(r => r.json()).then(d => setItems(d.deadlines || [])).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function addDeadline(e) {
    e.preventDefault();
    setMsg('');
    const res = await fetch('/api/deadlines', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, due_date: dueDate }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || 'Something went wrong.'); return; }
    setTitle(''); setDueDate('');
    refresh();
  }

  async function removeDeadline(id) {
    await fetch(`/api/deadlines/${id}`, { method: 'DELETE' });
    refresh();
  }

  async function runExtract(body) {
    setExtracting(true); setExtractMsg('');
    try {
      const res = await fetch('/api/ai/deadlines-from-file', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setExtractMsg(data.error || 'Something went wrong.'); return; }
      if (!data.deadlines.length) {
        setExtractMsg(data.warnings || "Couldn't find any deadlines in that.");
        return;
      }
      setPending(data.deadlines.map(d => ({ ...d, include: true })));
      if (data.warnings) setExtractMsg(data.warnings);
    } catch (err) {
      setExtractMsg('Something went wrong reading that file.');
    } finally {
      setExtracting(false);
    }
  }

  async function handlePdf(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const base64 = await fileToBase64(file);
    runExtract({ pdfBase64: base64 });
  }

  async function handlePhotos(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const images = await Promise.all(files.map(async f => ({ base64: await fileToBase64(f), mimeType: f.type || 'image/jpeg' })));
    runExtract({ images });
  }

  function updatePending(i, patch) {
    setPending(p => p.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  }

  function cancelPending() {
    setPending(null);
    setExtractMsg('');
  }

  async function addSelected() {
    const selected = pending.filter(p => p.include && p.title.trim() && p.due_date);
    if (!selected.length) { setPending(null); setExtractMsg(''); return; }
    setAdding(true);
    for (const d of selected) {
      await fetch('/api/deadlines', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: d.title.trim(), due_date: d.due_date }),
      });
    }
    setAdding(false);
    setPending(null);
    setExtractMsg('');
    refresh();
  }

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <h3 style={{ margin: 0 }}>Deadlines</h3>
        <InfoTip>
          The color tells you how urgent something is: red means it's due today or tomorrow, yellow means it's due
          sometime this week, and it's left in the normal text color if it's further off than that. Once a deadline
          passes, it fades to gray. Upload a syllabus or course schedule (PDF or photos) and DailyAI pulls out every
          assignment and exam date it can find &mdash; you'll get a chance to review, edit, or drop any of them
          before they're actually added, since a wrong exam date is worse than no date at all.
        </InfoTip>
      </div>

      {pending ? (
        <div>
          <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 4 }}>
            Found {pending.length} deadline{pending.length === 1 ? '' : 's'} &mdash; review before adding.
          </p>
          {extractMsg && <p style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 10 }}>{extractMsg}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {pending.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={d.include} onChange={e => updatePending(i, { include: e.target.checked })} />
                <input
                  value={d.title}
                  onChange={e => updatePending(i, { title: e.target.value })}
                  style={{ ...miniFieldStyle, flex: 1 }}
                  disabled={!d.include}
                />
                <input
                  type="date"
                  value={d.due_date}
                  onChange={e => updatePending(i, { due_date: e.target.value })}
                  style={miniFieldStyle}
                  disabled={!d.include}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn secondary" onClick={cancelPending} disabled={adding}>Cancel</button>
            <button type="button" className="btn" onClick={addSelected} disabled={adding}>
              {adding ? 'Adding…' : `Add ${pending.filter(p => p.include).length} deadline${pending.filter(p => p.include).length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      ) : (
        <>
          {items.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nothing coming up yet.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(d => {
              const n = daysUntil(d.due_date);
              return (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 14 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: badgeColor(n) }}>{badgeLabel(n)}</span>
                    <button
                      onClick={() => removeDeadline(d.id)}
                      aria-label="Remove"
                      style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 15, padding: '0 4px' }}
                    >
                      &times;
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
          <form onSubmit={addDeadline} style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <input
              style={{ flex: '1 1 160px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', color: 'var(--text)', padding: '9px 11px', fontSize: 13.5 }}
              placeholder="Chemistry midterm"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
            <input
              type="date"
              style={{ border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', color: 'var(--text)', padding: '9px 11px', fontSize: 13.5 }}
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              required
            />
            <button className="btn secondary" type="submit">Add</button>
          </form>
          {msg && <p className="error-text">{msg}</p>}

          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <label className="btn secondary" style={{ fontSize: 12.5, padding: '8px 14px', display: 'inline-block' }}>
              {extracting ? (<><span className="spinner" />Reading…</>) : 'Upload syllabus (PDF)'}
              <input type="file" accept="application/pdf" onChange={handlePdf} disabled={extracting} style={{ display: 'none' }} />
            </label>
            <label className="btn secondary" style={{ fontSize: 12.5, padding: '8px 14px', display: 'inline-block' }}>
              {extracting ? (<><span className="spinner" />Reading…</>) : 'Upload syllabus (photos)'}
              <input type="file" accept="image/*" multiple onChange={handlePhotos} disabled={extracting} style={{ display: 'none' }} />
            </label>
          </div>
          {extractMsg && !pending && <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8 }}>{extractMsg}</p>}
        </>
      )}
    </div>
  );
}
