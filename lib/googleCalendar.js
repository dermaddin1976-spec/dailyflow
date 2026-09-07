const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export function googleCalendarConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function buildAuthUrl(redirectUri, state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function tokenRequest(body) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) throw new Error('Google rejected that connection.');
  return res.json();
}

// Exchanges the OAuth code for tokens, and also grabs the connected
// account's email (shown in Settings) via the userinfo endpoint. Google
// only sends a refresh_token on the very first consent for an account —
// callers should treat a missing one as "keep whatever we already had"
// rather than as an error.
export async function exchangeCode(code, redirectUri) {
  const data = await tokenRequest({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  let email = null;
  try {
    const res = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${data.access_token}` } });
    if (res.ok) { const info = await res.json(); email = info.email || null; }
  } catch (err) { /* email is a nice-to-have, not required */ }
  const expiresAt = Math.floor(Date.now() / 1000) + (data.expires_in || 3600);
  return { accessToken: data.access_token, refreshToken: data.refresh_token || null, expiresAt, email };
}

export async function refreshTokenIfNeeded(row) {
  const now = Math.floor(Date.now() / 1000);
  if (row.google_calendar_token_expires_at && row.google_calendar_token_expires_at > now + 60) {
    return {
      accessToken: row.google_calendar_access_token,
      refreshToken: row.google_calendar_refresh_token,
      expiresAt: row.google_calendar_token_expires_at,
    };
  }
  if (!row.google_calendar_refresh_token) throw new Error('Google Calendar needs to be reconnected.');
  const data = await tokenRequest({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: row.google_calendar_refresh_token,
    grant_type: 'refresh_token',
  });
  const expiresAt = Math.floor(Date.now() / 1000) + (data.expires_in || 3600);
  // Google usually omits refresh_token on a refresh call — keep the one we have.
  return { accessToken: data.access_token, refreshToken: data.refresh_token || row.google_calendar_refresh_token, expiresAt };
}

// Pulls events from the primary calendar in a time window (ISO strings).
// singleEvents=true expands recurring events into individual instances so
// the calendar grid doesn't have to understand recurrence rules itself.
export async function fetchEvents(accessToken, { timeMin, timeMax, maxResults = 250 } = {}) {
  const params = new URLSearchParams({
    timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: String(maxResults),
  });
  const res = await fetch(`${GOOGLE_CALENDAR_API}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Could not fetch events from Google Calendar.');
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}
