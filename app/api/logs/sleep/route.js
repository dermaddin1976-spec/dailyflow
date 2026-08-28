import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { getCurrentUser } from '../../../../lib/auth.js';

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { date, hours, quality, note } = await request.json();
  if (!date || !(hours >= 0)) return NextResponse.json({ error: 'Hours is required.' }, { status: 400 });
  db.prepare('INSERT INTO sleep_logs (user_id, date, hours, quality, note) VALUES (?, ?, ?, ?, ?)')
    .run(user.id, date, hours, quality || null, note || null);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const rows = db.prepare('SELECT * FROM sleep_logs WHERE user_id=? ORDER BY id DESC LIMIT 20').all(user.id);
  return NextResponse.json({ logs: rows });
}
