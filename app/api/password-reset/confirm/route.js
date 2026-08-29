import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { hashPassword } from '../../../../lib/auth.js';
import { checkRateLimit, clientIp } from '../../../../lib/rateLimit.js';

export async function POST(request) {
  const rl = await checkRateLimit(`pwreset-confirm:ip:${clientIp(request)}`, 20, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts from this connection — try again later.' }, { status: 429 });
  }

  const { token, password } = await request.json();
  if (!token || !password) return NextResponse.json({ error: 'Missing token or new password.' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });

  const reset = await db.prepare('SELECT * FROM password_resets WHERE token=?').get(token);
  if (!reset || reset.used_at || new Date(reset.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This reset link is invalid or has expired — ask for a new one.' }, { status: 400 });
  }

  const password_hash = hashPassword(password);
  await db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(password_hash, reset.user_id);
  await db.prepare('UPDATE password_resets SET used_at=? WHERE token=?').run(new Date().toISOString(), token);
  // Reset means "I might not trust whoever else has access" — sign the account out everywhere.
  await db.prepare('DELETE FROM sessions WHERE user_id=?').run(reset.user_id);

  return NextResponse.json({ ok: true });
}
