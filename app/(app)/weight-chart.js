export function WeightChart({ entries, targetWeightKg, forecast }) {
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
  const hasProjection = forecast && forecast.status === 'on_track';
  const targetInRange = targetWeightKg != null;
  const allValues = [...weights, ...(targetInRange ? [targetWeightKg] : [])];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const pad = Math.max(0.5, (max - min) * 0.2);
  const yMin = min - pad;
  const yMax = max + pad;
  const span = yMax - yMin || 1;
  const n = entries.length;

  // Projected days (real calendar days from the last log to the projected date) get their own
  // x-scale step so a far-off projection doesn't squeeze the logged history into a sliver.
  const projectedDays = hasProjection ? forecast.daysToGoal : 0;
  const loggedSpanDays = Math.max(1, (new Date(`${entries[n - 1].date}T00:00:00Z`) - new Date(`${entries[0].date}T00:00:00Z`)) / 86400000);
  const totalSpanDays = loggedSpanDays + projectedDays;
  const dayOffset = (date) => (new Date(`${date}T00:00:00Z`) - new Date(`${entries[0].date}T00:00:00Z`)) / 86400000;

  const points = entries.map((e) => ({
    x: (dayOffset(e.date) / totalSpanDays) * width,
    y: height - ((e.weight_kg - yMin) / span) * height,
    e,
  }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const last = points[points.length - 1];

  const projectedPoint = hasProjection ? {
    x: (dayOffset(forecast.projectedDate) / totalSpanDays) * width,
    y: height - ((forecast.targetWeightKg - yMin) / span) * height,
  } : null;
  const projectedPath = projectedPoint ? `M ${last.x.toFixed(2)} ${last.y.toFixed(2)} L ${projectedPoint.x.toFixed(2)} ${projectedPoint.y.toFixed(2)}` : null;

  const targetY = targetInRange ? height - ((targetWeightKg - yMin) / span) * height : null;

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ overflow: 'visible', display: 'block' }}>
        {targetInRange && (
          <line
            x1="0" x2={width} y1={targetY} y2={targetY}
            stroke="var(--good)" strokeWidth="1" strokeDasharray="2,2" vectorEffect="non-scaling-stroke" opacity="0.55"
          />
        )}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {projectedPath && (
          <path d={projectedPath} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3,2.5" vectorEffect="non-scaling-stroke" opacity="0.6" />
        )}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === points.length - 1 ? 2.4 : 1.3} fill="var(--accent)" vectorEffect="non-scaling-stroke" />
        ))}
        {projectedPoint && (
          <circle cx={projectedPoint.x} cy={projectedPoint.y} r="2.4" fill="none" stroke="var(--accent)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
        <span>{entries[0].date}</span>
        <span className="mono" style={{ color: 'var(--text-2)' }}>{last.e.weight_kg} kg</span>
        <span>{hasProjection ? forecast.projectedDate : entries[entries.length - 1].date}</span>
      </div>
    </div>
  );
}
