import { NextResponse } from 'next/server';
import db from '../../../../../lib/db.js';
import { getCurrentUser } from '../../../../../lib/auth.js';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  await db.prepare(
    'UPDATE users SET strava_athlete_id=NULL, strava_access_token=NULL, strava_refresh_token=NULL, strava_token_expires_at=NULL WHERE id=?'
  ).run(user.id);
  return NextResponse.json({ ok: true });
}
