'use client';

import { useState } from 'react';
import { weekdayLabel } from '../../lib/dates.js';

export function BarChart({ title, unit, dates, values, formatValue }) {
  const [active, setActive] = useState(null);
  const max = Math.max(1, ...values);
  const barW = 30;
  const gap = 14;
  const chartH = 90;
  const width = dates.length * (barW + gap);

  const label = (v) => (formatValue ? formatValue(v) : `${v}${unit}`);
  const activeInfo = active != null ? {
    date: dates[active],
    text: label(values[active] || 0),
    leftPct: ((active * (barW + gap) + barW / 2) / width) * 100,
  } : null;

  const clear = (i) => setActive((cur) => (cur === i ? null : cur));

  return (
    <div className="card">
      <h3 style={{ marginBottom: 11 }}>{title}</h3>
      <div style={{ position: 'relative' }}>
        {activeInfo && (
          <div className="chart-tooltip" style={{ left: `${activeInfo.leftPct}%` }}>
            <span className="chart-tooltip-date">{activeInfo.date}</span>
            <span className="chart-tooltip-value">{activeInfo.text}</span>
          </div>
        )}
        <svg width="100%" viewBox={`0 0 ${width} ${chartH + 26}`} style={{ overflow: 'visible' }}>
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1={0} x2={width} y1={chartH * (1 - f)} y2={chartH * (1 - f)}
              stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke"
            />
          ))}
          {dates.map((date, i) => {
            const v = values[i] || 0;
            const h = v === 0 ? 0 : Math.max(3, (v / max) * chartH);
            const x = i * (barW + gap);
            const y = chartH - h;
            const isActive = active === i;
            return (
              <g key={date}>
                <rect x={x} y={y} width={barW} height={h} rx={4} fill="var(--accent)" opacity={v === 0 ? 0.15 : isActive ? 1 : 0.85} />
                {v === 0 && <rect x={x} y={chartH - 2} width={barW} height={2} rx={1} fill="var(--border-strong)" />}
                <text x={x + barW / 2} y={chartH + 18} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill={isActive ? 'var(--text)' : 'var(--muted)'}>
                  {weekdayLabel(date)}
                </text>
                <rect
                  x={x - gap / 2} y={0} width={barW + gap} height={chartH + 26}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${date}: ${label(v)}`}
                  aria-pressed={isActive}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => clear(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => clear(i)}
                  onClick={() => setActive((cur) => (cur === i ? null : i))}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
