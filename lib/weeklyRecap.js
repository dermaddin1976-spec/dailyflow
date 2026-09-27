import db from './db.js';
import { callGemini } from './gemini.js';
import { checkAiRateLimit } from './rateLimit.js';

function shiftDate(dateString, offsetDays) {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// Monday-Sunday, most recently *completed* relative to `date` — mirrors getDailyFocus's
// "ends yesterday" rule so a partial in-progress week never gets summarized as if it were done.
// Anchored on `date` (not `new Date()`) so it's testable and not tied to the server's clock.
export function mostRecentCompletedWeek(date) {
  const yesterday = shiftDate(date, -1);
  const dow = new Date(`${yesterday}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
  const daysSinceSunday = dow; // Sunday(0) -> 0 back, Monday(1) -> 1 back, ... Saturday(6) -> 6 back
  const weekEnd = shiftDate(yesterday, -daysSinceSunday);
  const weekStart = shiftDate(weekEnd, -6);
  return { weekStart, weekEnd };
}

function sumBy(rows, key) {
  return rows.reduce((s, r) => s + (r[key] || 0), 0);
}

async function weekAggregates(userId, weekStart, weekEnd) {
  const [sleepRows, workoutRows, mealRows, studyRows] = await Promise.all([
    db.prepare('SELECT hours FROM sleep_logs WHERE user_id=? AND date BETWEEN ? AND ?').all(userId, weekStart, weekEnd),
    db.prepare('SELECT date, minutes FROM workout_logs WHERE user_id=? AND date BETWEEN ? AND ?').all(userId, weekStart, weekEnd),
    db.prepare('SELECT date, calories, protein FROM meal_logs WHERE user_id=? AND date BETWEEN ? AND ?').all(userId, weekStart, weekEnd),
    db.prepare('SELECT date, SUM(minutes) as minutes FROM study_logs WHERE user_id=? AND date BETWEEN ? AND ? GROUP BY date').all(userId, weekStart, weekEnd),
  ]);
  const mealDays = new Set(mealRows.map(r => r.date));
  const loggedDays = new Set([
    ...sleepRows.length ? [1] : [],
    ...workoutRows.map(r => r.date),
    ...mealRows.map(r => r.date),
    ...studyRows.filter(r => r.minutes > 0).map(r => r.date),
  ]);
  const domainsWithData = [sleepRows.length > 0, workoutRows.length > 0, mealRows.length > 0, studyRows.some(r => r.minutes > 0)]
    .filter(Boolean).length;
  return {
    sleepNights: sleepRows.length,
    avgSleepHours: sleepRows.length ? Math.round((sumBy(sleepRows, 'hours') / sleepRows.length) * 10) / 10 : null,
    trainingSessions: workoutRows.length,
    trainingMinutes: sumBy(workoutRows, 'minutes'),
    mealDaysLogged: mealDays.size,
    avgCalories: mealDays.size ? Math.round(sumBy(mealRows, 'calories') / mealDays.size) : null,
    avgProtein: mealDays.size ? Math.round(sumBy(mealRows, 'protein') / mealDays.size) : null,
    studyMinutes: sumBy(studyRows, 'minutes'),
    loggedDayCount: loggedDays.size,
    domainsWithData,
  };
}

// A once-a-week, zoomed-out coaching note — the weekly counterpart to getDailyFocus's daily
// "what to do tomorrow" card. Summarizes the most recently completed Mon-Sun week against the
// week before it (so it can actually say "up from" / "down from", not just restate totals),
// and gives one thing to carry into the coming week. Cached until the next week completes —
// unlike getDailyFocus this does NOT refresh every day, since a week of data doesn't meaningfully
// change day to day the way "yesterday" does.
export async function getWeeklyRecap(userId, user, date) {
  const { weekStart, weekEnd } = mostRecentCompletedWeek(date);

  const row = await db.prepare('SELECT recap_text, recap_week_end FROM users WHERE id=?').get(userId);
  if (row && row.recap_week_end === weekEnd) {
    return row.recap_text ? { text: row.recap_text, weekStart, weekEnd } : null;
  }

  const rl = await checkAiRateLimit(userId);
  if (!rl.allowed) {
    return row && row.recap_text ? { text: row.recap_text, weekStart: null, weekEnd: row.recap_week_end } : null;
  }

  const thisWeek = await weekAggregates(userId, weekStart, weekEnd);

  // Need a real spread of the week logged across more than one domain, or there's nothing
  // substantive to recap yet.
  if (thisWeek.loggedDayCount < 3 || thisWeek.domainsWithData < 2) {
    await db.prepare('UPDATE users SET recap_text=?, recap_week_end=? WHERE id=?').run(null, weekEnd, userId);
    return null;
  }

  const priorWeekEnd = shiftDate(weekStart, -1);
  const priorWeekStart = shiftDate(priorWeekEnd, -6);
  const priorWeek = await weekAggregates(userId, priorWeekStart, priorWeekEnd);

  const describeWeek = (label, w) => [
    `${label}: ${w.loggedDayCount}/7 days with something logged.`,
    w.sleepNights ? `Sleep: ${w.avgSleepHours}h avg over ${w.sleepNights} night${w.sleepNights === 1 ? '' : 's'}.` : 'Sleep: not logged.',
    w.trainingSessions ? `Training: ${w.trainingSessions} session${w.trainingSessions === 1 ? '' : 's'}, ${w.trainingMinutes} total minutes.` : 'Training: not logged.',
    w.mealDaysLogged ? `Nutrition: ${w.avgCalories} cal/day and ${w.avgProtein}g protein/day avg over ${w.mealDaysLogged} logged day${w.mealDaysLogged === 1 ? '' : 's'}.` : 'Nutrition: not logged.',
    w.studyMinutes ? `Study: ${w.studyMinutes} total minutes.` : 'Study: not logged.',
  ].join(' ');

  const summary = [
    `Week just completed (${weekStart} to ${weekEnd}): ${describeWeek('This week', thisWeek)}`,
    `Week before that (${priorWeekStart} to ${priorWeekEnd}): ${describeWeek('Prior week', priorWeek)}`,
  ].join('\n');

  const previous = row && row.recap_text ? row.recap_text : null;

  try {
    const result = await callGemini({
      prompt: [
        "You are a sharp, specific coach writing a short weekly recap for a student-athlete who trains",
        "every single day on purpose (gym or a run) and does not want to be told to rest, skip, or scale",
        'back training — ever. Do not use the words "rest", "recovery day", "skip", "day off", or suggest',
        'lighter/no training.',
        'Below are this week\'s totals compared with the week before. Write a short recap: 1) one specific',
        'thing that improved or held steady, referencing the actual numbers, 2) one specific thing that',
        'slipped or is worth watching, again with real numbers, and 3) one concrete focus for the coming',
        'week. Three short sentences total, plain-spoken, talk directly to them ("you"), no emoji, no',
        'exclamation marks, no generic filler like "great job" or "keep it up" on its own without a number',
        'behind it.',
        previous ? `Last week's recap already said: "${previous}" — don't just repeat the same framing again.` : '',
        summary,
        user.goal ? `Nutrition goal: ${user.goal} weight.` : '',
        'If there truly isn\'t enough real signal to compare (e.g. one of the weeks has almost nothing',
        'logged), respond with null instead of guessing.',
        'Respond ONLY with JSON: {"recap": string | null}',
      ].filter(Boolean).join(' '),
      temperature: 0.7,
      thinkingLevel: 'low',
    });
    const text = result.recap ? String(result.recap).trim().slice(0, 500) : null;
    await db.prepare('UPDATE users SET recap_text=?, recap_week_end=? WHERE id=?').run(text || null, weekEnd, userId);
    return text ? { text, weekStart, weekEnd } : null;
  } catch (err) {
    return row && row.recap_text ? { text: row.recap_text, weekStart: null, weekEnd: row.recap_week_end } : null;
  }
}
