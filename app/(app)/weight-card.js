'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import InfoTip from './info-tip.js';
import { WeightChart } from './weight-chart.js';

function todayStr() { return new Date().toISOString().slice(0, 10); }

const fieldStyle = {
  border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
  background: 'var(--surface-2)', color: 'var(--text)', padding: '9px 11px', fontSize: 13.5, fontFamily: 'inherit',
};

export default function WeightCard({ initialWeightKg }) {
  const router = useRouter();
  const [weight, setWeight] = useState(initialWeightKg ? String(initialWeightKg) : '');
  const [date, setDate] = useState(todayStr());
  const [msg, setMsg] = useState('');
  const [savedFlash, setSavedFlash] = useState('');
  const [entries, setEntries] = useState([]);

  const refresh = useCallback(() => {
    fetch('/api/logs/weight').then(r => r.json()).then(d => setEntries(d.logs || [])).catch(() => {});
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function submit(e) {
    e.preventDefault();
    setMsg('');
    const w = parseFloat(weight);
    if (!(w > 0)) { setMsg('Enter a weight.'); return; }
    const res = await fetch('/api/logs/weight', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, weight_kg: w }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || 'Something went wrong.'); return; }
    setSavedFlash('Saved.');
    setTimeout(() => setSavedFlash(''), 1500);
    refresh();
    router.refresh();
  }

  async function deleteEntry(id) {
    await fetch(`/api/logs/weight/${id}`, { method: 'DELETE' });
    refresh();
    router.refresh();
  }

  const chartEntries = [...entries].reverse();

  return (
    <div className="card" style={{ maxWidth: 420, marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3 style={{ margin: 0 }}>Weight</h3>
        <InfoTip>
          Log your weight here, or sync it automatically from Apple Health above &mdash; either way it feeds this
          trend line and keeps your body profile current for calorie targets. One entry per day; logging the same
          day again updates it rather than adding a duplicate.
        </InfoTip>
        {savedFlash && <span style={{ color: 'var(--good)', fontSize: 13, fontWeight: 600 }}>{savedFlash}</span>}
      </div>

      <div style={{ marginTop: 14 }}>
        {entries.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>Nothing logged yet.</p>
        ) : (
          <WeightChart entries={chartEntries} />
        )}
      </div>

      <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <input
          type="number" step="0.1" min="0" placeholder="kg" value={weight}
          onChange={e => setWeight(e.target.value)} style={{ ...fieldStyle, flex: 1 }}
        />
        <input
          type="date" value={date} onChange={e => setDate(e.target.value)} max={todayStr()} style={fieldStyle}
        />
        <button className="btn secondary" type="submit">Log</button>
      </form>
      {msg && <p className="error-text" style={{ marginTop: 8 }}>{msg}</p>}

      {entries.length > 0 && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.slice(0, 6).map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
              <span style={{ color: 'var(--text-2)' }}>{e.date}{e.source === 'apple_health' ? ' · Apple Health' : ''}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mono" style={{ color: 'var(--muted)' }}>{e.weight_kg} kg</span>
                <button
                  type="button" onClick={() => deleteEntry(e.id)} aria-label="Delete entry"
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 14, cursor: 'pointer', padding: 0 }}
                >
                  &times;
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
