import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../../lib/auth.js';
import { buildAuthUrl, stravaConfigured } from '../../../../../lib/strava.js';

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/login', request.url));
  if (!stravaConfigured()) {
    return NextResponse.redirect(new URL('/settings?strava=not_configured', request.url));
  }
  const redirectUri = new URL('/api/integrations/strava/callback', request.url).toString();
  const state = String(user.id);
  const authUrl = buildAuthUrl(redirectUri, state);
  return NextResponse.redirect(authUrl);
}
