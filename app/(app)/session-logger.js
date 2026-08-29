'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import InfoTip from './info-tip.js';
import ActivityIcon from './activity-icon.js';

function todayStr(){ return new Date().toISOString().slice(0,10); }

function formatPace(minPerKm) {
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return mins + ':' + String(secs).padStart(2, '0') + '/km';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const TYPE_PRESETS = ['Run', 'Gym / Strength', 'Football', 'Basketball', 'Swim', 'Cycling', 'Tennis', 'Walk', 'Yoga', 'Other'];

const TYPE_SYNONYMS = {
  run: 'Run', running: 'Run', jog: 'Run', jogging: 'Run',
  ride: 'Cycling', cycling: 'Cycling', bike: 'Cycling', biking: 'Cycling',
  strength: 'Gym / Strength', gym: 'Gym / Strength', weights: 'Gym / Strength', weightlifting: 'Gym / Strength', lifting: 'Gym / Strength',
  swim: 'Swim', swimming: 'Swim',
  football: 'Football', soccer: 'Football',
  basketball: 'Basketball',
  tennis: 'Tennis',
  walk: 'Walk', walking: 'Walk', hike: 'Walk', hiking: 'Walk',
  yoga: 'Yoga',
};

function matchPreset(aiType) {
  if (!aiType) return null;
  const norm = aiType.trim().toLowerCase();
  const exact = TYPE_PRESETS.find(t => t !== 'Other' && t.toLowerCase() === norm);
  if (exact) return exact;
  for (const key in TYPE_SYNONYMS) {
    if (norm.includes(key)) return TYPE_SYNONYMS[key];
  }
  return null;
}

const miniFieldStyle = {
  border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
  background: 'var(--surface)', color: 'var(--text)', padding: '6px 8px',
  fontSize: 12.5, fontFamily: 'inherit', width: '100%',
};

function WorkoutRow({ item, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState(item.type);
  const [minutes, setMinutes] = useState(item.minutes ?? '');
  const [intensity, setIntensity] = useState(item.intensity ?? '');
  const [note, setNote] = useState(item.note ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onSave(item.id, { type, minutes, intensity, note });
    setSaving(false);
    setEditing(false);
  }

  function cancel() {
    setType(item.type); setMinutes(item.minutes ?? ''); setIntensity(item.intensity ?? ''); setNote(item.note ?? '');
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 10, background: 'var(--surface-2)' }}>
        <input value={type} onChange={e => setType(e.target.value)} style={{ ...miniFieldStyle, marginBottom: 6 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <input type="number" min="1" placeholder="minutes" value={minutes} onChange={e => setMinutes(e.target.value)} style={miniFieldStyle} />
          <input type="number" min="1" max="5" placeholder="intensity" value={intensity} onChange={e => setIntensity(e.target.value)} style={miniFieldStyle} />
        </div>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Notes (distance, pace, HR...)" style={miniFieldStyle} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '6px 10px' }} onClick={cancel}>Cancel</button>
          <button type="button" className="btn" style={{ fontSize: 12, padding: '6px 10px' }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    );
  }

  const isRun = /run/i.test(item.type || '');
  const paceStr = (isRun && item.distance_km > 0 && item.minutes > 0) ? formatPace(item.minutes / item.distance_km) : null;
  const metaParts = [
    item.title ? item.type : null,
    item.date,
    item.minutes ? `${item.minutes}m` : null,
    item.distance_km ? `${item.distance_km} km` : null,
    paceStr,
    item.intensity ? `intensity ${item.intensity}` : null,
  ].filter(Boolean);
  const showNote = item.note && item.note !== 'Synced from Strava';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
          <span style={{ color: 'var(--text-2)', marginTop: 1 }}><ActivityIcon type={item.type} size={18} /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.title || item.type}
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
              {metaParts.join(' · ')}
            </div>
          </div>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button type="button" onClick={() => setEditing(true)} aria-label="Edit session" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', padding: 0 }}>&#9998;</button>
          <button type="button" onClick={() => { if (window.confirm('Delete this session?')) onDelete(item.id); }} aria-label="Delete session" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 15, cursor: 'pointer', padding: 0 }}>&times;</button>
        </span>
      </div>
      {showNote && (
        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, marginLeft: 28, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.note}
        </div>
      )}
    </div>
  );
}

