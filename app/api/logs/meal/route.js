import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { getCurrentUser } from '../../../../lib/auth.js';

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { date, description, calories, protein, carbs, fat, note } = await request.json();
  if (!date || !description) return NextResponse.json({ error: 'A description is required.' }, { status: 400 });
  db.prepare('INSERT INTO meal_logs (user_id, date, description, calories, protein, carbs, fat, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(user.id, date, description, calories || null, protein || null, carbs || null, fat || null, note || null);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const rows = db.prepare('SELECT * FROM meal_logs WHERE user_id=? ORDER BY id DESC LIMIT 20').all(user.id);
  return NextResponse.json({ logs: rows });
}
