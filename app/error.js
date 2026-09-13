'use client';
import { useEffect } from 'react';
import FlameMark from './brand-mark.js';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[app error]', error);
  }, [error]);

  return (
    <main style={{ maxWidth: 380, margin: '0 auto', padding: '64px 20px', textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 28 }}>
        <span className="brand-mark"><FlameMark /></span>
        <span style={{ fontWeight: 700, fontSize: 18 }}>DailyFlow</span>
      </div>
      <div className="card">
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13.5, marginBottom: 18 }}>
          That's on us, not you. Give it another try, and if it keeps happening let Arthur know.
        </p>
        <button type="button" className="btn wide" onClick={() => reset()}>Try again</button>
        <a href="/today" className="btn secondary wide" style={{ marginTop: 10, display: 'block' }}>Back to Today</a>
      </div>
    </main>
  );
}
