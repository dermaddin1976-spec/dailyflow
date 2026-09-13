import FlameMark from './brand-mark.js';

export default function NotFound() {
  return (
    <main style={{ maxWidth: 380, margin: '0 auto', padding: '64px 20px', textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 28 }}>
        <span className="brand-mark"><FlameMark /></span>
        <span style={{ fontWeight: 700, fontSize: 18 }}>DailyFlow</span>
      </div>
      <div className="card">
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Page not found</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 13.5, marginBottom: 18 }}>
          Nothing lives at this address.
        </p>
        <a href="/today" className="btn wide">Back to Today</a>
      </div>
    </main>
  );
}
