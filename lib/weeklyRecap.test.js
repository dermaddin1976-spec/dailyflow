import { describe, it, expect } from 'vitest';
import { mostRecentCompletedWeek } from './weeklyRecap.js';

describe('mostRecentCompletedWeek', () => {
  it('resolves the prior Mon-Sun week when today is a Monday', () => {
    // 2026-09-21 is a Monday; yesterday (Sun 2026-09-20) closes the most recent full week.
    const { weekStart, weekEnd } = mostRecentCompletedWeek('2026-09-21');
    expect(weekEnd).toBe('2026-09-20');
    expect(weekStart).toBe('2026-09-14');
  });

  it('resolves the same completed week for every day within the following week', () => {
    // Tue through Sun of the week after should all point at the same just-finished week.
    const expected = { weekStart: '2026-09-14', weekEnd: '2026-09-20' };
    for (const date of ['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']) {
      expect(mostRecentCompletedWeek(date)).toEqual(expected);
    }
  });

  it('rolls over exactly on the next Monday', () => {
    // 2026-09-28 is the following Monday — the week that just completed is 09-21 to 09-27.
    expect(mostRecentCompletedWeek('2026-09-28')).toEqual({ weekStart: '2026-09-21', weekEnd: '2026-09-27' });
  });

  it('always returns a 7-day span starting on a Monday and ending on a Sunday', () => {
    for (const date of ['2026-01-01', '2026-03-15', '2026-12-31']) {
      const { weekStart, weekEnd } = mostRecentCompletedWeek(date);
      const startDow = new Date(`${weekStart}T00:00:00Z`).getUTCDay();
      const endDow = new Date(`${weekEnd}T00:00:00Z`).getUTCDay();
      expect(startDow).toBe(1); // Monday
      expect(endDow).toBe(0); // Sunday
      const spanDays = (new Date(`${weekEnd}T00:00:00Z`) - new Date(`${weekStart}T00:00:00Z`)) / 86400000;
      expect(spanDays).toBe(6);
    }
  });
});
