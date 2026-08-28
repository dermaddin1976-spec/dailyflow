import { NextResponse } from 'next/server';
import db from '../../../../../lib/db.js';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getBearerToken(request) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function POST(request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Missing Authorization: Bearer <token> header.' }, { status: 401 });
  }
  const user = db.prepare('SELECT id FROM users WHERE apple_health_token=?').get(token);
  if (!user) {
    return NextResponse.json({ error: 'Invalid or revoked token.' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const date = (body.date && String(body.date).slice(0, 10)) || todayStr();
  const synced = [];

  if (body.sleep_hours != null && Number(body.sleep_hours) >= 0) {
    const hours = Number(body.sleep_hours);
    const quality = body.sleep_quality != null ? Number(body.sleep_quality) : null;
    const existing = db.prepare('SELECT id FROM sleep_logs WHERE user_id=? AND date=?').get(user.id, date);
    if (existing) {
      db.prepare('UPDATE sleep_logs SET hours=?, quality=?, note=? WHERE id=?')
        .run(hours, quality, 'Synced from Apple Health', existing.id);
    } else {
      db.prepare('INSERT INTO sleep_logs (user_id, date, hours, quality, note) VALUES (?, ?, ?, ?, ?)')
        .run(user.id, date, hours, quality, 'Synced from Apple Health');
    }
    synced.push('sleep');
  }

  if (body.weight_kg != null && Number(body.weight_kg) > 0) {
    const weightKg = Number(body.weight_kg);
    db.prepare('DELETE FROM weight_logs WHERE user_id=? AND date=?').run(user.id, date);
    db.prepare('INSERT INTO weight_logs (user_id, date, weight_kg, source) VALUES (?, ?, ?, ?)')
      .run(user.id, date, weightKg, 'apple_health');
    db.prepare('UPDATE users SET weight_kg=? WHERE id=?').run(weightKg, user.id);
    synced.push('weight');
  }

  if (body.workout_minutes != null && Number(body.workout_minutes) > 0) {
    const minutes = Math.round(Number(body.workout_minutes));
    const type = (body.workout_type && String(body.workout_type)) || 'Workout';
    db.prepare("DELETE FROM workout_logs WHERE user_id=? AND date=? AND note='Synced from Apple Health'")
      .run(user.id, date);
    db.prepare('INSERT INTO workout_logs (user_id, date, type, minutes, intensity, note) VALUES (?, ?, ?, ?, ?, ?)')
      .run(user.id, date, type, minutes, null, 'Synced from Apple Health');
    synced.push('workout');
  }

  if (synced.length === 0) {
    return NextResponse.json({ error: 'No recognized fields — send sleep_hours, weight_kg, and/or workout_minutes.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, date, synced });
}
