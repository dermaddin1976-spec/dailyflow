import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { getCurrentUser } from '../../../../lib/auth.js';

export async function PATCH(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  const { summary, key_points, test_focus } = await request.json();
  db.prepare('UPDATE study_notes SET summary=?, key_points=?, test_focus=? WHERE id=? AND user_id=?')
    .run(summary || '', key_points || '', test_focus || '', id, user.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  db.prepare('DELETE FROM study_notes WHERE id=? AND user_id=?').run(id, user.id);
  return NextResponse.json({ ok: true });
}
