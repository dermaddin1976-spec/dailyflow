// National Sleep Foundation-style age brackets, collapsed to a single target hour figure per bracket.
export function recommendedSleepHours(age) {
  if (!age) return 8;
  if (age <= 13) return 10;   // school age
  if (age <= 17) return 9;    // teen
  if (age <= 25) return 8;    // young adult
  if (age <= 64) return 7.5;  // adult
  return 7.5;                 // older adult
}

// Formats a decimal hours figure (e.g. 5.9333) as clock-style hours:minutes (e.g. "5:56"),
// since a raw decimal like "5.9h" reads as an odd, made-up unit rather than a real duration.
export function formatHM(hours) {
  if (hours == null || Number.isNaN(hours)) return '—';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

// Converts decimal hours to a zero-padded "HH:MM" string for an
// <input type="time"> value — used to represent a duration (hours:minutes
// slept), not a clock time, but the control's HH:MM shape works either way.
// Capped at 23:59 since the control can't go higher.
export function hoursToTimeInput(hours) {
  if (hours == null || Number.isNaN(Number(hours))) return '';
  const totalMinutes = Math.round(Number(hours) * 60);
  const h = Math.min(23, Math.floor(totalMinutes / 60));
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Converts an <input type="time"> value ("HH:MM") back to decimal hours,
// rounded to 2 decimal places (matches minute-level precision — a minute is
// 1/60 = 0.0167h, so 2 decimals doesn't lose anything a person could type).
export function timeInputToHours(value) {
  if (!value) return null;
  const [h, m] = String(value).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return Math.round((h + m / 60) * 100) / 100;
}

// Sleep debt over a trailing window: sums (target - actual) across every LOGGED night in the
// window (unlogged nights aren't counted against you), floored at 0 so a run of good nights can
// pay a deficit down to zero but not bank a surplus.
export function computeSleepDebt(nightlyHours, target, days) {
  const nightsLogged = nightlyHours.length;
  const totalHours = nightlyHours.reduce((s, h) => s + (h || 0), 0);
  const avgHours = nightsLogged ? Math.round((totalHours / nightsLogged) * 10) / 10 : null;
  const rawDebt = nightlyHours.reduce((s, h) => s + (target - (h || 0)), 0);
  const debtHours = Math.max(0, Math.round(rawDebt * 10) / 10);
  return { nightsLogged, avgHours, debtHours, target, days };
}

export function debtLabel(debtHours) {
  if (debtHours <= 1) return { text: 'No real debt', color: 'var(--good)' };
  if (debtHours <= 5) return { text: 'A little behind', color: 'var(--good)' };
  if (debtHours <= 12) return { text: 'Notably behind', color: 'var(--warning)' };
  return { text: 'Significant debt — prioritize sleep', color: 'var(--critical)' };
}
