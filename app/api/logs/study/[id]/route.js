import { NextResponse } from 'next/server';
import db from '../../../../../lib/db.js';
import { getCurrentUser } from '../../../../../lib/auth.js';

export async function PATCH(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  const { subject, minutes, focus, note } = await request.json();
  if (!subject || !(minutes > 0)) return NextResponse.json({ error: 'Subject and minutes are required.' }, { status: 400 });
  await db.prepare('UPDATE study_logs SET subject=?, minutes=?, focus=?, note=? WHERE id=? AND user_id=?')
    .run(subject, minutes, focus || null, note || null, id, user.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  await db.prepare('DELETE FROM study_logs WHERE id=? AND user_id=?').run(id, user.id);
  return NextResponse.json({ ok: true });
}
