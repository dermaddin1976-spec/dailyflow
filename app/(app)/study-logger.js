'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import InfoTip from './info-tip.js';

function todayStr(){ return new Date().toISOString().slice(0,10); }

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const miniFieldStyle = { border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', color: 'var(--text)', padding: '6px 8px', fontSize: 12.5, fontFamily: 'inherit', width: '100%' };

function StudyRow({ item, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(item.subject ?? '');
  const [minutes, setMinutes] = useState(item.minutes ?? '');
  const [focus, setFocus] = useState(item.focus ?? '');
  const [note, setNote] = useState(item.note ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onSave(item.id, { subject, minutes, focus, note });
    setSaving(false);
    setEditing(false);
  }

  function cancel() {
    setSubject(item.subject ?? ''); setMinutes(item.minutes ?? ''); setFocus(item.focus ?? ''); setNote(item.note ?? '');
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 10, background: 'var(--surface-2)' }}>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="subject" style={{ ...miniFieldStyle, marginBottom: 6 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <input type="number" min="1" placeholder="minutes" value={minutes} onChange={e => setMinutes(e.target.value)} style={miniFieldStyle} />
          <input type="number" min="1" max="5" placeholder="focus" value={focus} onChange={e => setFocus(e.target.value)} style={miniFieldStyle} />
        </div>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Notes (what you covered...)" style={miniFieldStyle} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '6px 10px' }} onClick={cancel}>Cancel</button>
          <button type="button" className="btn" style={{ fontSize: 12, padding: '6px 10px' }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 13 }}>
        <span style={{ color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.subject}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span className="mono" style={{ color: 'var(--muted)', fontSize: 11.5 }}>
            {item.minutes}m{item.focus ? ` · focus ${item.focus}` : ''}
          </span>
          <button type="button" onClick={() => setEditing(true)} aria-label="Edit session" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', padding: 0 }}>&#9998;</button>
          <button type="button" onClick={() => onDelete(item.id)} aria-label="Delete session" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 15, cursor: 'pointer', padding: 0 }}>&times;</button>
        </span>
      </div>
      {item.note && (
        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.note}
        </div>
      )}
    </div>
  );
}

