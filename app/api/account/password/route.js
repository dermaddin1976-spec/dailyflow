import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { getCurrentUser, verifyPassword, hashPassword } from '../../../../lib/auth.js';

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { currentPassword, newPassword } = await request.json();
  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
  }
  const row = await db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id);
  if (!row || !verifyPassword(currentPassword || '', row.password_hash)) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
  }
  await db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(newPassword), user.id);
  return NextResponse.json({ ok: true });
}
