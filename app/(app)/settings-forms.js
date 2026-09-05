'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ActivityIcon from './activity-icon.js';
import { GROCERY_STORE_OPTIONS, KITCHEN_TOOL_OPTIONS, splitKnownOther, joinKnownOther } from './pantry-options.js';

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


function KitchenOptionPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 14px', borderRadius: 'var(--radius-pill)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-strong)'}`,
        background: active ? 'var(--accent-soft)' : 'var(--surface)',
        color: active ? 'var(--accent)' : 'var(--text)',
        fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

export function KitchenForm({ user }) {
  const router = useRouter();
  const gsInit = splitKnownOther(user.grocery_store, GROCERY_STORE_OPTIONS);
  const ktInit = splitKnownOther(user.kitchen_tools, KITCHEN_TOOL_OPTIONS);
  const [stores, setStores] = useState(gsInit.known);
  const [storeOther, setStoreOther] = useState(gsInit.other);
  const [tools, setTools] = useState(ktInit.known);
  const [toolOther, setToolOther] = useState(ktInit.other);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);

  function toggleStore(opt) { setStores(s => s.includes(opt) ? s.filter(x => x !== opt) : [...s, opt]); }
  function toggleTool(opt) { setTools(s => s.includes(opt) ? s.filter(x => x !== opt) : [...s, opt]); }

  const otherInputStyle = {
    width: '100%', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
    background: 'var(--surface-2)', color: 'var(--text)', padding: '10px 12px', fontSize: 14,
    fontFamily: 'inherit',
  };

  async function submit(e) {
    e.preventDefault();
    setMsg(''); setOk(false);
    const res = await fetch('/api/me', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grocery_store: joinKnownOther(stores, storeOther),
        kitchen_tools: joinKnownOther(tools, toolOther),
      }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || 'Something went wrong.'); return; }
    setOk(true);
    router.refresh();
  }

  return (
    <form className="card" onSubmit={submit} style={{ maxWidth: 480, marginTop: 20 }}>
      <h3>Kitchen</h3>
      <p style={{ color: 'var(--text-2)', fontSize: 12.5, marginTop: 4, marginBottom: 16 }}>
        Used by the meal planner to suggest realistic ingredients and recipes you can actually make. Both optional.
      </p>

      <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Grocery stores you shop at</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {GROCERY_STORE_OPTIONS.map(opt => (
          <KitchenOptionPill key={opt} active={stores.includes(opt)} onClick={() => toggleStore(opt)}>{opt}</KitchenOptionPill>
        ))}
      </div>
      <input
        value={storeOther}
        onChange={e => setStoreOther(e.target.value)}
        placeholder="Other store not listed? (optional)"
        style={{ ...otherInputStyle, marginBottom: 20 }}
      />

      <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Kitchen tools you have</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {KITCHEN_TOOL_OPTIONS.map(opt => (
          <KitchenOptionPill key={opt} active={tools.includes(opt)} onClick={() => toggleTool(opt)}>{opt}</KitchenOptionPill>
        ))}
      </div>
      <input
        value={toolOther}
        onChange={e => setToolOther(e.target.value)}
        placeholder="Other tool not listed? (optional)"
        style={otherInputStyle}
      />

      <button className="btn" style={{ marginTop: 16 }} type="submit">Save</button>
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
  const [query, setQuery] = useState('');

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
      setQuery('');
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

  const visible = activities
    ? activities.filter(a => {
        if (!query.trim()) return true;
        const q = query.trim().toLowerCase();
        return a.name.toLowerCase().includes(q) || a.type.toLowerCase().includes(q);
      })
    : [];

  function toggleAllVisible() {
    const visibleIds = visible.map(a => a.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      visibleIds.forEach(id => { if (allVisibleSelected) next.delete(id); else next.add(id); });
      return next;
    });
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

  const visibleIds = visible.map(a => a.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));

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
              <input
                type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder={`Search ${activities.length} activities by name or type…`}
                style={{
                  width: '100%', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-2)', color: 'var(--text)', padding: '8px 10px', fontSize: 13,
                  marginBottom: 10, boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {visible.length} of {activities.length} shown &middot; {selected.size} selected
                </p>
                <button type="button" onClick={toggleAllVisible} disabled={visible.length === 0} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', padding: 0 }}>
                  {allVisibleSelected ? 'Deselect shown' : 'Select shown'}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 340, overflowY: 'auto' }}>
                {visible.map(a => (
                  <label
                    key={a.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 'var(--radius-sm)',
                      background: selected.has(a.id) ? 'var(--surface-2)' : 'transparent', cursor: 'pointer',
                    }}
                  >
                    <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} style={{ flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-2)' }}><ActivityIcon type={a.type} size={19} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.name}
                      </span>
                      <span className="mono" style={{ color: 'var(--muted)', fontSize: 11, display: 'block' }}>
                        {a.type} &middot; {a.date} &middot; {a.minutes}m{a.distanceKm ? ` · ${a.distanceKm} km` : ''}
                      </span>
                    </span>
                  </label>
                ))}
                {visible.length === 0 && (
                  <p style={{ color: 'var(--muted)', fontSize: 12.5, padding: '8px 4px' }}>No activities match &ldquo;{query}&rdquo;.</p>
                )}
              </div>
              <div className="btn-row" style={{ marginTop: 12 }}>
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
        <div className="btn-row" style={{ marginTop: 14 }}>
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

