'use client';
import { useEffect, useState } from 'react';
import FlameMark from '../brand-mark.js';

const SESSION_KEY = 'df_splash_shown';

function greetingFor(hour) {
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

// A brief, once-per-browser-session intro: the mark pops in, then the
// time-of-day greeting fades in beside it, then the whole thing dissolves
// into the app underneath (which is already mounted behind it the whole
// time — this is a pure overlay, not a route or a loading gate).
export default function IntroSplash({ name }) {
  const [phase, setPhase] = useState(null); // null (deciding) | logo | greeting | out | done

  useEffect(() => {
    let already;
    try { already = sessionStorage.getItem(SESSION_KEY); } catch (err) { already = '1'; }
    if (already) { setPhase('done'); return; }
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (err) { /* ignore */ }

    setPhase('logo');
    const t1 = setTimeout(() => setPhase('greeting'), 550);
    const t2 = setTimeout(() => setPhase('out'), 1900);
    const t3 = setTimeout(() => setPhase('done'), 2450);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  if (phase === null || phase === 'done') return null;

  const greeting = greetingFor(new Date().getHours());
  const greetingShown = phase === 'greeting' || phase === 'out';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 14, background: 'var(--bg)',
        opacity: phase === 'out' ? 0 : 1,
        transition: 'opacity 550ms ease',
        pointerEvents: phase === 'out' ? 'none' : 'auto',
      }}
    >
      <div
        style={{
          width: 72, height: 72, borderRadius: 20, background: 'var(--btn-gradient)', color: 'var(--accent-ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--glow-lg)',
          animation: 'df-splash-pop 650ms cubic-bezier(.22,1,.36,1) both',
        }}
      >
        <FlameMark size={36} />
      </div>
      <div
        style={{
          fontSize: 19, fontWeight: 600, color: 'var(--text)', textAlign: 'center',
          opacity: greetingShown ? 1 : 0,
          transform: greetingShown ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 500ms ease, transform 500ms ease',
        }}
      >
        {greeting}{name ? `, ${name}` : ''}
      </div>
      <style>{`
        @keyframes df-splash-pop {
          0% { opacity: 0; transform: scale(0.7); }
          60% { opacity: 1; transform: scale(1.06); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
