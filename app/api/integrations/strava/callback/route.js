import { NextResponse } from 'next/server';
import db from '../../../../../lib/db.js';
import { exchangeCode } from '../../../../../lib/strava.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const userId = Number(state);

  if (error || !code || !userId) {
    return NextResponse.redirect(new URL('/settings?strava=error', request.url));
  }

  try {
    const redirectUri = new URL('/api/integrations/strava/callback', request.url).toString();
    const data = await exchangeCode(code, redirectUri);
    await db.prepare(
      'UPDATE users SET strava_athlete_id=?, strava_access_token=?, strava_refresh_token=?, strava_token_expires_at=? WHERE id=?'
    ).run(String((data.athlete && data.athlete.id) || ''), data.access_token, data.refresh_token, data.expires_at, userId);
    return NextResponse.redirect(new URL('/settings?strava=connected', request.url));
  } catch (err) {
    return NextResponse.redirect(new URL('/settings?strava=error', request.url));
  }
}
