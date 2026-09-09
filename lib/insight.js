import db from './db.js';
import { callGemini } from './gemini.js';
import { checkAiRateLimit } from './rateLimit.js';

function dateStr(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}

const WINDOW_DAYS = 21;
// Once a real pattern is found, let it stand for about a week — a correlation across 21 days of
// data doesn't meaningfully shift day to day, so re-running the AI call daily would just churn the
// same finding into slightly different words. A null result (nothing worth surfacing yet) retries
// daily instead, since more data may have landed since the last check.
const REFRESH_DAYS = 6;

// A proactive, standing observation about how this person's tracked areas relate to each other —
// distinct from getReadinessTip (today's numbers, "what to do today, right now") and the on-demand
// coach Ask panel (only ever speaks when asked). This looks across a three-week window for a genuine
// cross-domain pattern (sleep vs. training, nutrition vs. study, etc.) and surfaces it unprompted.
export async function getProactiveInsight(userId, user, date) {
  const row = await db.prepare('SELECT insight_text, insight_date FROM users WHERE id=?').get(userId);

  // Already checked today — don't hit the AI more than once a day regardless of outcome.
  if (row && row.insight_date === date) {
    return row.insight_text || null;
  }
  if (row && row.insight_text && row.insight_date && daysBetween(row.insight_date, date) < REFRESH_DAYS) {
    return row.insight_text;
  }

  const rl = await checkAiRateLimit(userId);
  if (!rl.allowed) return row ? (row.insight_text || null) : null;

  const start = dateStr(-(WINDOW_DAYS - 1));

  const [sleepRows, workoutRows, mealRows, studyRows] = await Promise.all([
    db.prepare('SELECT date, hours FROM sleep_logs WHERE user_id=? AND date BETWEEN ? AND ? ORDER BY date').all(userId, start, date),
    db.prepare('SELECT date, type, minutes, intensity FROM workout_logs WHERE user_id=? AND date BETWEEN ? AND ? ORDER BY date').all(userId, start, date),
    db.prepare('SELECT date, calories, protein FROM meal_logs WHERE user_id=? AND date BETWEEN ? AND ? ORDER BY date').all(userId, start, date),
    db.prepare('SELECT date, COALESCE(SUM(minutes),0) as minutes FROM study_logs WHERE user_id=? AND date BETWEEN ? AND ? GROUP BY date ORDER BY date').all(userId, start, date),
  ]);

  const loggedDays = new Set([
    ...sleepRows.map(r => r.date),
    ...workoutRows.map(r => r.date),
    ...mealRows.map(r => r.date),
    ...studyRows.filter(r => r.minutes > 0).map(r => r.date),
  ]);
  const domainsWithData = [sleepRows.length > 0, workoutRows.length > 0, mealRows.length > 0, studyRows.some(r => r.minutes > 0)]
    .filter(Boolean).length;

  // Need a reasonable spread of days across at least two different domains, or there's nothing to
  // correlate yet — an AI call here would just be guessing at a pattern from thin data.
  if (loggedDays.size < 7 || domainsWithData < 2) {
    await db.prepare('UPDATE users SET insight_text=?, insight_date=? WHERE id=?').run(null, date, userId);
    return null;
  }

  const mealsByDate = {};
  mealRows.forEach(m => {
    mealsByDate[m.date] = mealsByDate[m.date] || { calories: 0, protein: 0 };
    mealsByDate[m.date].calories += m.calories || 0;
    mealsByDate[m.date].protein += m.protein || 0;
  });
  const studyDays = studyRows.filter(r => r.minutes > 0);

  const lines = [`Data below covers ${start} through ${date} (${WINDOW_DAYS} days). Each entry is one date, YYYY-MM-DD.`];
  lines.push('\nSleep (hours):');
  lines.push(sleepRows.length ? sleepRows.map(r => `${r.date}: ${r.hours}h`).join('; ') : 'none logged');
  lines.push('\nTraining (type, minutes, intensity/10):');
  lines.push(
    workoutRows.length
      ? workoutRows.map(r => `${r.date}: ${r.type || 'workout'}, ${r.minutes}min${r.intensity ? `, intensity ${r.intensity}` : ''}`).join('; ')
      : 'none logged',
  );
  lines.push('\nNutrition (daily totals):');
  lines.push(
    Object.keys(mealsByDate).length
      ? Object.entries(mealsByDate).map(([d, t]) => `${d}: ${Math.round(t.calories)} cal, ${Math.round(t.protein)}g protein`).join('; ')
      : 'none logged',
  );
  lines.push('\nStudy (minutes):');
  lines.push(studyDays.length ? studyDays.map(r => `${r.date}: ${r.minutes}min`).join('; ') : 'none logged');
  if (user.goal) lines.push(`\nNutrition goal: ${user.goal} weight.`);

  const previous = row && row.insight_text ? row.insight_text : null;

  try {
    const result = await callGemini({
      prompt: [
        'You are looking for ONE genuinely interesting, specific, non-obvious pattern connecting two',
        "different tracked areas (sleep, training, nutrition, study) in this student-athlete's data below",
        '— something like "your sleep runs shorter the two nights after high-intensity sessions" or "study',
        'minutes drop on the days your logged calories are lowest" — grounded in the actual dates and numbers',
        'given, not a generic platitude like "sleep more" or "eat more protein". This is a standing observation',
        'about a pattern, not advice for today specifically.',
        previous
          ? `You already told them this recently, so don't just repeat it — find something different, or say null if there's nothing else worth surfacing right now: "${previous}"`
          : '',
        "If nothing in the data below is actually a real, specific pattern worth pointing out, respond with null",
        'rather than forcing something generic or weak.',
        'Keep it to one or two short sentences, talk directly to them ("you"), plain-spoken, no emoji, no',
        'exclamation marks, and reference the actual numbers or days that back it up.',
        lines.join(' '),
        'Respond ONLY with JSON: {"insight": string | null}',
      ].filter(Boolean).join(' '),
      temperature: 0.7,
      thinkingLevel: 'low',
    });
    const insight = result.insight ? String(result.insight).trim().slice(0, 300) : null;
    await db.prepare('UPDATE users SET insight_text=?, insight_date=? WHERE id=?').run(insight || null, date, userId);
    return insight || null;
  } catch (err) {
    return row ? (row.insight_text || null) : null; // never let a flaky AI call break the dashboard
  }
}
