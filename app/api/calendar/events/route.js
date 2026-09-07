import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { getCurrentUser } from '../../../../lib/auth.js';

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  // Overlap test against a [start, end) window: an event with no end_at is
  // treated as a zero-duration point at its start_at for this comparison.
  const rows = (start && end)
    ? await db.prepare(
        'SELECT * FROM calendar_events WHERE user_id=? AND start_at < ? AND COALESCE(end_at, start_at) >= ? ORDER BY start_at ASC'
      ).all(user.id, end, start)
    : await db.prepare('SELECT * FROM calendar_events WHERE user_id=? ORDER BY start_at ASC').all(user.id);
  return NextResponse.json({ events: rows });
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const body = await request.json();
  const { title, notes, location, start_at, end_at, all_day } = body || {};
  if (!title || !start_at) {
    return NextResponse.json({ error: 'Title and start time are required.' }, { status: 400 });
  }
  const row = await db.prepare(
    "INSERT INTO calendar_events (user_id, title, notes, location, start_at, end_at, all_day, source) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual') RETURNING *"
  ).get(user.id, title, notes || null, location || null, start_at, end_at || null, all_day ? 1 : 0);
  return NextResponse.json({ ok: true, event: row });
}
