import { NextResponse } from 'next/server';
import db from '../../../../../lib/db.js';
import { getCurrentUser } from '../../../../../lib/auth.js';

export async function PATCH(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  const { hours, quality, note } = await request.json();
  if (!(hours >= 0)) return NextResponse.json({ error: 'Hours is required.' }, { status: 400 });
  await db.prepare('UPDATE sleep_logs SET hours=?, quality=?, note=? WHERE id=? AND user_id=?')
    .run(hours, quality || null, note || null, id, user.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  await db.prepare('DELETE FROM sleep_logs WHERE id=? AND user_id=?').run(id, user.id);
  return NextResponse.json({ ok: true });
}
