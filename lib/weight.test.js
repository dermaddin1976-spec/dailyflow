import { describe, it, expect } from 'vitest';
import { forecastWeightGoal, formatDuration } from './weight.js';

function entries(pairs) {
  return pairs.map(([date, weight_kg]) => ({ date, weight_kg }));
}

describe('forecastWeightGoal', () => {
  it('returns null with no target or a maintain goal', () => {
    const e = entries([['2026-09-01', 80], ['2026-09-10', 78]]);
    expect(forecastWeightGoal(e, null, 'lose')).toBe(null);
    expect(forecastWeightGoal(e, 75, 'maintain')).toBe(null);
    expect(forecastWeightGoal(e, 75, null)).toBe(null);
  });

  it('returns null with too few entries or too short a span', () => {
    expect(forecastWeightGoal(entries([['2026-09-01', 80], ['2026-09-02', 79.8]]), 75, 'lose')).toBe(null);
    expect(forecastWeightGoal(entries([
      ['2026-09-01', 80], ['2026-09-02', 79.9], ['2026-09-03', 79.8],
    ]), 75, 'lose')).toBe(null); // 2-day span, under MIN_SPAN_DAYS
  });

  it('projects an on-track loss toward the target', () => {
    // Losing ~0.7kg/week over 3 weeks.
    const e = entries([
      ['2026-08-01', 85], ['2026-08-08', 84.3], ['2026-08-15', 83.6], ['2026-08-22', 82.9],
    ]);
    const result = forecastWeightGoal(e, 80, 'lose');
    expect(result.status).toBe('on_track');
    expect(result.slopePerWeek).toBeLessThan(0);
    expect(result.daysToGoal).toBeGreaterThan(0);
    expect(result.projectedDate > '2026-08-22').toBe(true);
  });

  it('flags the wrong direction instead of guessing a date', () => {
    // Goal is to lose, but the trend is flat/gaining.
    const e = entries([
      ['2026-08-01', 80], ['2026-08-08', 80.3], ['2026-08-15', 80.6], ['2026-08-22', 80.9],
    ]);
    const result = forecastWeightGoal(e, 75, 'lose');
    expect(result.status).toBe('wrong_direction');
  });

  it('reports "reached" once within 0.1kg of the target', () => {
    const e = entries([
      ['2026-08-01', 78], ['2026-08-08', 76], ['2026-08-15', 75.05],
    ]);
    const result = forecastWeightGoal(e, 75, 'lose');
    expect(result.status).toBe('reached');
  });

  it('does not project centuries out for a near-flat trend', () => {
    const e = entries([
      ['2026-08-01', 80], ['2026-08-08', 79.99], ['2026-08-15', 79.98], ['2026-08-22', 79.97],
    ]);
    const result = forecastWeightGoal(e, 70, 'lose');
    expect(result.status).toBe('too_slow');
  });
});

describe('formatDuration', () => {
  it('picks the most readable unit', () => {
    expect(formatDuration(1)).toBe('1 day');
    expect(formatDuration(5)).toBe('5 days');
    expect(formatDuration(21)).toBe('3 weeks');
    expect(formatDuration(90)).toBe('3 months');
  });
});
