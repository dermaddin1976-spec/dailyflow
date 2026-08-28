import { NextResponse } from 'next/server';
import db from '../../../lib/db.js';
import { getCurrentUser } from '../../../lib/auth.js';

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title');
  if (!title) return NextResponse.json({ error: 'Missing deck title.' }, { status: 400 });
  const rows = db.prepare('SELECT * FROM quiz_questions WHERE user_id=? AND source_title=? ORDER BY id').all(user.id, title);
  const questions = rows.map(r => ({ id: r.id, question: r.question, options: JSON.parse(r.options), correctIndex: r.correct_index }));
  return NextResponse.json({ questions });
}