export default function StudyLogger() {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [minutes, setMinutes] = useState('');
  const [focus, setFocus] = useState(3);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [savedFlash, setSavedFlash] = useState('');
  const [items, setItems] = useState([]);

  const [timerSubject, setTimerSubject] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [filledFlash, setFilledFlash] = useState('');
  const timerIntervalRef = useRef(null);
  // Counting "+1 every second" via setInterval drifts badly the moment this tab
  // isn't the active one — browsers throttle (or fully suspend) background
  // interval timers, so switching away to read slides makes the count fall
  // behind real elapsed time. Instead we track the real start timestamp and
  // always compute elapsed time from actual clock time, the same way a phone
  // stopwatch does — the interval below only exists to re-render the display,
  // not to do the counting.
  const runStartRef = useRef(null); // Date.now() when the current running segment began
  const baseSecondsRef = useRef(0); // whole seconds banked from segments before this one (pauses)

  const computeSeconds = useCallback(() => {
    if (runStartRef.current == null) return baseSecondsRef.current;
    return baseSecondsRef.current + Math.floor((Date.now() - runStartRef.current) / 1000);
  }, []);

  function startTimer() {
    runStartRef.current = Date.now();
    setTimerRunning(true);
    setTimerSeconds(computeSeconds());
  }

  function pauseTimer() {
    baseSecondsRef.current = computeSeconds();
    runStartRef.current = null;
    setTimerSeconds(baseSecondsRef.current);
    setTimerRunning(false);
  }

  useEffect(() => {
    if (timerRunning) {
      timerIntervalRef.current = setInterval(() => setTimerSeconds(computeSeconds()), 1000);
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [timerRunning, computeSeconds]);

  // Catch up immediately when the tab becomes visible again, rather than
  // waiting up to a second for the next interval tick.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible' && timerRunning) {
        setTimerSeconds(computeSeconds());
      }
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [timerRunning, computeSeconds]);

  function stopAndFill() {
    const finalSeconds = computeSeconds();
    setTimerRunning(false);
    const mins = Math.max(1, Math.round(finalSeconds / 60));
    setSubject(timerSubject || subject);
    setMinutes(String(mins));
    runStartRef.current = null;
    baseSecondsRef.current = 0;
    setTimerSeconds(0);
    setTimerSubject('');
    setFilledFlash(`Filled in ${mins} minute${mins === 1 ? '' : 's'} below — review and save.`);
    setTimeout(() => setFilledFlash(''), 4000);
  }

  const refresh = useCallback(() => {
    fetch('/api/logs/study').then(r => r.json()).then(d => setItems(d.logs || [])).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function submit(e) {
    e.preventDefault();
    setMsg('');
    if (!subject.trim()) { setMsg('Enter a subject.'); return; }
    if (!(minutes > 0)) { setMsg('Enter minutes studied.'); return; }
    const res = await fetch('/api/logs/study', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: todayStr(), subject: subject.trim(), minutes: parseInt(minutes, 10), focus: Number(focus), note: note || null }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || 'Something went wrong.'); return; }
    setSubject(''); setMinutes(''); setNote('');
    setSavedFlash('Saved.');
    setTimeout(() => setSavedFlash(''), 1500);
    refresh();
    router.refresh();
  }

  async function saveSession(id, fields) {
    await fetch(`/api/logs/study/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: fields.subject,
        minutes: parseInt(fields.minutes, 10) || 0,
        focus: parseInt(fields.focus, 10) || null,
        note: fields.note || null,
      }),
    });
    refresh();
    router.refresh();
  }

  async function deleteSession(id) {
    await fetch(`/api/logs/study/${id}`, { method: 'DELETE' });
    refresh();
    router.refresh();
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Study timer</h3>
          <InfoTip>
            Start it when you sit down, stop it when you're done &mdash; it fills the subject and minutes into the
            form below so you're not tracking time yourself and typing it in afterward.
          </InfoTip>
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label>What are you studying?</label>
          <input
            value={timerSubject}
            onChange={e => setTimerSubject(e.target.value)}
            placeholder="Geometry"
            disabled={timerRunning}
          />
        </div>
        <div className="mono" style={{ fontSize: 40, fontWeight: 700, textAlign: 'center', margin: '18px 0 16px', letterSpacing: '0.02em' }}>
          {formatClock(timerSeconds)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!timerRunning ? (
            <button type="button" className="btn wide" onClick={startTimer}>
              {timerSeconds > 0 ? 'Resume' : 'Start'}
            </button>
          ) : (
            <button type="button" className="btn secondary wide" onClick={pauseTimer}>Pause</button>
          )}
          <button type="button" className="btn secondary wide" onClick={stopAndFill} disabled={timerSeconds === 0}>
            Stop &amp; fill in below
          </button>
        </div>
        {filledFlash && <p style={{ color: 'var(--good)', fontSize: 12.5, marginTop: 10 }}>{filledFlash}</p>}
      </div>

      <form className="card" onSubmit={submit} style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3 style={{ margin: 0 }}>Log a study session</h3>
        <InfoTip>
          Track time spent studying separately from the flashcards and notes below &mdash; reading, problem sets,
          reviewing with others, whatever it was. This feeds the STUDY tile on Today, the chart above, and (once
          you've logged a few) the "Study" part of your Readiness score.
        </InfoTip>
        {savedFlash && <span style={{ color: 'var(--good)', fontSize: 13, fontWeight: 600 }}>{savedFlash}</span>}
      </div>

      {msg && <p className="error-text">{msg}</p>}
      <div className="field">
        <label>Subject</label>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Geometry" required />
      </div>
      <div className="field">
        <label>Minutes</label>
        <input type="number" min="1" value={minutes} onChange={e => setMinutes(e.target.value)} required />
      </div>
      <div className="field">
        <label>Focus (1&ndash;5)</label>
        <input type="number" min="1" max="5" value={focus} onChange={e => setFocus(e.target.value)} />
      </div>
      <div className="field">
        <label>Notes (optional)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="What you covered..." />
      </div>
      <button className="btn wide" style={{ marginTop: 18 }} type="submit">Save session</button>

      {items.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 16 }}>Nothing logged yet.</p>
      ) : (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.slice(0, 8).map(i => (
            <StudyRow key={i.id} item={i} onSave={saveSession} onDelete={deleteSession} />
          ))}
        </div>
      )}
      </form>
    </>
  );
}
