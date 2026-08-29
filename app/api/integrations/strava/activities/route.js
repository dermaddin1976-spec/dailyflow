import { NextResponse } from 'next/server';
import db from '../../../../../lib/db.js';
import { getCurrentUser } from '../../../../../lib/auth.js';
import { refreshTokenIfNeeded, fetchAllActivities } from '../../../../../lib/strava.js';

function typeToLabel(activity) {
  return activity.sport_type || activity.type || 'Workout';
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const row = await db.prepare(
    'SELECT strava_access_token, strava_refresh_token, strava_token_expires_at FROM users WHERE id=?'
  ).get(user.id);
  if (!row || !row.strava_access_token) {
    return NextResponse.json({ error: 'Strava is not connected.' }, { status: 400 });
  }

  try {
    const { accessToken, refreshToken, expiresAt } = await refreshTokenIfNeeded(row);
    if (accessToken !== row.strava_access_token) {
      await db.prepare(
        'UPDATE users SET strava_access_token=?, strava_refresh_token=?, strava_token_expires_at=? WHERE id=?'
      ).run(accessToken, refreshToken, expiresAt, user.id);
    }

    const activities = await fetchAllActivities(accessToken);
    const existing = await db.prepare(
      'SELECT strava_activity_id FROM workout_logs WHERE user_id=? AND strava_activity_id IS NOT NULL'
    ).all(user.id);
    const seen = new Set(existing.map(r => r.strava_activity_id));

    const list = activities
      .filter(a => !seen.has(String(a.id)))
      .map(a => {
        const date = (a.start_date_local || a.start_date || '').slice(0, 10);
        const minutes = Math.round((a.moving_time || 0) / 60);
        return {
          id: String(a.id),
          name: a.name || typeToLabel(a),
          type: typeToLabel(a),
          date,
          minutes,
          distanceKm: a.distance ? Number((a.distance / 1000).toFixed(1)) : null,
        };
      })
      .filter(a => a.date && a.minutes > 0);

    return NextResponse.json({ ok: true, activities: list, fetched: activities.length });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Could not load activities.' }, { status: 502 });
  }
}
