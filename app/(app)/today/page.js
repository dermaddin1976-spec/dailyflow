import Link from 'next/link';
import { getCurrentUser } from '../../../lib/auth.js';
import db from '../../../lib/db.js';
import DeadlinesCard from '../deadlines-card.js';
import InfoTip from '../info-tip.js';
import { recommendedSleepHours, computeSleepDebt } from '../../../lib/sleep.js';
import { computeStreak } from '../../../lib/streak.js';
import { lastNDates } from '../bar-chart.js';

function todayStr(){ return new Date().toISOString().slice(0,10); }
function dateStr(offset){ const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0,10); }
function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000); }

function computeReadiness(userId, userAge) {
  const lastSleep = db.prepare('SELECT * FROM sleep_logs WHERE user_id=? ORDER BY date DESC LIMIT 1').get(userId);
  const weekStart = dateStr(-6), weekEnd = dateStr(0);
  const training = db.prepare('SELECT COALESCE(SUM(minutes),0) as total FROM workout_logs WHERE user_id=? AND date BETWEEN ? AND ?').get(userId, weekStart, weekEnd);
  const studyWeek = db.prepare('SELECT COALESCE(SUM(minutes),0) as total FROM study_logs WHERE user_id=? AND date BETWEEN ? AND ?').get(userId, weekStart, weekEnd);
  const yesterday = dateStr(-1);
  const yesterdayMeals = db.prepare('SELECT COALESCE(SUM(calories),0) as total, COUNT(*) as count FROM meal_logs WHERE user_id=? AND date=?').get(userId, yesterday);
  const priorStart = dateStr(-7), priorEnd = dateStr(-2);
  const priorDays = db.prepare('SELECT date, SUM(calories) as total FROM meal_logs WHERE user_id=? AND date BETWEEN ? AND ? GROUP BY date').all(userId, priorStart, priorEnd);

  const components = [];

  const sleepTarget = recommendedSleepHours(userAge);
  if (lastSleep) {
    const score = Math.max(0, Math.min(100, Math.round((lastSleep.hours / sleepTarget) * 100)));
    components.push({ name: 'Sleep', score, reason: `${lastSleep.hours}h logged` });
  } else {
    components.push({ name: 'Sleep', score: null, reason: 'Not logged yet' });
  }

  const total7 = training.total;
  let trainScore;
  if (total7 <= 150) trainScore = Math.round((total7 / 150) * 100);
  else if (total7 <= 400) trainScore = 100;
  else trainScore = Math.max(60, Math.round(100 - (total7 - 400) / 10));
  components.push({ name: 'Training balance', score: trainScore, reason: `${total7}m this week` });

  const studyTotal7 = studyWeek.total;
  if (studyTotal7 > 0) {
    const studyScore = Math.max(0, Math.min(100, Math.round((studyTotal7 / 300) * 100)));
    components.push({ name: 'Study', score: studyScore, reason: `${studyTotal7}m this week` });
  } else {
    components.push({ name: 'Study', score: null, reason: 'Not logged yet' });
  }

  if (yesterdayMeals.count > 0 && priorDays.length >= 3) {
    const avgPrior = priorDays.reduce((s, r) => s + r.total, 0) / priorDays.length;
    const deviation = avgPrior > 0 ? Math.abs(yesterdayMeals.total - avgPrior) / avgPrior : 0;
    const score = Math.max(0, Math.round(100 - deviation * 150));
    components.push({ name: 'Nutrition consistency', score, reason: `${yesterdayMeals.total} cal yesterday` });
  } else {
    components.push({ name: 'Nutrition consistency', score: null, reason: 'Log a few more meals to unlock this' });
  }

  const included = components.filter(c => c.score != null);
  const overall = included.length ? Math.round(included.reduce((s, c) => s + c.score, 0) / included.length) : null;

  let label = 'Not enough data yet';
  if (overall != null) {
    if (overall >= 85) label = 'Primed';
    else if (overall >= 65) label = 'Steady';
    else if (overall >= 45) label = 'Take it easier today';
    else label = 'Prioritize recovery';
  }

  return { overall, label, components };
}

function scoreColor(score) {
  if (score == null) return 'var(--border-strong)';
  if (score >= 85) return 'var(--good)';
  if (score >= 65) return 'var(--accent)';
  if (score >= 45) return 'var(--warning)';
  return 'var(--critical)';
}

