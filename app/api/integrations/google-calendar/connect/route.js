import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../../lib/auth.js';
import { buildAuthUrl, googleCalendarConfigured } from '../../../../../lib/googleCalendar.js';

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/login', request.url));
  if (!googleCalendarConfigured()) {
    return NextResponse.redirect(new URL('/settings?gcal=not_configured', request.url));
  }
  const redirectUri = new URL('/api/integrations/google-calendar/callback', request.url).toString();
  const state = String(user.id);
  const authUrl = buildAuthUrl(redirectUri, state);
  return NextResponse.redirect(authUrl);
}
