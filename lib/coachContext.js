import db from './db.js';

function dateStr(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

// Builds one text block combining the last week of sleep, training, meals and
// study, plus today's readiness score, so the Today-tab coach can reason
// about the whole picture at once instead of just one tab's worth of data.
export async function buildCoachContext(userId, user, readiness) {
  const start = dateStr(-6), end = dateStr(0);

  const [sleepRows, workoutRows, mealRows, studyRows] = await Promise.all([
    db.prepare('SELECT date, hours FROM sleep_logs WHERE user_id=? AND date BETWEEN ? AND ? ORDER BY date').all(userId, start, end),
    db.prepare('SELECT date, type, minutes, intensity FROM workout_logs WHERE user_id=? AND date BETWEEN ? AND ? ORDER BY date').all(userId, start, end),
    db.prepare('SELECT date, calories, protein FROM meal_logs WHERE user_id=? AND date BETWEEN ? AND ? ORDER BY date').all(userId, start, end),
    db.prepare('SELECT date, COALESCE(SUM(minutes),0) as minutes FROM study_logs WHERE user_id=? AND date BETWEEN ? AND ? GROUP BY date ORDER BY date').all(userId, start, end),
  ]);

  const lines = [];

  lines.push(`Today's readiness: ${readiness.overall != null ? readiness.overall : 'not enough data'}/100 (${readiness.label}).`);
  if (readiness.components.length) {
    lines.push(
      'Readiness breakdown: ' +
      readiness.components.map(c => `${c.name} ${c.score != null ? c.score + '/100' : 'no data'} (${c.reason})`).join('; ') +
      '.',
    );
  }
  if (user.goal) lines.push(`Nutrition goal: ${user.goal} weight.`);
  lines.push(
    'This person trains every day on purpose (both strength/muscle and general fitness/endurance) and never ' +
    'wants to be told to skip, rest, or scale back training.',
  );

  lines.push('\nLast 7 days of sleep:');
  lines.push(sleepRows.length ? sleepRows.map(r => `${r.date}: ${r.hours}h`).join('; ') : 'No sleep logged.');

  lines.push('\nLast 7 days of training:');
  lines.push(
    workoutRows.length
      ? workoutRows.map(r => `${r.date}: ${r.type || 'workout'}, ${r.minutes}min${r.intensity ? `, intensity ${r.intensity}/10` : ''}`).join('; ')
      : 'No training logged.',
  );

  lines.push('\nLast 7 days of meals (daily totals, not individual items):');
  if (mealRows.length) {
    const byDate = {};
    mealRows.forEach(m => {
      byDate[m.date] = byDate[m.date] || { calories: 0, protein: 0, count: 0 };
      byDate[m.date].calories += m.calories || 0;
      byDate[m.date].protein += m.protein || 0;
      byDate[m.date].count += 1;
    });
    lines.push(Object.entries(byDate).map(([d, t]) => `${d}: ${t.calories} cal, ${t.protein}g protein (${t.count} meals)`).join('; '));
  } else {
    lines.push('No meals logged.');
  }

  lines.push('\nLast 7 days of study:');
  const studyDays = studyRows.filter(r => r.minutes > 0);
  lines.push(studyDays.length ? studyDays.map(r => `${r.date}: ${r.minutes}min`).join('; ') : 'No study logged.');

  return lines.join('\n');
}
