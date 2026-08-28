'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import InfoTip from './info-tip.js';

function todayStr(){ return new Date().toISOString().slice(0,10); }

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const miniFieldStyle = { border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', color: 'var(--text)', padding: '6px 8px', fontSize: 12.5, fontFamily: 'inherit', width: '100%' };

function SleepRow({ item, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [hours, setHours] = useState(item.hours ?? '');
  const [quality, setQuality] = useState(item.quality ?? '');
  const [note, setNote] = useState(item.note ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onSave(item.id, { hours, quality, note });
    setSaving(false);
    setEditing(false);
  }

  function cancel() {
    setHours(item.hours ?? ''); setQuality(item.quality ?? ''); setNote(item.note ?? '');
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 10, background: 'var(--surface-2)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <input type="number" step="0.1" min="0" placeholder="hours" value={hours} onChange={e => setHours(e.target.value)} style={miniFieldStyle} />
          <input type="number" min="1" max="5" placeholder="quality" value={quality} onChange={e => setQuality(e.target.value)} style={miniFieldStyle} />
        </div>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Notes (stages, RHR, bedtime...)" style={miniFieldStyle} />
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
        <span style={{ color: 'var(--text-2)' }}>{item.date}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span className="mono" style={{ color: 'var(--muted)', fontSize: 11.5 }}>
            {item.hours}h{item.quality ? ` · quality ${item.quality}` : ''}
          </span>
          <button type="button" onClick={() => setEditing(true)} aria-label="Edit night" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', padding: 0 }}>&#9998;</button>
          <button type="button" onClick={() => onDelete(item.id)} aria-label="Delete night" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 15, cursor: 'pointer', padding: 0 }}>&times;</button>
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

export default function SleepLogger() {
  const router = useRouter();
  const [hours, setHours] = useState('');
  const [quality, setQuality] = useState(3);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [savedFlash, setSavedFlash] = useState('');
  const [items, setItems] = useState([]);

  const [estimating, setEstimating] = useState(false);
  const [estimateMsg, setEstimateMsg] = useState('');

  const refresh = useCallback(() => {
    fetch('/api/logs/sleep').then(r => r.json()).then(d => setItems(d.logs || [])).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function submit(e) {
    e.preventDefault();
    setMsg('');
    if (!(hours >= 0)) { setMsg('Enter hours slept.'); return; }
    const res = await fetch('/api/logs/sleep', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: todayStr(), hours: Number(hours), quality: Number(quality), note: note || null }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || 'Something went wrong.'); return; }
    setHours(''); setNote(''); setEstimateMsg('');
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
      const res = await fetch('/api/ai/sleep-from-screenshot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });
      const data = await res.json();
      if (!res.ok) { setEstimateMsg(data.error || 'Read failed.'); return; }
      setHours(data.hours ? String(data.hours) : '');
      if (data.quality) setQuality(data.quality);
      setNote(data.summary || '');
      setEstimateMsg(`DailyAI read (${data.confidence || 'medium'} confidence) — review before saving.`);
    } catch (err) {
      setEstimateMsg('Something went wrong reading those screenshots.');
    } finally {
      setEstimating(false);
    }
  }

  async function saveSleep(id, fields) {
    await fetch(`/api/logs/sleep/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hours: parseFloat(fields.hours) || 0,
        quality: parseInt(fields.quality, 10) || null,
        note: fields.note || null,
      }),
    });
    refresh();
    router.refresh();
  }

  async function deleteSleep(id) {
    await fetch(`/api/logs/sleep/${id}`, { method: 'DELETE' });
    refresh();
    router.refresh();
  }

  return (
    <form className="card" onSubmit={submit}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3 style={{ margin: 0 }}>Log last night</h3>
        <InfoTip>
          Upload one or more screenshots of a sleep summary &mdash; from Apple Health, the Apple Watch Sleep app,
          Bevel, Oura, Garmin, Whoop, whatever you've got &mdash; and DailyAI reads hours slept and a quality estimate
          straight off them, plus any other stats it can see (stages, resting heart rate, bedtime/wake time...) into
          the notes field. Same rule as the meal photos and workout screenshots: it's a starting point, so check it
          over before saving.
        </InfoTip>
        {savedFlash && <span style={{ color: 'var(--good)', fontSize: 13, fontWeight: 600 }}>{savedFlash}</span>}
      </div>

      <label className="btn secondary wide" style={{ display: 'inline-block', textAlign: 'center', marginTop: 14 }}>
        {estimating ? (<><span className="spinner" />Reading screenshots…</>) : 'Upload sleep screenshot(s)'}
        <input type="file" accept="image/*" multiple onChange={handleScreenshots} disabled={estimating} style={{ display: 'none' }} />
      </label>
      {estimateMsg && <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8 }}>{estimateMsg}</p>}

      {msg && <p className="error-text">{msg}</p>}
      <div className="field">
        <label>Hours slept</label>
        <input type="number" step="0.1" min="0" value={hours} onChange={e => setHours(e.target.value)} required />
      </div>
      <div className="field">
        <label>Quality (1&ndash;5)</label>
        <input type="number" min="1" max="5" value={quality} onChange={e => setQuality(e.target.value)} />
      </div>
      <div className="field">
        <label>Notes (optional)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Stages, RHR, bedtime..." />
      </div>
      <button className="btn wide" style={{ marginTop: 18 }} type="submit">Save night</button>

      {items.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 16 }}>Nothing logged yet.</p>
      ) : (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.slice(0, 8).map(i => (
            <SleepRow key={i.id} item={i} onSave={saveSleep} onDelete={deleteSleep} />
          ))}
        </div>
      )}
    </form>
  );
}