export default async function TodayPage() {
  const user = await getCurrentUser();
  const date = todayStr();
  const sleep = db.prepare('SELECT * FROM sleep_logs WHERE user_id=? AND date=? ORDER BY id DESC LIMIT 1').get(user.id, date);
  const study = db.prepare('SELECT COALESCE(SUM(minutes),0) as total FROM study_logs WHERE user_id=? AND date=?').get(user.id, date);
  const workout = db.prepare('SELECT COALESCE(SUM(minutes),0) as total FROM workout_logs WHERE user_id=? AND date=?').get(user.id, date);
  const meals = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(calories),0) as calories FROM meal_logs WHERE user_id=? AND date=?').get(user.id, date);
  const readiness = computeReadiness(user.id, user.age);

  const allWorkoutDates = db.prepare('SELECT DISTINCT date FROM workout_logs WHERE user_id=?').all(user.id).map(r => r.date);
  const streak = computeStreak(allWorkoutDates);

  const DEBT_WINDOW_DAYS = 14;
  const debtDates = lastNDates(DEBT_WINDOW_DAYS);
  const debtRows = db.prepare(
    'SELECT date, AVG(hours) as hours FROM sleep_logs WHERE user_id=? AND date BETWEEN ? AND ? GROUP BY date'
  ).all(user.id, debtDates[0], debtDates[debtDates.length - 1]);
  const sleepDebt = computeSleepDebt(debtRows.map(r => r.hours), recommendedSleepHours(user.age), DEBT_WINDOW_DAYS);

  const latestPlan = db.prepare('SELECT * FROM meal_plans WHERE user_id=? ORDER BY id DESC LIMIT 1').get(user.id);
  let todaysMeals = null;
  if (latestPlan) {
    const planStart = latestPlan.created_at.slice(0, 10);
    const dayIndex = daysBetween(planStart, date);
    const planDays = latestPlan.plan_json ? JSON.parse(latestPlan.plan_json) : [];
    if (dayIndex >= 0 && dayIndex < planDays.length) {
      todaysMeals = { plan: latestPlan, day: planDays[dayIndex] };
    }
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = (user.name || user.email.split('@')[0]);

  const summaryParts = [];
  if (streak > 0) summaryParts.push(`${streak}-day training streak`);
  if (sleepDebt.nightsLogged > 0) summaryParts.push(sleepDebt.debtHours > 0 ? `sleep debt at ${sleepDebt.debtHours}h` : 'no sleep debt');
  if (meals.count > 0) summaryParts.push(`${meals.count} meal${meals.count === 1 ? '' : 's'} logged today`);
  const summaryLine = summaryParts.join(' · ');

  const tiles = [
    { label: 'SLEEP', value: sleep ? `${sleep.hours}h` : '—' },
    { label: 'STUDY', value: `${study.total}m` },
    { label: 'TRAINING', value: `${workout.total}m` },
    { label: 'STREAK', value: `${streak}d` },
    { label: 'MEALS', value: `${meals.count} · ${meals.calories} cal` },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>{greeting}, {firstName}</h1>
      <p style={{ color: 'var(--text-2)', marginBottom: summaryLine ? 4 : 24 }}>Here&rsquo;s today at a glance.</p>
      {summaryLine && <p className="mono" style={{ color: 'var(--muted)', fontSize: 12.5, marginBottom: 24 }}>{summaryLine}</p>}

      <div className="card" style={{ marginBottom: 24, padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '.03em' }}>READINESS</span>
          <InfoTip>
            A rough sense of how your body and habits are doing, built from what you've already logged: how much you
            slept last night (compared to a target based on your age), whether your training over the past week has
            been balanced &mdash; not too little, not too much &mdash; how much you've studied this week, and whether
            yesterday's eating was in line with your usual pattern. Each part needs a little data before it counts,
            so the score fills in as you log more.
          </InfoTip>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center', minWidth: 100 }}>
            <div className="mono" style={{ fontSize: 44, fontWeight: 700, color: scoreColor(readiness.overall) }}>
              {readiness.overall != null ? readiness.overall : '—'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{readiness.label}</div>
          </div>
          <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {readiness.components.map(c => (
              <div key={c.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-2)' }}>{c.name}</span>
                  <span className="mono" style={{ color: 'var(--muted)' }}>{c.reason}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${c.score ?? 6}%`, background: scoreColor(c.score), borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 16 }}>
        {tiles.map(t => (
          <div className="card" key={t.label}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '.03em' }}>{t.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }} className="mono">{t.value}</div>
          </div>
        ))}
      </div>

      {todaysMeals && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h3 style={{ margin: 0 }}>Today&rsquo;s meals</h3>
            <Link href={`/nutrition/planner?open=${todaysMeals.plan.id}`} style={{ fontSize: 12.5, flexShrink: 0 }}>View full plan &rarr;</Link>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 11.5, marginBottom: 12 }}>{todaysMeals.plan.title} &middot; {todaysMeals.day.day}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {todaysMeals.day.meals.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5 }}>
                <span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginRight: 8 }}>{m.meal}</span>
                  {m.name}
                </span>
                <span className="mono" style={{ color: 'var(--muted)', fontSize: 11.5, flexShrink: 0 }}>{m.calories} cal</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <DeadlinesCard />
      <p style={{ marginTop: 24 }}><Link href="/log">See recent activity, or log something for today &rarr;</Link></p>
    </div>
  );
}
