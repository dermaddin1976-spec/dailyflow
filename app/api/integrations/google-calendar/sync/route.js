import { NextResponse } from 'next/server';
import db from '../../../../../lib/db.js';
import { getCurrentUser } from '../../../../../lib/auth.js';
import { refreshTokenIfNeeded, fetchEvents } from '../../../../../lib/googleCalendar.js';

// A Google event's start/end is either a { date } (all-day) or a
// { dateTime } (timed) — this normalizes both into what calendar_events stores.
function toStored(part) {
  if (!part) return { value: null, allDay: false };
  if (part.date) return { value: `${part.date}T00:00:00`, allDay: true };
  if (part.dateTime) return { value: part.dateTime, allDay: false };
  return { value: null, allDay: false };
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const row = await db.prepare(
    'SELECT google_calendar_access_token, google_calendar_refresh_token, google_calendar_token_expires_at FROM users WHERE id=?'
  ).get(user.id);
  if (!row || !row.google_calendar_access_token) {
    return NextResponse.json({ error: 'Google Calendar is not connected.' }, { status: 400 });
  }

  try {
    const { accessToken, refreshToken, expiresAt } = await refreshTokenIfNeeded(row);
    if (accessToken !== row.google_calendar_access_token) {
      await db.prepare(
        'UPDATE users SET google_calendar_access_token=?, google_calendar_refresh_token=?, google_calendar_token_expires_at=? WHERE id=?'
      ).run(accessToken, refreshToken, expiresAt, user.id);
    }

    // A generous window either side of today — far enough back to catch
    // things worth seeing in Trends, far enough ahead to catch the term's deadlines.
    const now = new Date();
    const timeMin = new Date(now.getTime() - 30 * 86400000).toISOString();
    const timeMax = new Date(now.getTime() + 180 * 86400000).toISOString();
    const events = await fetchEvents(accessToken, { timeMin, timeMax });

    const upsert = db.prepare(`
      INSERT INTO calendar_events (user_id, title, notes, location, start_at, end_at, all_day, source, google_event_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'google', ?)
      ON CONFLICT (user_id, google_event_id) DO UPDATE SET
        title=EXCLUDED.title, notes=EXCLUDED.notes, location=EXCLUDED.location,
        start_at=EXCLUDED.start_at, end_at=EXCLUDED.end_at, all_day=EXCLUDED.all_day
    `);
    const del = db.prepare('DELETE FROM calendar_events WHERE user_id=? AND google_event_id=?');

    let synced = 0;
    for (const ev of events) {
      if (!ev.id) continue;
      if (ev.status === 'cancelled') { await del.run(user.id, ev.id); continue; }
      const start = toStored(ev.start);
      if (!start.value) continue;
      const end = toStored(ev.end);
      await upsert.run(
        user.id, ev.summary || '(untitled event)', ev.description || null, ev.location || null,
        start.value, end.value, start.allDay ? 1 : 0, ev.id
      );
      synced++;
    }

    return NextResponse.json({ ok: true, synced, total: events.length });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Sync failed.' }, { status: 502 });
  }
}
