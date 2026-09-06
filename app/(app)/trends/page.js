import Link from 'next/link';
import { requireUser } from '../../../lib/auth.js';
import db from '../../../lib/db.js';
import InfoTip from '../info-tip.js';
import { BarChart, lastNDates } from '../bar-chart.js';
import { recommendedSleepHours, computeSleepDebt } from '../../../lib/sleep.js';
import { computeStreak } from '../../../lib/streak.js';

const RANGE_OPTIONS = [7, 14, 30];

function dateOffset(dateStr, offsetDays) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default async function TrendsPage({ searchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const requested = parseInt(sp && sp.days, 10);
  const rangeDays = RANGE_OPTIONS.includes(requested) ? requested : 7;

  const dates = lastNDates(rangeDays);
  const start = dates[0];
  const end = dates[dates.length - 1];

  const DEBT_WINDOW_DAYS = 14;
  const debtDates = lastNDates(DEBT_WINDOW_DAYS);
  const sleepTarget = recommendedSleepHours(user.age);

  // Correlation: average study focus on days that followed a night at/above the sleep target,
  // versus days that followed a shorter night. Needs sleep data starting one day before the range.
  const corrSleepStart = dateOffset(start, -1);

  // None of these reads depend on each other's results, so run them all at
  // once instead of one after another.
  const [sleepRows, studyRows, workoutRows, mealRows, allWorkoutDateRows, debtRows, corrSleepRows, corrStudyRows] = await Promise.all([
    db.prepare('SELECT date, AVG(hours) as hours FROM sleep_logs WHERE user_id=? AND date>=? GROUP BY date').all(user.id, start),
    db.prepare('SELECT date, SUM(minutes) as minutes FROM study_logs WHERE user_id=? AND date>=? GROUP BY date').all(user.id, start),
    db.prepare('SELECT date, SUM(minutes) as minutes FROM workout_logs WHERE user_id=? AND date>=? GROUP BY date').all(user.id, start),
    db.prepare('SELECT date, SUM(calories) as calories FROM meal_logs WHERE user_id=? AND date>=? GROUP BY date').all(user.id, start),
    db.prepare('SELECT DISTINCT date FROM workout_logs WHERE user_id=?').all(user.id),
    db.prepare(
      'SELECT date, AVG(hours) as hours FROM sleep_logs WHERE user_id=? AND date BETWEEN ? AND ? GROUP BY date'
    ).all(user.id, debtDates[0], debtDates[debtDates.length - 1]),
    db.prepare(
      'SELECT date, AVG(hours) as hours FROM sleep_logs WHERE user_id=? AND date BETWEEN ? AND ? GROUP BY date'
    ).all(user.id, corrSleepStart, end),
    db.prepare(
      "SELECT date, AVG(focus) as focus FROM study_logs WHERE user_id=? AND date BETWEEN ? AND ? AND focus IS NOT NULL GROUP BY date"
    ).all(user.id, start, end),
  ]);

  const toMap = (rows, key) => Object.fromEntries(rows.map(r => [r.date, r[key] || 0]));
  const sleepMap = toMap(sleepRows, 'hours');
  const studyMap = toMap(studyRows, 'minutes');
  const workoutMap = toMap(workoutRows, 'minutes');
  const mealMap = toMap(mealRows, 'calories');

  const hasAny = sleepRows.length || studyRows.length || workoutRows.length || mealRows.length;

  const allWorkoutDates = allWorkoutDateRows.map(r => r.date);
  const streak = computeStreak(allWorkoutDates);
  const sleepDebt = computeSleepDebt(debtRows.map(r => r.hours), sleepTarget, DEBT_WINDOW_DAYS);

  const sleepByDate = Object.fromEntries(corrSleepRows.map(r => [r.date, r.hours]));

  const goodFocus = [];
  const poorFocus = [];
  corrStudyRows.forEach(r => {
    const priorNight = dateOffset(r.date, -1);
    const priorHours = sleepByDate[priorNight];
    if (priorHours == null) return;
    (priorHours >= sleepTarget ? goodFocus : poorFocus).push(r.focus);
  });
  const avg = arr => (arr.length ? Math.round((arr.reduce((s, n) => s + n, 0) / arr.length) * 10) / 10 : null);
  const correlation = {
    ready: goodFocus.length >= 2 && poorFocus.length >= 2,
    goodAvg: avg(goodFocus), poorAvg: avg(poorFocus),
    goodCount: goodFocus.length, poorCount: poorFocus.length,
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Trends</h1>
        <InfoTip>
          These charts come from what you've logged across Nutrition, Sport, Sleep and Study &mdash; hours slept,
          minutes spent studying, minutes spent training, and calories from meals. A missing bar just means nothing
          was logged that day. Your training streak and 14-day sleep debt (from the Sport and Sleep tabs) are shown
          alongside them so this page gives the fuller picture in one place.
        </InfoTip>
      </div>
      <p style={{ color: 'var(--text-2)', marginBottom: 20 }}>Last {rangeDays} days.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {RANGE_OPTIONS.map(n => (
          <Link
            key={n}
            href={`/trends?days=${n}`}
            className={n === rangeDays ? 'btn' : 'btn secondary'}
            style={{ textDecoration: 'none', padding: '8px 16px', fontSize: 13 }}
          >
            {n} days
          </Link>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 16, marginBottom: 28 }}>
        <Link href="/sport" className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', letterSpacing: '.03em' }}>TRAINING STREAK</div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{streak}d</div>
        </Link>
        <Link href="/sleep" className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', letterSpacing: '.03em' }}>SLEEP DEBT (14D)</div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{sleepDebt.debtHours}h</div>
        </Link>
      </div>

      {!hasAny && (
        <p style={{ color: 'var(--muted)' }}>Nothing logged in the last {rangeDays} days yet &mdash; log something on Nutrition, Sport, Sleep or Study to see it here.</p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 24, marginBottom: 28 }}>
        <BarChart title="Sleep" unit="h" dates={dates} values={dates.map(d => Math.round((sleepMap[d] || 0) * 10) / 10)} />
        <BarChart title="Study minutes" unit="m" dates={dates} values={dates.map(d => studyMap[d] || 0)} />
        <BarChart title="Training minutes" unit="m" dates={dates} values={dates.map(d => workoutMap[d] || 0)} />
        <BarChart title="Calories logged" unit=" cal" dates={dates} values={dates.map(d => mealMap[d] || 0)} />
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Sleep &amp; focus</h3>
          <InfoTip>
            Compares your average study focus rating on days that followed a night at or above your {sleepTarget}h
            target, against days that followed a shorter night, using sleep and study sessions logged in this range.
            It's a simple before/after comparison of your own data, not a controlled study &mdash; take it as a hint
            worth watching, not a proven cause and effect, especially with only a few days on either side.
          </InfoTip>
        </div>
        {correlation.ready ? (
          <div>
            <p style={{ fontSize: 14, marginBottom: 8 }}>
              After {sleepTarget}h+ of sleep, your average focus was <strong className="mono">{correlation.goodAvg}</strong>{' '}
              (over {correlation.goodCount} day{correlation.goodCount === 1 ? '' : 's'}). After a shorter night, it was{' '}
              <strong className="mono">{correlation.poorAvg}</strong> (over {correlation.poorCount} day{correlation.poorCount === 1 ? '' : 's'}).
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
              {correlation.goodAvg > correlation.poorAvg
                ? 'Sleep seems to line up with your focus here — worth prioritizing before a session that matters.'
                : correlation.goodAvg < correlation.poorAvg
                ? "Doesn't show the usual pattern yet — could be too little data, or other factors carrying more weight for you."
                : 'No real difference showing up yet.'}
            </p>
          </div>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            Not enough overlapping data yet &mdash; this needs at least two days each of good and short sleep, each
            followed by a logged study session, within the selected range. Try a wider range above, or keep logging both.
          </p>
        )}
      </div>
    </div>
  );
}
