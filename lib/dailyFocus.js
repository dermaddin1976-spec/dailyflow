import db from './db.js';
import { callGemini } from './gemini.js';
import { checkAiRateLimit } from './rateLimit.js';

function dateStr(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const WINDOW_DAYS = 21;

// A proactive, forward-looking note synthesized across everything tracked
// (sleep, training, nutrition, study) — distinct from getReadinessTip
// (today's numbers only, "what to do today") and the on-demand coach Ask
// panel (only ever speaks when asked). This looks across a three-week
// window, weighted toward the last few days, and turns whatever stands out
// into one or two concrete things to actually do tomorrow — not just an
// observation. Refreshes once per day (same cadence as the readiness tip)
// so it stays current instead of sitting on the same note for a week.
export async function getDailyFocus(userId, user, date) {
  const row = await db.prepare('SELECT insight_text, insight_date FROM users WHERE id=?').get(userId);

  // Already generated today — don't hit the AI more than once a day.
  if (row && row.insight_date === date) {
    return row.insight_text || null;
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

  // Need a reasonable spread of days across at least two different domains, or there's nothing
  // real to base tomorrow's focus on yet — an AI call here would just be guessing from thin data.
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

  const lines = [`Data below covers ${start} through ${date} (${WINDOW_DAYS} days, most recent last). Each entry is one date, YYYY-MM-DD.`];
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
        "You are a sharp, specific coach for a student-athlete who trains every single day on purpose",
        '(gym or a run — both strength/muscle and general fitness) and does not want to be told to rest,',
        'skip, or scale back training — ever. Do not use the words "rest", "recovery day", "skip", "day',
        'off", or suggest lighter/no training. Assume tomorrow\'s session is happening regardless — your',
        'job is to tell them what to do around it (sleep, food, timing, hydration) to make it go better,',
        'using whatever real pattern connects their tracked areas below (sleep, training, nutrition,',
        'study) — something like "you\'ve trained hard three days straight and protein\'s been under 100g',
        'each of those nights — get 130g+ in tomorrow, especially right after the session" or "the two',
        'nights you slept under 6.5h were both the nights before your lowest study output — get to bed on',
        'time tonight if tomorrow\'s a study day". Weight the last few days more heavily than the start of',
        'the window — this is about tomorrow, not a monthlong summary.',
        'Give ONE or at most TWO concrete, specific things to actually do tomorrow, grounded in the actual',
        'dates and numbers given — never a generic platitude like "sleep more" or "eat more protein" with',
        'nothing behind it.',
        previous
          ? `You already told them this yesterday, so say something new today — different angle, different domain, whatever the data actually supports right now: "${previous}"`
          : '',
        'If nothing in the data below is actually specific enough to be useful, respond with null rather',
        'than forcing something generic or repeating advice you\'d give any day regardless of their data.',
        'Keep it to one or two short sentences, talk directly to them ("you"), plain-spoken, no emoji, no',
        'exclamation marks, and reference the actual numbers or days that back it up.',
        lines.join(' '),
        'Respond ONLY with JSON: {"focus": string | null}',
      ].filter(Boolean).join(' '),
      temperature: 0.75,
      thinkingLevel: 'low',
    });
    const focus = result.focus ? String(result.focus).trim().slice(0, 300) : null;
    await db.prepare('UPDATE users SET insight_text=?, insight_date=? WHERE id=?').run(focus || null, date, userId);
    return focus || null;
  } catch (err) {
    return row ? (row.insight_text || null) : null; // never let a flaky AI call break the dashboard
  }
}