export default function SessionLogger() {
  const router = useRouter();
  const [typeChoice, setTypeChoice] = useState('Run');
  const [customType, setCustomType] = useState('');
  const [minutes, setMinutes] = useState('');
  const [intensity, setIntensity] = useState(3);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [savedFlash, setSavedFlash] = useState('');
  const [items, setItems] = useState([]);
  const [historyQuery, setHistoryQuery] = useState('');

  const [estimating, setEstimating] = useState(false);
  const [estimateMsg, setEstimateMsg] = useState('');

  const refresh = useCallback(() => {
    fetch('/api/logs/workout').then(r => r.json()).then(d => setItems(d.logs || [])).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function submit(e) {
    e.preventDefault();
    setMsg('');
    const type = typeChoice === 'Other' ? customType.trim() : typeChoice;
    if (!type) { setMsg('Enter a workout type.'); return; }
    const res = await fetch('/api/logs/workout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: todayStr(), type, minutes: parseInt(minutes, 10), intensity: Number(intensity), note: note || null }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || 'Something went wrong.'); return; }
    setMinutes(''); setCustomType(''); setNote(''); setEstimateMsg('');
    setSavedFlash('Saved.');
    setTimeout(() => setSavedFlash(''), 1500);
    refresh();
    router.refresh();
  }

  async function handleScreenshots(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setEstimating(true); setEstimateMsg('');
    try {
      const images = await Promise.all(files.map(async f => ({ base64: await fileToBase64(f), mimeType: f.type || 'image/jpeg' })));
      const res = await fetch('/api/ai/workout-from-screenshot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });
      const data = await res.json();
      if (!res.ok) { setEstimateMsg(data.error || 'Read failed.'); return; }
      const preset = matchPreset(data.type);
      if (preset) { setTypeChoice(preset); setCustomType(''); }
      else { setTypeChoice('Other'); setCustomType(data.type || ''); }
      setMinutes(data.minutes ? String(data.minutes) : '');
      if (data.intensity) setIntensity(data.intensity);
      setNote(data.summary || '');
      setEstimateMsg(`DailyAI read (${data.confidence || 'medium'} confidence) — review before saving.`);
    } catch (err) {
      setEstimateMsg('Something went wrong reading those screenshots.');
    } finally {
      setEstimating(false);
    }
  }

  async function saveWorkout(id, fields) {
    await fetch(`/api/logs/workout/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: fields.type,
        minutes: parseInt(fields.minutes, 10) || 0,
        intensity: parseInt(fields.intensity, 10) || null,
        note: fields.note || null,
      }),
    });
    refresh();
    router.refresh();
  }

  async function deleteWorkout(id) {
    await fetch(`/api/logs/workout/${id}`, { method: 'DELETE' });
    refresh();
    router.refresh();
  }

  return (
    <form className="card" onSubmit={submit}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3 style={{ margin: 0 }}>Log a session</h3>
        <InfoTip>
          Upload one or more screenshots of a workout &mdash; from Strava, Apple Fitness, a Garmin app, whatever you've
          got &mdash; and DailyAI reads the type, duration, and effort straight off them, plus any other stats it can
          see (distance, pace, heart rate...) into the notes field. Same rule as the meal photos: it's a starting
          point, so check it over before saving.
        </InfoTip>
        {savedFlash && <span style={{ color: 'var(--good)', fontSize: 13, fontWeight: 600 }}>{savedFlash}</span>}
      </div>

      <label className="btn secondary wide" style={{ display: 'inline-block', textAlign: 'center', marginTop: 14 }}>
        {estimating ? (<><span className="spinner" />Reading screenshots…</>) : 'Upload workout screenshot(s)'}
        <input type="file" accept="image/*" multiple onChange={handleScreenshots} disabled={estimating} style={{ display: 'none' }} />
      </label>
      {estimateMsg && <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8 }}>{estimateMsg}</p>}

      {msg && <p className="error-text">{msg}</p>}
      <div className="field">
        <label>Type</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
          {TYPE_PRESETS.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeChoice(t)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 14px', borderRadius: 'var(--radius-pill)',
                border: `1px solid ${typeChoice === t ? 'var(--accent)' : 'var(--border-strong)'}`,
                background: typeChoice === t ? 'var(--accent-soft)' : 'var(--surface)',
                color: typeChoice === t ? 'var(--accent)' : 'var(--text)',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              <ActivityIcon type={t} size={15} />
              {t}
            </button>
          ))}
        </div>
      </div>
      {typeChoice === 'Other' && (
        <div className="field">
          <label>What kind?</label>
          <input value={customType} onChange={e => setCustomType(e.target.value)} placeholder="Climbing, hiking..." required />
        </div>
      )}
      <div className="field">
        <label>Minutes</label>
        <input type="number" min="1" value={minutes} onChange={e => setMinutes(e.target.value)} required />
      </div>
      <div className="field">
        <label>Intensity (1&ndash;5)</label>
        <input type="number" min="1" max="5" value={intensity} onChange={e => setIntensity(e.target.value)} />
      </div>
      <div className="field">
        <label>Notes (optional)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Distance, pace, heart rate..." />
      </div>
      <button className="btn wide" style={{ marginTop: 18 }} type="submit">Save session</button>

      {items.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 16 }}>Nothing logged yet.</p>
      ) : (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {items.length > 5 && (
            <input
              type="text" value={historyQuery} onChange={e => setHistoryQuery(e.target.value)}
              placeholder={`Search ${items.length} sessions…`}
              style={{ ...miniFieldStyle, marginBottom: 10 }}
            />
          )}
          {(() => {
            const q = historyQuery.trim().toLowerCase();
            const filtered = q
              ? items.filter(i => (i.title || '').toLowerCase().includes(q) || (i.type || '').toLowerCase().includes(q) || (i.note || '').toLowerCase().includes(q))
              : items;
            if (filtered.length === 0) {
              return <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>No sessions match &ldquo;{historyQuery}&rdquo;.</p>;
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 420, overflowY: 'auto' }}>
                {filtered.map(i => (
                  <WorkoutRow key={i.id} item={i} onSave={saveWorkout} onDelete={deleteWorkout} />
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </form>
  );
}
