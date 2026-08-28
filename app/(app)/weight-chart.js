export function WeightChart({ entries }) {
  if (!entries || entries.length < 2) {
    return (
      <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>
        Log a couple more entries to see a trend line.
      </p>
    );
  }

  const width = 100;
  const height = 70;
  const weights = entries.map(e => e.weight_kg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const pad = Math.max(0.5, (max - min) * 0.2);
  const yMin = min - pad;
  const yMax = max + pad;
  const span = yMax - yMin || 1;
  const n = entries.length;

  const points = entries.map((e, i) => ({
    x: n === 1 ? 0 : (i / (n - 1)) * width,
    y: height - ((e.weight_kg - yMin) / span) * height,
    e,
  }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ overflow: 'visible', display: 'block' }}>
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 2.4 : 1.3} fill="var(--accent)" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
        <span>{entries[0].date}</span>
        <span className="mono" style={{ color: 'var(--text-2)' }}>{last.e.weight_kg} kg</span>
        <span>{entries[entries.length - 1].date}</span>
      </div>
    </div>
  );
}
