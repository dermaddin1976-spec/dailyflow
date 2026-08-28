export function lastNDates(n) {
  const dates = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function weekdayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()];
}

export function BarChart({ title, unit, dates, values }) {
  const max = Math.max(1, ...values);
  const barW = 30;
  const gap = 14;
  const chartH = 90;
  const width = dates.length * (barW + gap);

  return (
    <div className="card">
      <h3 style={{ marginBottom: 14 }}>{title}</h3>
      <svg width="100%" viewBox={`0 0 ${width} ${chartH + 26}`} style={{ overflow: 'visible' }}>
        {dates.map((date, i) => {
          const v = values[i] || 0;
          const h = v === 0 ? 0 : Math.max(3, (v / max) * chartH);
          const x = i * (barW + gap);
          const y = chartH - h;
          return (
            <g key={date}>
              <title>{`${date}: ${v}${unit}`}</title>
              <rect x={x} y={y} width={barW} height={h} rx={4} fill="var(--accent)" opacity={v === 0 ? 0.15 : 1} />
              {v === 0 && <rect x={x} y={chartH - 2} width={barW} height={2} rx={1} fill="var(--border-strong)" />}
              <text x={x + barW / 2} y={chartH + 18} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--muted)">
                {weekdayLabel(date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
