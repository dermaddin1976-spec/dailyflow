import { describe, it, expect } from 'vitest';
import { hoursToTimeInput, timeInputToHours } from './sleep.js';

describe('hoursToTimeInput / timeInputToHours', () => {
  it('converts decimal hours to a zero-padded HH:MM string', () => {
    expect(hoursToTimeInput(7.8)).toBe('07:48');
    expect(hoursToTimeInput(0.25)).toBe('00:15');
    expect(hoursToTimeInput(10)).toBe('10:00');
  });

  it('converts an HH:MM time-input value back to decimal hours', () => {
    expect(timeInputToHours('07:48')).toBe(7.8);
    expect(timeInputToHours('00:15')).toBe(0.25);
    expect(timeInputToHours('10:00')).toBe(10);
  });

  it('round-trips without drifting', () => {
    for (const hours of [7.8, 6.92, 8.0, 0.5, 9.99]) {
      const roundTripped = timeInputToHours(hoursToTimeInput(hours));
      // Within one minute (1/60h) of the original — rounding to whole
      // minutes is expected, drifting further than that isn't.
      expect(Math.abs(roundTripped - hours)).toBeLessThan(1 / 60 + 0.001);
    }
  });

  it('handles empty/invalid input without throwing', () => {
    expect(hoursToTimeInput(null)).toBe('');
    expect(hoursToTimeInput(undefined)).toBe('');
    expect(timeInputToHours('')).toBe(null);
    expect(timeInputToHours(undefined)).toBe(null);
  });
});
