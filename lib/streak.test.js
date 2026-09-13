import { describe, it, expect } from 'vitest';
import { computeStreak } from './streak.js';

function daysAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

describe('computeStreak', () => {
  it('is 0 for no dates', () => {
    expect(computeStreak([])).toBe(0);
    expect(computeStreak(undefined)).toBe(0);
  });

  it('counts today plus consecutive prior days', () => {
    const dates = [daysAgo(0), daysAgo(1), daysAgo(2)];
    expect(computeStreak(dates)).toBe(3);
  });

  it('gives today a grace period when only yesterday is logged', () => {
    // Today hasn't happened yet, but yesterday and the day before were logged.
    const dates = [daysAgo(1), daysAgo(2)];
    expect(computeStreak(dates)).toBe(2);
  });

  it('breaks the streak on a gap', () => {
    // Today and yesterday logged, but the day before that is missing.
    const dates = [daysAgo(0), daysAgo(1), daysAgo(3)];
    expect(computeStreak(dates)).toBe(2);
  });

  it('is 0 once a day is missed and today has not been logged either', () => {
    const dates = [daysAgo(2), daysAgo(3)];
    expect(computeStreak(dates)).toBe(0);
  });

  it('ignores unrelated far-past dates', () => {
    const dates = [daysAgo(0), '2020-01-01'];
    expect(computeStreak(dates)).toBe(1);
  });
});
