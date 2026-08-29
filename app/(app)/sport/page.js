import { getCurrentUser } from '../../../lib/auth.js';
import db from '../../../lib/db.js';
import InfoTip from '../info-tip.js';
import { BarChart, lastNDates } from '../bar-chart.js';
import SessionLogger from '../session-logger.js';
import { StravaImportCard } from '../settings-forms.js';
import ActivityIcon from '../activity-icon.js';
import { computeStreak } from '../../../lib/streak.js';

export default async function SportPage() {
  const user = await getCurrentUser();
  const dates = lastNDates(7);
  const weekStart = dates[0], weekEnd = dates[dates.length - 1];

  const dailyRows = await db.prepare(
    'SELECT date, SUM(minutes) as minutes FROM workout_logs WHERE user_id=? AND date BETWEEN ? AND ? GROUP BY date'
  ).all(user.id, weekStart, weekEnd);
  const dailyMap = Object.fromEntries(dailyRows.map(r => [r.date, r.minutes || 0]));

  const totals = await db.prepare(
    'SELECT COALESCE(SUM(minutes),0) as minutes, COUNT(*) as sessions, AVG(intensity) as avgIntensity FROM workout_logs WHERE user_id=? AND date BETWEEN ? AND ?'
  ).get(user.id, weekStart, weekEnd);

  const byType = await db.prepare(
    'SELECT type, COALESCE(SUM(minutes),0) as minutes FROM workout_logs WHERE user_id=? AND date BETWEEN ? AND ? GROUP BY type ORDER BY minutes DESC'
  ).all(user.id, weekStart, weekEnd);

  const allDates = (await db.prepare('SELECT DISTINCT date FROM workout_logs WHERE user_id=? ORDER BY date DESC').all(user.id)).map(r => r.date);
  const streak = computeStreak(allDates);

  const personalRecords = await db.prepare(`
    SELECT w.type, w.minutes, w.intensity, w.date FROM workout_logs w
    WHERE w.user_id=? AND w.minutes = (
      SELECT MAX(w2.minutes) FROM workout_logs w2 WHERE w2.user_id = w.user_id AND w2.type = w.type
    )
    GROUP BY w.type
    ORDER BY w.minutes DESC
  `).all(user.id);

  const longestRun = await db.prepare(`
    SELECT date, distance_km, minutes FROM workout_logs
    WHERE user_id=? AND distance_km IS NOT NULL AND type LIKE '%Run%'
    ORDER BY distance_km DESC LIMIT 1
  `).get(user.id);

  const fastestRun = await db.prepare(`
    SELECT date, distance_km, minutes, (minutes * 1.0 / distance_km) as paceMinPerKm FROM workout_logs
    WHERE user_id=? AND distance_km IS NOT NULL AND distance_km > 0 AND minutes IS NOT NULL AND minutes > 0 AND type LIKE '%Run%'
    ORDER BY paceMinPerKm ASC LIMIT 1
  `).get(user.id);

  function formatPace(minPerKm) {
    const mins = Math.floor(minPerKm);
    const secs = Math.round((minPerKm - mins) * 60);
    return mins + ':' + String(secs).padStart(2, '0') + '/km';
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Sport</h1>
        <InfoTip>
          This week's chart and totals are built from every session you log below. The same 7-day total also feeds
          the "Training balance" part of your Readiness score on Today &mdash; too little movement or too much both
          pull that score down, so this is where you can see the number behind it.
        </InfoTip>
      </div>
      <p style={{ color: 'var(--text-2)', marginBottom: 24 }}>This week&rsquo;s training load.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 24, marginBottom: 28 }}>
        <BarChart title="Minutes per day" unit="m" dates={dates} values={dates.map(d => dailyMap[d] || 0)} />

        <div className="card">
          <h3 style={{ marginBottom: 14 }}>This week</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: byType.length ? 18 : 0 }}>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', letterSpacing: '.03em' }}>TOTAL</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{totals.minutes}m</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', letterSpacing: '.03em' }}>SESSIONS</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{totals.sessions}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', letterSpacing: '.03em' }}>AVG INTENSITY</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>
                {totals.avgIntensity ? totals.avgIntensity.toFixed(1) : '—'}
              </div>
            </div>
          </div>
          {byType.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {byType.map(t => (
                <div key={t.type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-2)' }}>{t.type}</span>
                  <span className="mono" style={{ color: 'var(--muted)' }}>{t.minutes}m</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: 24, marginBottom: 28 }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h3 style={{ margin: 0 }}>Streak</h3>
            <InfoTip>
              Consecutive days with at least one session logged. Today gets a grace period &mdash; the streak won't
              reset just because you haven't logged yet today, but it will if yesterday is missing once today ends.
            </InfoTip>
          </div>
          <div className="mono" style={{ fontSize: 36, fontWeight: 700, marginTop: 8 }}>
            {streak}<span style={{ fontSize: 16, color: 'var(--muted)', fontWeight: 500 }}> day{streak === 1 ? '' : 's'}</span>
          </div>
          <p style={{ color: 'var(--text-2)', fontSize: 12.5, marginTop: 6 }}>
            {streak === 0 ? 'Log a session today to start one.' : 'Keep it going.'}
          </p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <h3 style={{ margin: 0 }}>Personal records</h3>
            <InfoTip>
              Your longest logged session for each workout type, all-time, plus your longest and fastest run by
              distance from Strava-synced runs. New records show up here automatically the moment a session beats
              the old one.
            </InfoTip>
          </div>
          {personalRecords.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 10 }}>Log a session to set your first record.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              {personalRecords.map(pr => (
                <div key={pr.type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-2)' }}>
                    <ActivityIcon type={pr.type} size={16} />
                    {pr.type}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono" style={{ fontWeight: 600 }}>{pr.minutes}m</span>
                    <span className="mono" style={{ color: 'var(--muted)', fontSize: 11 }}>{pr.date}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
          {(longestRun || fastestRun) && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 10,
              marginTop: personalRecords.length ? 14 : 10,
              paddingTop: personalRecords.length ? 14 : 0,
              borderTop: personalRecords.length ? '1px solid var(--border)' : 'none',
            }}>
              {longestRun && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-2)' }}>Longest run</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono" style={{ fontWeight: 600 }}>{longestRun.distance_km} km</span>
                    <span className="mono" style={{ color: 'var(--muted)', fontSize: 11 }}>{longestRun.date}</span>
                  </span>
                </div>
              )}
              {fastestRun && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-2)' }}>Fastest run</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="mono" style={{ fontWeight: 600 }}>{formatPace(fastestRun.paceMinPerKm)}</span>
                    <span className="mono" style={{ color: 'var(--muted)', fontSize: 11 }}>{fastestRun.date}</span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <StravaImportCard connected={user.strava_connected} />

      <SessionLogger />
    </div>
  );
}
