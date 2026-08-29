import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { getCurrentUser } from '../../../../lib/auth.js';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const rows = await db.prepare('SELECT * FROM weight_logs WHERE user_id=? ORDER BY date DESC, id DESC LIMIT 60').all(user.id);
  return NextResponse.json({ logs: rows });
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { date, weight_kg } = await request.json();
  if (!date || !(weight_kg > 0)) {
    return NextResponse.json({ error: 'A date and weight are required.' }, { status: 400 });
  }

  const existing = await db.prepare('SELECT id FROM weight_logs WHERE user_id=? AND date=?').get(user.id, date);
  if (existing) {
    await db.prepare('UPDATE weight_logs SET weight_kg=?, source=? WHERE id=?').run(weight_kg, 'manual', existing.id);
  } else {
    await db.prepare('INSERT INTO weight_logs (user_id, date, weight_kg, source) VALUES (?, ?, ?, ?)')
      .run(user.id, date, weight_kg, 'manual');
  }

  const latest = await db.prepare('SELECT weight_kg FROM weight_logs WHERE user_id=? ORDER BY date DESC LIMIT 1').get(user.id);
  if (latest) await db.prepare('UPDATE users SET weight_kg=? WHERE id=?').run(latest.weight_kg, user.id);

  return NextResponse.json({ ok: true });
}
