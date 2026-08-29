import { NextResponse } from 'next/server';
import db from '../../../../../lib/db.js';
import { getCurrentUser } from '../../../../../lib/auth.js';
import { refreshTokenIfNeeded, fetchAllActivities } from '../../../../../lib/strava.js';

function typeToLabel(activity) {
  return activity.sport_type || activity.type || 'Workout';
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  let body = {};
  try { body = await request.json(); } catch { /* no body sent */ }
  const selectedIds = Array.isArray(body.activityIds) ? new Set(body.activityIds.map(String)) : null;
  if (!selectedIds || selectedIds.size === 0) {
    return NextResponse.json({ error: 'No activities selected.' }, { status: 400 });
  }

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

    const insert = db.prepare(
      'INSERT INTO workout_logs (user_id, date, type, minutes, intensity, note, strava_activity_id, distance_km, title) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    let added = 0;
    for (const a of activities) {
      const activityId = String(a.id);
      if (seen.has(activityId)) continue;
      if (!selectedIds.has(activityId)) continue;
      const date = (a.start_date_local || a.start_date || '').slice(0, 10);
      if (!date) continue;
      const minutes = Math.round((a.moving_time || 0) / 60);
      if (minutes <= 0) continue;
      const distanceKm = a.distance ? Number((a.distance / 1000).toFixed(2)) : null;
      await insert.run(user.id, date, typeToLabel(a), minutes, null, 'Synced from Strava', activityId, distanceKm, a.name || null);
      seen.add(activityId);
      added++;
    }

    return NextResponse.json({ ok: true, added, total: activities.length });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Sync failed.' }, { status: 502 });
  }
}
