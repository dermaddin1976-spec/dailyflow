import { NextResponse } from 'next/server';
import db from '../../../lib/db.js';
import { getCurrentUser } from '../../../lib/auth.js';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const rows = db.prepare('SELECT * FROM deadlines WHERE user_id=? ORDER BY due_date ASC').all(user.id);
  return NextResponse.json({ deadlines: rows });
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { title, due_date } = await request.json();
  if (!title || !due_date) return NextResponse.json({ error: 'Title and due date are required.' }, { status: 400 });
  db.prepare('INSERT INTO deadlines (user_id, title, due_date) VALUES (?, ?, ?)').run(user.id, title, due_date);
  return NextResponse.json({ ok: true });
}
