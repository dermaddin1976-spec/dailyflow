// Consecutive days present in `dates` (an array of 'YYYY-MM-DD' strings), counted backward from
// today. Today gets a grace period — it doesn't need to be present yet for the streak to hold,
// but yesterday does once today has passed without a log.
export function computeStreak(dates) {
  if (!dates || !dates.length) return 0;
  const dateSet = new Set(dates);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cursor = new Date(today);
  const todayStr = cursor.toISOString().slice(0, 10);
  if (!dateSet.has(todayStr)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dateSet.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
