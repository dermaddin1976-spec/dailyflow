// Weight-goal forecasting: fits a straight-line trend to recently logged
// weights and projects when that trend would reach the user's
// target_weight_kg. Deliberately conservative — it says nothing rather
// than a shaky guess when there isn't enough data or the trend is going
// the wrong way.

const MIN_ENTRIES = 3;
const MIN_SPAN_DAYS = 5;
const TREND_WINDOW_DAYS = 28; // only fit off the last ~4 weeks, so an old plateau doesn't mute a real recent change
const FLAT_SLOPE_KG_PER_DAY = 0.001; // ~7g/week — below this, treat the trend as flat rather than "moving"
const MAX_PROJECTION_DAYS = 365 * 2;

function daysBetween(a, b) {
  return (new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000;
}

// entries: ascending-by-date [{date: 'YYYY-MM-DD', weight_kg}], one per day.
export function forecastWeightGoal(entries, targetWeightKg, goal) {
  if (!targetWeightKg || !goal || goal === 'maintain') return null;
  if (!entries || entries.length < MIN_ENTRIES) return null;

  const first = entries[0];
  const last = entries[entries.length - 1];
  if (daysBetween(first.date, last.date) < MIN_SPAN_DAYS) return null;

  const windowed = entries.filter(e => daysBetween(e.date, last.date) <= TREND_WINDOW_DAYS);
  const fitEntries = windowed.length >= MIN_ENTRIES ? windowed : entries;

  // Ordinary least-squares slope of weight_kg vs. day offset from the first fitted entry.
  const anchor = fitEntries[0].date;
  const xs = fitEntries.map(e => daysBetween(anchor, e.date));
  const ys = fitEntries.map(e => e.weight_kg);
  const n = fitEntries.length;
  const xMean = xs.reduce((s, v) => s + v, 0) / n;
  const yMean = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slopePerDay = den === 0 ? 0 : num / den;
  const slopePerWeek = Math.round(slopePerDay * 7 * 100) / 100;

  const current = last.weight_kg;
  const remaining = targetWeightKg - current;

  if (Math.abs(remaining) < 0.1) {
    return { status: 'reached', current, targetWeightKg, slopePerWeek };
  }

  const wantsLoss = goal === 'lose';
  const movingRightDirection = wantsLoss ? slopePerDay < -FLAT_SLOPE_KG_PER_DAY : slopePerDay > FLAT_SLOPE_KG_PER_DAY;
  if (!movingRightDirection) {
    return { status: 'wrong_direction', current, targetWeightKg, slopePerWeek };
  }

  const daysToGoal = remaining / slopePerDay;
  if (!(daysToGoal > 0) || daysToGoal > MAX_PROJECTION_DAYS) {
    return { status: 'too_slow', current, targetWeightKg, slopePerWeek };
  }

  const projected = new Date(`${last.date}T00:00:00Z`);
  projected.setUTCDate(projected.getUTCDate() + Math.round(daysToGoal));

  return {
    status: 'on_track',
    current,
    targetWeightKg,
    slopePerWeek,
    daysToGoal: Math.round(daysToGoal),
    projectedDate: projected.toISOString().slice(0, 10),
  };
}

// Formats a day count as a short, human duration for display ("5 days", "3 weeks", "4 months").
export function formatDuration(days) {
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days / 30.44)} months`;
}
