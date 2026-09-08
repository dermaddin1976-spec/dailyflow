import { NextResponse } from 'next/server';
import db from '../../../lib/db.js';
import { getCurrentUser } from '../../../lib/auth.js';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const rows = await db.prepare('SELECT * FROM saved_meals WHERE user_id=? ORDER BY description').all(user.id);
  return NextResponse.json({ meals: rows });
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { description, calories, protein, carbs, fat } = await request.json();
  if (!description) return NextResponse.json({ error: 'A description is required.' }, { status: 400 });
  const result = await db.prepare(
    'INSERT INTO saved_meals (user_id, description, calories, protein, carbs, fat) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(user.id, description, calories || null, protein || null, carbs || null, fat || null);
  return NextResponse.json({ ok: true, id: result.lastInsertRowid });
}
