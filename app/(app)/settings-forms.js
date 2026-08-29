'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function ProfileForm({ user }) {
  const router = useRouter();
  const [name, setName] = useState(user.name || '');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setMsg(''); setOk(false);
    const res = await fetch('/api/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || 'Something went wrong.'); return; }
    setOk(true);
    router.refresh();
  }

  return (
    <form className="card" onSubmit={submit} style={{ maxWidth: 420 }}>
      <h3>Profile</h3>
      <div className="field">
        <label>Name</label>
        <input value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Email</label>
        <input value={user.email} disabled />
      </div>
      <button className="btn" style={{ marginTop: 16 }} type="submit">Save profile</button>
      {ok && <span style={{ marginLeft: 12, color: 'var(--good)', fontSize: 13 }}>Saved.</span>}
      {msg && <p className="error-text">{msg}</p>}
    </form>
  );
}

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary — little to no exercise' },
  { value: 'light', label: 'Light — exercise 1-3 days/week' },
  { value: 'moderate', label: 'Moderate — exercise 3-5 days/week' },
  { value: 'active', label: 'Active — exercise 6-7 days/week' },
  { value: 'very_active', label: 'Very active — hard training or physical job' },
];

const GOALS = [
  { value: 'lose', label: 'Lose weight' },
  { value: 'maintain', label: 'Maintain weight' },
  { value: 'gain', label: 'Gain weight' },
];

export function BodyForm({ user }) {
  const router = useRouter();
  const [age, setAge] = useState(user.age || '');
  const [weight, setWeight] = useState(user.weight_kg || '');
  const [height, setHeight] = useState(user.height_cm || '');
  const [sex, setSex] = useState(user.sex || '');
  const [activity, setActivity] = useState(user.activity_level || '');
  const [goal, setGoal] = useState(user.goal || 'maintain');
  const [targetWeight, setTargetWeight] = useState(user.target_weight_kg || '');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setMsg(''); setOk(false);
    const res = await fetch('/api/me', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ age, weight_kg: weight, height_cm: height, sex, activity_level: activity, goal, target_weight_kg: goal === 'maintain' ? '' : targetWeight }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || 'Something went wrong.'); return; }
    setOk(true);
    router.refresh();
  }

  return (
    <form className="card" onSubmit={submit} style={{ maxWidth: 420, marginTop: 20 }}>
      <h3>Body &amp; goals</h3>
      <p style={{ color: 'var(--text-2)', fontSize: 12.5, marginTop: 4 }}>
        Used to work out a daily calorie and macro target on the Nutrition tab. Nothing here is shared or shown to anyone else.
      </p>
      <div className="field">
        <label>Age</label>
        <input type="number" min="10" max="100" value={age} onChange={e => setAge(e.target.value)} required />
      </div>
      <div className="field">
        <label>Weight (kg)</label>
        <input type="number" min="30" max="300" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} required />
      </div>
      <div className="field">
        <label>Height (cm)</label>
        <input type="number" min="100" max="250" value={height} onChange={e => setHeight(e.target.value)} required />
      </div>
      <div className="field">
        <label>Sex</label>
        <select value={sex} onChange={e => setSex(e.target.value)} required>
          <option value="" disabled>Select...</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
        </select>
      </div>
      <div className="field">
        <label>Activity level</label>
        <select value={activity} onChange={e => setActivity(e.target.value)} required>
          <option value="" disabled>Select...</option>
          {ACTIVITY_LEVELS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Goal</label>
        <select value={goal} onChange={e => setGoal(e.target.value)}>
          {GOALS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </div>
      {goal !== 'maintain' && (
        <div className="field">
          <label>Target weight (kg)</label>
          <input type="number" min="30" max="300" step="0.1" value={targetWeight} onChange={e => setTargetWeight(e.target.value)} placeholder="e.g. 75" />
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            Optional, but it lets DailyFlow pace your calorie target off how far you actually have to go, and estimate a timeline.
          </span>
        </div>
      )}
      <button className="btn" style={{ marginTop: 16 }} type="submit">Save &amp; recalculate</button>
      {ok && <span style={{ marginLeft: 12, color: 'var(--good)', fontSize: 13 }}>Saved.</span>}
      {msg && <p className="error-text">{msg}</p>}
    </form>
  );
}

