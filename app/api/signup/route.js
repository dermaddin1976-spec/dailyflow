import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '../../../lib/db.js';
import { hashPassword, createSession } from '../../../lib/auth.js';
import { checkRateLimit, clientIp } from '../../../lib/rateLimit.js';
import { withApi } from '../../../lib/apiHandler.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = withApi(async function POST(request) {
  const rl = await checkRateLimit(`signup:ip:${clientIp(request)}`, 6, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many signups from this connection — try again later.' }, { status: 429 });
  }

  const { email, password, name } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }
  const cleanEmail = email.toLowerCase().trim();
  if (!EMAIL_RE.test(cleanEmail)) {
    return NextResponse.json({ error: "That doesn't look like a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) {
    return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });
  }
  const password_hash = hashPassword(password);
  const result = await db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)').run(cleanEmail, password_hash, name || null);
  const userId = result.lastInsertRowid;
  const { token, expires } = await createSession(userId);
  const cookieStore = await cookies();
  cookieStore.set('anchor_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(expires),
    path: '/',
  });
  return NextResponse.json({ ok: true, user: { id: userId, email: cleanEmail, name } });
});
