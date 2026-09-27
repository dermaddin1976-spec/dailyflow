// Shared visual treatment for the AI-generated coaching callouts ("FOR TOMORROW"
// on Today, "WEEKLY RECAP" on Trends) — a gradient-tinted card with a round
// accent-glow icon badge, so any AI-authored suggestion reads as visually
// distinct from the app's own data cards at a glance.
export function AiCoachCard({ icon, label, children }) {
  return (
    <div className="card" style={{
      marginBottom: 18, padding: '18px 24px', display: 'flex', gap: 11, alignItems: 'flex-start',
      background: 'linear-gradient(160deg, color-mix(in srgb, var(--accent) 16%, var(--surface)), color-mix(in srgb, var(--surface) 88%, transparent))',
      borderColor: 'color-mix(in srgb, var(--accent) 32%, var(--border))',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0, marginTop: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'color-mix(in srgb, var(--accent) 22%, transparent)',
        boxShadow: '0 0 16px color-mix(in srgb, var(--accent) 45%, transparent)',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '.03em', marginBottom: 4 }}>
          {label}
        </div>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>{children}</p>
      </div>
    </div>
  );
}
