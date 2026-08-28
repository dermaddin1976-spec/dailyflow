const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

export function stravaConfigured() {
  return !!(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);
}

export function buildAuthUrl(redirectUri, state) {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
    state,
  });
  return `${STRAVA_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code, redirectUri) {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error('Strava rejected that connection.');
  return res.json();
}

export async function refreshTokenIfNeeded(row) {
  const now = Math.floor(Date.now() / 1000);
  if (row.strava_token_expires_at && row.strava_token_expires_at > now + 60) {
    return {
      accessToken: row.strava_access_token,
      refreshToken: row.strava_refresh_token,
      expiresAt: row.strava_token_expires_at,
    };
  }
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: row.strava_refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('Could not refresh the Strava connection.');
  const data = await res.json();
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: data.expires_at };
}

export async function fetchActivities(accessToken) {
  const params = new URLSearchParams({ per_page: '50' });
  const res = await fetch(`${STRAVA_API_BASE}/athlete/activities?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Could not fetch activities from Strava.');
  return res.json();
}
