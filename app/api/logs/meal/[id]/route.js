import { NextResponse } from 'next/server';
import db from '../../../../../lib/db.js';
import { getCurrentUser } from '../../../../../lib/auth.js';

export async function PATCH(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  const { description, calories, protein, carbs, fat } = await request.json();
  if (!description) return NextResponse.json({ error: 'A description is required.' }, { status: 400 });
  db.prepare('UPDATE meal_logs SET description=?, calories=?, protein=?, carbs=?, fat=? WHERE id=? AND user_id=?')
    .run(description, calories || null, protein || null, carbs || null, fat || null, id, user.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  db.prepare('DELETE FROM meal_logs WHERE id=? AND user_id=?').run(id, user.id);
  return NextResponse.json({ ok: true });
}
