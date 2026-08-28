import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { getCurrentUser } from '../../../../lib/auth.js';

const INTERVAL_DAYS = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 };

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id, correct } = await request.json();
  const card = db.prepare('SELECT * FROM flashcards WHERE id=? AND user_id=?').get(id, user.id);
  if (!card) return NextResponse.json({ error: 'Card not found.' }, { status: 404 });

  const today = new Date().toISOString().slice(0, 10);
  let box = card.box || 1;
  box = correct ? Math.min(box + 1, 5) : 1;
  const dueDate = addDays(today, INTERVAL_DAYS[box]);

  db.prepare('UPDATE flashcards SET box=?, due_date=?, last_reviewed=? WHERE id=?').run(box, dueDate, today, id);
  return NextResponse.json({ ok: true, box, due_date: dueDate });
}
