import { requireUser } from '../../../lib/auth.js';
import db from '../../../lib/db.js';
import InfoTip from '../info-tip.js';
import { BarChart, lastNDates } from '../bar-chart.js';
import StudyLogger from '../study-logger.js';
import StudyWorkspace from '../study-workspace.js';

export default async function StudyPage() {
  const user = await requireUser();
  const dates = lastNDates(7);
  const weekStart = dates[0], weekEnd = dates[dates.length - 1];

  const dailyRows = await db.prepare(
    'SELECT date, SUM(minutes) as minutes FROM study_logs WHERE user_id=? AND date BETWEEN ? AND ? GROUP BY date'
  ).all(user.id, weekStart, weekEnd);
  const dailyMap = Object.fromEntries(dailyRows.map(r => [r.date, r.minutes || 0]));

  const totals = await db.prepare(
    'SELECT COALESCE(SUM(minutes),0) as minutes, COUNT(*) as sessions, AVG(focus) as avgFocus FROM study_logs WHERE user_id=? AND date BETWEEN ? AND ?'
  ).get(user.id, weekStart, weekEnd);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Study</h1>
        <InfoTip>
          This week's chart and totals are built from every session you log below. The same 7-day total also feeds
          the "Study" part of your Readiness score on Today &mdash; a little regular studying counts, and the score
          fills in once you've logged a few sessions.
        </InfoTip>
      </div>
      <p style={{ color: 'var(--text-2)', marginBottom: 24 }}>This week&rsquo;s study time, plus your flashcard decks and DailyAI-generated notes.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 24, marginBottom: 28 }}>
        <BarChart title="Minutes per day" unit="m" dates={dates} values={dates.map(d => dailyMap[d] || 0)} />

        <div className="card">
          <h3 style={{ marginBottom: 14 }}>This week</h3>
          <div className="mini-stats">
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', letterSpacing: '.03em' }}>TOTAL</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{totals.minutes}m</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', letterSpacing: '.03em' }}>SESSIONS</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>{totals.sessions}</div>
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', letterSpacing: '.03em' }}>AVG FOCUS</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>
                {totals.avgFocus ? totals.avgFocus.toFixed(1) : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <StudyLogger />
      <StudyWorkspace />
    </div>
  );
}
