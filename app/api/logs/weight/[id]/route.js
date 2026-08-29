import { NextResponse } from 'next/server';
import db from '../../../../../lib/db.js';
import { getCurrentUser } from '../../../../../lib/auth.js';

export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  await db.prepare('DELETE FROM weight_logs WHERE id=? AND user_id=?').run(id, user.id);

  const latest = await db.prepare('SELECT weight_kg FROM weight_logs WHERE user_id=? ORDER BY date DESC LIMIT 1').get(user.id);
  if (latest) await db.prepare('UPDATE users SET weight_kg=? WHERE id=?').run(latest.weight_kg, user.id);

  return NextResponse.json({ ok: true });
}