export function AdminPasswordResetsCard() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState('');
  const [copiedToken, setCopiedToken] = useState('');
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/password-resets');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); }, []);

  function linkFor(token) {
    return `${origin}/reset-password?token=${token}`;
  }

  function copy(token) {
    navigator.clipboard.writeText(linkFor(token)).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(''), 1500);
    }).catch(() => {});
  }

  async function generate(e) {
    e.preventDefault();
    setGenMsg(''); setGenerating(true);
    try {
      const res = await fetch('/api/admin/password-resets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setGenMsg(data.error || 'Something went wrong.'); return; }
      setEmail('');
      setGenMsg('Generated — find it in the list below.');
      refresh();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <h3>Password reset requests</h3>
      <p style={{ color: 'var(--text-2)', fontSize: 12.5, marginTop: 4 }}>
        There&rsquo;s no email sending set up, so this is how a friend gets back into their account: they hit
        &ldquo;Forgot your password?&rdquo; on the login page (or you generate one below), then you copy the link
        here and send it to them yourself. Links expire after an hour.
      </p>

      <form onSubmit={generate} style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="friend@email.com" required
          style={{
            flex: 1, minWidth: 0, border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-2)', color: 'var(--text)', padding: '9px 11px', fontSize: 13,
          }}
        />
        <button className="btn secondary" type="submit" disabled={generating}>{generating ? 'Generating…' : 'Generate link'}</button>
      </form>
      {genMsg && <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8 }}>{genMsg}</p>}

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
        {loading ? (
          <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>Loading…</p>
        ) : requests.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>No pending requests.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {requests.map(r => (
              <div key={r.token} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</span>
                <button type="button" className="btn secondary" style={{ fontSize: 12, padding: '6px 12px', flexShrink: 0 }} onClick={() => copy(r.token)}>
                  {copiedToken === r.token ? 'Copied' : 'Copy link'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminUsersCard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState('');

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); }, []);

  async function toggleBan(user) {
    const action = user.banned_at ? 'unban' : 'ban';
    if (action === 'ban' && !window.confirm(`Ban ${user.email}? They'll be signed out everywhere and won't be able to log back in.`)) return;
    setErr(''); setBusyId(user.id);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, action }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Something went wrong.'); return; }
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <h3>Accounts</h3>
      <p style={{ color: 'var(--text-2)', fontSize: 12.5, marginTop: 4 }}>
        Everyone who has signed up. Banning signs someone out everywhere and blocks them from logging back in.
      </p>
      {err && <p className="error-text">{err}</p>}
      <div style={{ marginTop: 14 }}>
        {loading ? (
          <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>Loading…</p>
        ) : users.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>No accounts yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {users.map(u => (
              <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  {u.name ? `${u.name} — ` : ''}{u.email}
                  {u.banned_at && <span style={{ color: 'var(--critical)', marginLeft: 8 }}>Banned</span>}
                </span>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ fontSize: 12, padding: '6px 12px', flexShrink: 0, ...(u.banned_at ? {} : { color: 'var(--critical)', borderColor: 'var(--critical)' }) }}
                  disabled={busyId === u.id}
                  onClick={() => toggleBan(u)}
                >
                  {busyId === u.id ? '…' : u.banned_at ? 'Unban' : 'Ban'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
