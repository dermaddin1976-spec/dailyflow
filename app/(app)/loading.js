export default function Loading() {
  return (
    <div className="df-loading">
      <span className="df-loading-mark" />
      <style>{`
        .df-loading { display:flex; align-items:center; justify-content:center; min-height:100vh; background:var(--bg); }
        .df-loading-mark { width:32px; height:32px; border-radius:9px; background:var(--btn-gradient); box-shadow:var(--glow-md); animation:df-pulse 1.1s ease-in-out infinite; }
        @keyframes df-pulse { 0%,100% { opacity:.55; transform:scale(.92); } 50% { opacity:1; transform:scale(1); } }
        @media (prefers-reduced-motion: reduce) { .df-loading-mark { animation:none; } }
      `}</style>
    </div>
  );
}
