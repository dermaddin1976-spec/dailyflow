'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import FlameMark from '../brand-mark.js';

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setMsg('');
    if (password !== confirm) { setMsg("Those passwords don't match."); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/password-reset/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || 'Something went wrong.'); return; }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 380, margin: '0 auto', padding: '64px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <span className="brand-mark"><FlameMark /></span>
        <span style={{ fontWeight: 700, fontSize: 18 }}>DailyFlow</span>
      </div>
      <div className="card">
        {!token ? (
          <>
            <h1 style={{ fontSize: 20, marginBottom: 4 }}>Missing link</h1>
            <p style={{ color: 'var(--text-2)', fontSize: 13.5 }}>
              This page needs a reset link — use the one you were sent, or request a new one from the login page.
            </p>
          </>
        ) : done ? (
          <>
            <h1 style={{ fontSize: 20, marginBottom: 4 }}>Password updated</h1>
            <p style={{ color: 'var(--text-2)', fontSize: 13.5, marginBottom: 18 }}>
              You&rsquo;ve been signed out everywhere for safety — log in again with your new password.
            </p>
            <a className="btn wide" href="/login">Go to login</a>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 20, marginBottom: 4 }}>Set a new password</h1>
            <p style={{ color: 'var(--text-2)', fontSize: 13.5, marginBottom: 4 }}>Pick something you haven&rsquo;t used before.</p>
            <form onSubmit={submit}>
              <div className="field">
                <label>New password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
              </div>
              <div className="field">
                <label>Confirm new password</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} />
              </div>
              <button className="btn wide" style={{ marginTop: 20 }} type="submit" disabled={submitting}>
                {submitting ? 'Updating…' : 'Update password'}
              </button>
            </form>
            {msg && <p className="error-text">{msg}</p>}
          </>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
