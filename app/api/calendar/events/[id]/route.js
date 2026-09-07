import { NextResponse } from 'next/server';
import db from '../../../../../lib/db.js';
import { getCurrentUser } from '../../../../../lib/auth.js';

export async function PATCH(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const { title, notes, location, start_at, end_at, all_day } = body || {};
  if (!title || !start_at) {
    return NextResponse.json({ error: 'Title and start time are required.' }, { status: 400 });
  }
  const row = await db.prepare(
    'UPDATE calendar_events SET title=?, notes=?, location=?, start_at=?, end_at=?, all_day=? WHERE id=? AND user_id=? RETURNING *'
  ).get(title, notes || null, location || null, start_at, end_at || null, all_day ? 1 : 0, id, user.id);
  if (!row) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  return NextResponse.json({ ok: true, event: row });
}

export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  await db.prepare('DELETE FROM calendar_events WHERE id=? AND user_id=?').run(id, user.id);
  return NextResponse.json({ ok: true });
}
