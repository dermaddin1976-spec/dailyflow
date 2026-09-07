import { requireUser } from '../../../lib/auth.js';
import db from '../../../lib/db.js';
import InfoTip from '../info-tip.js';
import { BarChart, lastNDates } from '../bar-chart.js';
import SleepLogger from '../sleep-logger.js';
import Link from 'next/link';
import { recommendedSleepHours, computeSleepDebt, debtLabel, formatHM } from '../../../lib/sleep.js';

export default async function SleepPage() {
  const user = await requireUser();
  const dates = lastNDates(7);
  const weekStart = dates[0], weekEnd = dates[dates.length - 1];

  const DEBT_WINDOW_DAYS = 14;
  const debtDates = lastNDates(DEBT_WINDOW_DAYS);

  // None of these reads depend on each other's results, so run them all at
  // once instead of one after another.
  const [dailyRows, totals, debtRows] = await Promise.all([
    db.prepare(
      'SELECT date, AVG(hours) as hours FROM sleep_logs WHERE user_id=? AND date BETWEEN ? AND ? GROUP BY date'
    ).all(user.id, weekStart, weekEnd),
    db.prepare(
      'SELECT COUNT(*) as nights, AVG(hours) as avgHours, AVG(quality) as avgQuality FROM sleep_logs WHERE user_id=? AND date BETWEEN ? AND ?'
    ).get(user.id, weekStart, weekEnd),
    db.prepare(
      'SELECT date, AVG(hours) as hours FROM sleep_logs WHERE user_id=? AND date BETWEEN ? AND ? GROUP BY date'
    ).all(user.id, debtDates[0], debtDates[debtDates.length - 1]),
  ]);
  const dailyMap = Object.fromEntries(dailyRows.map(r => [r.date, Math.round((r.hours || 0) * 10) / 10]));
  const target = recommendedSleepHours(user.age);
  const debt = computeSleepDebt(debtRows.map(r => r.hours), target, DEBT_WINDOW_DAYS);
  const debtStatus = debtLabel(debt.debtHours);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Sleep</h1>
        <InfoTip>
          This week's chart and totals come from every night you log below. Last night's entry specifically is what
          feeds the "Sleep" part of your Readiness score on Today, scored against the same age-based target as the
          sleep debt card further down.
        </InfoTip>
      </div>
      <p style={{ color: 'var(--text-2)', marginBottom: 24 }}>This week&rsquo;s sleep.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 24, marginBottom: 28 }}>
        <BarChart title="Hours per night" unit="h" dates={dates} values={dates.map(d => dailyMap[d] || 0)} formatValue={formatHM} />

        <div className="card">
          <h3 style={{ marginBottom: 14 }}>This week</h3>
          <div className="mini-stats">
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', letterSpacing: '.03em' }}>AVG HOURS</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>
                {totals.avgHours ? formatHM(totals.avgHours) : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', letterSpacing: '.03em' }}>AVG QUALITY</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>
                {totals.avgQuality ? totals.avgQuality.toFixed(1) : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', letterSpacing: '.03em' }}>NIGHTS LOGGED</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{totals.nights}/7</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h3 style={{ margin: 0 }}>Sleep debt</h3>
              <InfoTip>
                Your target is {formatHM(target)} a night, based on{user.age ? ` your age (${user.age})` : ' a default adult target'} &mdash;
                add your age in Settings for a number tailored to you. Debt adds up the gap between that target and
                what you actually logged over the last {DEBT_WINDOW_DAYS} days, counting only nights you've logged.
                A run of good nights pays it back down, but it never goes below zero &mdash; you can't bank extra sleep
                for later.
              </InfoTip>
            </div>
            <p style={{ color: 'var(--text-2)', fontSize: 12.5 }}>
              Last {DEBT_WINDOW_DAYS} days &middot; {debt.nightsLogged} night{debt.nightsLogged === 1 ? '' : 's'} logged
              {debt.avgHours != null ? ` \u00b7 avg ${formatHM(debt.avgHours)}` : ''} &middot; target {formatHM(target)}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mono" style={{ fontSize: 32, fontWeight: 700, color: debtStatus.color }}>
              {formatHM(debt.debtHours)}
            </div>
            <div style={{ fontSize: 12.5, color: debtStatus.color, marginTop: 2 }}>{debtStatus.text}</div>
          </div>
        </div>
        {!user.age && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 14 }}>
            Using a default 8h target. <Link href="/settings">Add your age in Settings</Link> for one based on you.
          </p>
        )}
      </div>

      <SleepLogger />
    </div>
  );
}
