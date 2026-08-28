import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { getCurrentUser } from '../../../../lib/auth.js';

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { date, type, minutes, intensity, note } = await request.json();
  if (!date || !type || !(minutes > 0)) return NextResponse.json({ error: 'Type and minutes are required.' }, { status: 400 });
  db.prepare('INSERT INTO workout_logs (user_id, date, type, minutes, intensity, note) VALUES (?, ?, ?, ?, ?, ?)')
    .run(user.id, date, type, minutes, intensity || null, note || null);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const rows = db.prepare('SELECT * FROM workout_logs WHERE user_id=? ORDER BY id DESC LIMIT 20').all(user.id);
  return NextResponse.json({ logs: rows });
}
