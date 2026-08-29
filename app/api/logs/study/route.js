import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { getCurrentUser } from '../../../../lib/auth.js';

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { date, subject, minutes, focus, note } = await request.json();
  if (!date || !subject || !(minutes > 0)) return NextResponse.json({ error: 'Subject and minutes are required.' }, { status: 400 });
  await db.prepare('INSERT INTO study_logs (user_id, date, subject, minutes, focus, note) VALUES (?, ?, ?, ?, ?, ?)')
    .run(user.id, date, subject, minutes, focus || null, note || null);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const rows = await db.prepare('SELECT * FROM study_logs WHERE user_id=? ORDER BY id DESC LIMIT 20').all(user.id);
  return NextResponse.json({ logs: rows });
}
