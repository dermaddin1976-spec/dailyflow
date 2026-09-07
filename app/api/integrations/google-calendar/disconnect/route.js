import { NextResponse } from 'next/server';
import db from '../../../../../lib/db.js';
import { getCurrentUser } from '../../../../../lib/auth.js';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  await db.prepare(
    'UPDATE users SET google_calendar_email=NULL, google_calendar_access_token=NULL, google_calendar_refresh_token=NULL, google_calendar_token_expires_at=NULL WHERE id=?'
  ).run(user.id);
  // Synced events stay in the calendar as a record, same as Strava
  // activities do when you disconnect — only the connection itself is cut.
  return NextResponse.json({ ok: true });
}
