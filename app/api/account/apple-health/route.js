import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import db from '../../../../lib/db.js';
import { getCurrentUser } from '../../../../lib/auth.js';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const token = crypto.randomBytes(24).toString('hex');
  db.prepare('UPDATE users SET apple_health_token=? WHERE id=?').run(token, user.id);
  return NextResponse.json({ ok: true, token });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  db.prepare('UPDATE users SET apple_health_token=NULL WHERE id=?').run(user.id);
  return NextResponse.json({ ok: true });
}
