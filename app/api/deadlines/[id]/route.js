import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { getCurrentUser } from '../../../../lib/auth.js';

export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  await db.prepare('DELETE FROM deadlines WHERE id=? AND user_id=?').run(id, user.id);
  return NextResponse.json({ ok: true });
}