export function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setMsg(''); setOk(false);
    const res = await fetch('/api/account/password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || 'Something went wrong.'); return; }
    setOk(true); setCurrent(''); setNext('');
  }

  return (
    <form className="card" onSubmit={submit} style={{ maxWidth: 420, marginTop: 20 }}>
      <h3>Change password</h3>
      <div className="field">
        <label>Current password</label>
        <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required />
      </div>
      <div className="field">
        <label>New password</label>
        <input type="password" value={next} onChange={e => setNext(e.target.value)} required minLength={8} />
      </div>
      <button className="btn" style={{ marginTop: 16 }} type="submit">Update password</button>
      {ok && <span style={{ marginLeft: 12, color: 'var(--good)', fontSize: 13 }}>Updated.</span>}
      {msg && <p className="error-text">{msg}</p>}
    </form>
  );
}

export function StravaConnectionCard({ connected, status }) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);

  async function disconnect() {
    if (!window.confirm('Disconnect Strava? Activities already synced stay in your log.')) return;
    setDisconnecting(true);
    await fetch('/api/integrations/strava/disconnect', { method: 'POST' });
    setDisconnecting(false);
    router.refresh();
  }

  return (
    <div className="card" style={{ maxWidth: 420, marginTop: 20 }}>
      <h3>Connected accounts</h3>

      {status === 'not_configured' && (
        <p className="error-text" style={{ marginTop: 8 }}>
          Strava isn&rsquo;t set up yet — add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET to .env.local first (see below).
        </p>
      )}
      {status === 'error' && (
        <p className="error-text" style={{ marginTop: 8 }}>Couldn&rsquo;t connect to Strava. Try again.</p>
      )}
      {status === 'connected' && (
        <p style={{ color: 'var(--good)', fontSize: 13, marginTop: 8 }}>Connected.</p>
      )}

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <p style={{ fontWeight: 600, fontSize: 14 }}>Strava</p>
            <p style={{ color: 'var(--text-2)', fontSize: 12.5 }}>
              {connected ? 'Connected — head to the Sport page to import workouts.' : 'Sync your runs, rides and workouts automatically.'}
            </p>
          </div>
          {connected ? (
            <span className="mono" style={{ fontSize: 11, color: 'var(--good)', flexShrink: 0 }}>Connected</span>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {connected ? (
            <button className="btn secondary" onClick={disconnect} disabled={disconnecting}>
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          ) : (
            <a className="btn" href="/api/integrations/strava/connect">Connect Strava</a>
          )}
        </div>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 16 }}>
        Google Calendar and other integrations come later.
      </p>
    </div>
  );
}

