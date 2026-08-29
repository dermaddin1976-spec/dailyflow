'use client';
import { useState } from 'react';
import FlameMark from '../brand-mark.js';

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');

  const [forgotSent, setForgotSent] = useState('');

  async function submit(e) {
    e.preventDefault();
    setMsg('');
    if (mode === 'forgot') {
      const res = await fetch('/api/password-reset/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || 'Something went wrong.'); return; }
      setForgotSent(data.message);
      return;
    }
    const url = mode === 'login' ? '/api/login' : '/api/signup';
    const body = mode === 'login' ? { email, password } : { email, password, name };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error || 'Something went wrong.'); return; }
    window.location.href = '/today';
  }

  return (
    <main style={{ maxWidth: 380, margin: '0 auto', padding: '64px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <span className="brand-mark"><FlameMark /></span>
        <span style={{ fontWeight: 700, fontSize: 18 }}>DailyFlow</span>
      </div>
      <div className="card">
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>
          {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password'}
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13.5, marginBottom: 4 }}>
          {mode === 'login' ? 'Log in to see your day.' : mode === 'signup' ? 'Health, school, and nutrition — one calm dashboard.' : "We'll generate a reset link for this email, if it has an account."}
        </p>

        {mode === 'forgot' && forgotSent ? (
          <>
            <p style={{ fontSize: 13.5, marginTop: 14 }}>{forgotSent}</p>
            <button
              className="btn secondary wide"
              style={{ marginTop: 16 }}
              onClick={() => { setForgotSent(''); setMode('login'); }}
            >
              Back to login
            </button>
          </>
        ) : (
          <>
            <form onSubmit={submit}>
              {mode === 'signup' && (
                <div className="field">
                  <label>Name</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
                </div>
              )}
              <div className="field">
                <label>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              {mode !== 'forgot' && (
                <div className="field">
                  <label>Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
                </div>
              )}
              <button className="btn wide" style={{ marginTop: 20 }} type="submit">
                {mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Send reset request'}
              </button>
            </form>
            {msg && <p className="error-text">{msg}</p>}

            {mode === 'login' && (
              <button
                type="button"
                onClick={() => setMode('forgot')}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12.5, cursor: 'pointer', padding: 0, marginTop: 14, display: 'block' }}
              >
                Forgot your password?
              </button>
            )}

            <button
              className="btn secondary wide"
              style={{ marginTop: 10 }}
              onClick={() => { setMsg(''); setMode(mode === 'signup' ? 'login' : mode === 'forgot' ? 'login' : 'signup'); }}
            >
              {mode === 'login' ? 'Need an account? Sign up' : mode === 'signup' ? 'Have an account? Log in' : 'Back to login'}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
