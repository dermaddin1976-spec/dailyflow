import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { getCurrentUser } from '../../../../lib/auth.js';

export async function PATCH(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  const { question, answer } = await request.json();
  if (!question || !answer) return NextResponse.json({ error: 'Question and answer are required.' }, { status: 400 });
  db.prepare('UPDATE flashcards SET question=?, answer=? WHERE id=? AND user_id=?').run(question, answer, id, user.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  db.prepare('DELETE FROM flashcards WHERE id=? AND user_id=?').run(id, user.id);
  return NextResponse.json({ ok: true });
}