export function StravaImportCard({ connected }) {
  const router = useRouter();
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [activities, setActivities] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [importing, setImporting] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  if (!connected) return null;

  async function openPicker() {
    setSyncMsg('');
    setLoadingActivities(true);
    try {
      const res = await fetch('/api/integrations/strava/activities');
      const data = await res.json();
      if (!res.ok) { setSyncMsg(data.error || 'Could not load activities.'); return; }
      setActivities(data.activities);
      setSelected(new Set(data.activities.map(a => a.id)));
    } catch (err) {
      setSyncMsg('Something went wrong reaching Strava.');
    } finally {
      setLoadingActivities(false);
    }
  }

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!activities) return;
    setSelected(prev => (prev.size === activities.length ? new Set() : new Set(activities.map(a => a.id))));
  }

  async function importSelected() {
    setImporting(true); setSyncMsg('');
    try {
      const res = await fetch('/api/integrations/strava/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) { setSyncMsg(data.error || 'Import failed.'); return; }
      setSyncMsg(data.added > 0 ? `Added ${data.added} new activit${data.added === 1 ? 'y' : 'ies'}.` : 'Nothing imported.');
      setActivities(null);
      router.refresh();
    } catch (err) {
      setSyncMsg('Something went wrong reaching Strava.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0 }}>Strava</h3>
          <p style={{ color: 'var(--text-2)', fontSize: 12.5, marginTop: 4 }}>
            Choose which runs, rides and workouts to bring into your training log.
          </p>
        </div>
        {!activities && (
          <button className="btn secondary" onClick={openPicker} disabled={loadingActivities}>
            {loadingActivities ? (<><span className="spinner" />Checking Strava…</>) : 'Import workouts'}
          </button>
        )}
      </div>

      {activities && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          {activities.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>No new activities on Strava &mdash; you&rsquo;re already up to date.</p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <p style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{activities.length} new on Strava &mdash; pick which to import</p>
                <button type="button" onClick={toggleAll} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', padding: 0 }}>
                  {selected.size === activities.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                {activities.map(a => (
                  <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '6px 8px', borderRadius: 6, background: selected.has(a.id) ? 'var(--surface-2, rgba(127,127,127,.08))' : 'transparent', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block' }}>{a.name}</span>
                      <span className="mono" style={{ color: 'var(--muted)', fontSize: 11 }}>
                        {a.date} · {a.type} · {a.minutes}m{a.distanceKm ? ` · ${a.distanceKm} km` : ''}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn" onClick={importSelected} disabled={importing || selected.size === 0}>
                  {importing ? (<><span className="spinner" />Importing…</>) : `Import selected (${selected.size})`}
                </button>
                <button className="btn secondary" onClick={() => setActivities(null)} disabled={importing}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      {syncMsg && <p style={{ fontSize: 12.5, marginTop: 10, color: 'var(--text-2)' }}>{syncMsg}</p>}
    </div>
  );
}

export function AppleHealthCard({ connected }) {
  const router = useRouter();
  const [revealedToken, setRevealedToken] = useState('');
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWebhookUrl(`${window.location.origin}/api/integrations/apple-health/sync`);
    }
  }, []);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/account/apple-health', { method: 'POST' });
      const data = await res.json();
      if (res.ok) setRevealedToken(data.token);
      router.refresh();
    } finally {
      setGenerating(false);
    }
  }

  async function revoke() {
    if (!window.confirm('Revoke your Apple Health access token? Your Shortcut will stop working until you generate a new one.')) return;
    setRevoking(true);
    await fetch('/api/account/apple-health', { method: 'DELETE' });
    setRevealedToken('');
    setRevoking(false);
    router.refresh();
  }

  function copyToken() {
    navigator.clipboard.writeText(revealedToken).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  return (
    <div className="card" style={{ maxWidth: 420, marginTop: 20 }}>
      <h3>Apple Health</h3>
      <p style={{ color: 'var(--text-2)', fontSize: 12.5, marginTop: 4 }}>
        Sync sleep, weight, and workouts from a Shortcuts automation on your phone &mdash; Apple doesn&rsquo;t offer
        a direct web connection, so this uses an access token your Shortcut sends along with the data instead.
      </p>

      {revealedToken ? (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 6 }}>Copy this now &mdash; it won&rsquo;t be shown again.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              readOnly
              value={revealedToken}
              onFocus={e => e.target.select()}
              style={{
                flex: 1, fontFamily: 'monospace', fontSize: 12, border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', color: 'var(--text)', padding: '9px 11px',
              }}
            />
            <button className="btn secondary" type="button" onClick={copyToken}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
          <button className="btn secondary" onClick={generate} disabled={generating}>
            {generating ? 'Generating…' : connected ? 'Regenerate token' : 'Generate access token'}
          </button>
          {connected && (
            <button className="btn secondary" onClick={revoke} disabled={revoking}>
              {revoking ? 'Revoking…' : 'Revoke'}
            </button>
          )}
        </div>
      )}

      {connected && !revealedToken && (
        <p style={{ fontSize: 12, color: 'var(--good)', marginTop: 10 }}>A token is active.</p>
      )}

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Webhook URL for your Shortcut</p>
        <code style={{
          display: 'block', fontSize: 11.5, wordBreak: 'break-all', color: 'var(--muted)',
          background: 'var(--surface-2)', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
        }}>
          {webhookUrl || '…'}
        </code>
        <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>
          POST JSON here with header <code>Authorization: Bearer &lt;your token&gt;</code> and a body like{' '}
          <code>{'{"date":"2026-08-28","sleep_hours":7.5,"weight_kg":68.2,"workout_minutes":45,"workout_type":"Run"}'}</code>.
          Send only the fields you have that day &mdash; each sync replaces that day&rsquo;s Apple Health entry rather
          than adding a duplicate.
        </p>
      </div>
    </div>
  );
}
