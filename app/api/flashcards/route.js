import { NextResponse } from 'next/server';
import db from '../../../lib/db.js';
import { getCurrentUser } from '../../../lib/auth.js';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const rows = db.prepare('SELECT * FROM flashcards WHERE user_id=? ORDER BY source_title, id').all(user.id);
  return NextResponse.json({ cards: rows });
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { source_title, question, answer } = await request.json();
  if (!source_title || !question || !answer) return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  const result = db.prepare('INSERT INTO flashcards (user_id, source_title, question, answer) VALUES (?, ?, ?, ?)').run(user.id, source_title, question, answer);
  return NextResponse.json({ ok: true, id: result.lastInsertRowid });
}

export async function DELETE(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title');
  if (!title) return NextResponse.json({ error: 'Missing deck title.' }, { status: 400 });
  db.prepare('DELETE FROM flashcards WHERE user_id=? AND source_title=?').run(user.id, title);
  db.prepare('DELETE FROM quiz_questions WHERE user_id=? AND source_title=?').run(user.id, title);
  return NextResponse.json({ ok: true });
}
