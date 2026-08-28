import { NextResponse } from 'next/server';
import db from '../../../../../lib/db.js';
import { getCurrentUser } from '../../../../../lib/auth.js';

export async function PATCH(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  const { type, minutes, intensity, note } = await request.json();
  if (!type || !(minutes > 0)) return NextResponse.json({ error: 'Type and minutes are required.' }, { status: 400 });
  db.prepare('UPDATE workout_logs SET type=?, minutes=?, intensity=?, note=? WHERE id=? AND user_id=?')
    .run(type, minutes, intensity || null, note || null, id, user.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  db.prepare('DELETE FROM workout_logs WHERE id=? AND user_id=?').run(id, user.id);
  return NextResponse.json({ ok: true });
}
