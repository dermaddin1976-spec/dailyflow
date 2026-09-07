import { NextResponse } from 'next/server';
import db from '../../../../../lib/db.js';
import { exchangeCode } from '../../../../../lib/googleCalendar.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const userId = Number(state);

  if (error || !code || !userId) {
    return NextResponse.redirect(new URL('/settings?gcal=error', request.url));
  }

  try {
    const redirectUri = new URL('/api/integrations/google-calendar/callback', request.url).toString();
    const { accessToken, refreshToken, expiresAt, email } = await exchangeCode(code, redirectUri);
    // Google only issues a refresh_token on the first consent for an account,
    // so a reconnect without one must not clobber the refresh_token already on file.
    if (refreshToken) {
      await db.prepare(
        'UPDATE users SET google_calendar_email=?, google_calendar_access_token=?, google_calendar_refresh_token=?, google_calendar_token_expires_at=? WHERE id=?'
      ).run(email, accessToken, refreshToken, expiresAt, userId);
    } else {
      await db.prepare(
        'UPDATE users SET google_calendar_email=?, google_calendar_access_token=?, google_calendar_token_expires_at=? WHERE id=?'
      ).run(email, accessToken, expiresAt, userId);
    }
    return NextResponse.redirect(new URL('/settings?gcal=connected', request.url));
  } catch (err) {
    return NextResponse.redirect(new URL('/settings?gcal=error', request.url));
  }
}
