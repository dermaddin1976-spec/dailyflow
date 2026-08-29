import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '../../../lib/db.js';
import { verifyPassword, createSession } from '../../../lib/auth.js';
import { checkRateLimit, clientIp } from '../../../lib/rateLimit.js';

export async function POST(request) {
  const rl = await checkRateLimit(`login:ip:${clientIp(request)}`, 15, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many login attempts from this connection — try again in a few minutes.' }, { status: 429 });
  }

  const { email, password } = await request.json();
  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').toLowerCase().trim());
  if (!user || !verifyPassword(password || '', user.password_hash)) {
    return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401 });
  }
  const { token, expires } = await createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set('anchor_session', token, { httpOnly: true, sameSite: 'lax', expires: new Date(expires), path: '/' });
  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
}
