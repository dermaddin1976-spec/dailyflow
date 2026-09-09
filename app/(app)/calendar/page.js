import { requireUser } from '../../../lib/auth.js';
import db from '../../../lib/db.js';
import CalendarView from './calendar-view.js';
import DeadlinesCard from '../deadlines-card.js';

export default async function CalendarPage({ searchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const gcalStatus = sp && sp.gcal ? sp.gcal : null;

  const deadlines = await db.prepare('SELECT id, title, due_date FROM deadlines WHERE user_id=? ORDER BY due_date ASC').all(user.id);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Calendar</h1>
      <CalendarView
        deadlines={deadlines}
        googleCalendarConnected={!!user.google_calendar_connected}
        googleCalendarEmail={user.google_calendar_email || null}
        gcalStatus={gcalStatus}
      />
      <div style={{ marginTop: 20 }}>
        <DeadlinesCard />
      </div>
    </div>
  );
}
