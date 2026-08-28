import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '../../../lib/db.js';
import { hashPassword, createSession } from '../../../lib/auth.js';

export async function POST(request) {
  const { email, password, name } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }
  const cleanEmail = email.toLowerCase().trim();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) {
    return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });
  }
  const password_hash = hashPassword(password);
  const result = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)').run(cleanEmail, password_hash, name || null);
  const userId = result.lastInsertRowid;
  const { token, expires } = createSession(userId);
  const cookieStore = await cookies();
  cookieStore.set('anchor_session', token, { httpOnly: true, sameSite: 'lax', expires: new Date(expires), path: '/' });
  return NextResponse.json({ ok: true, user: { id: userId, email: cleanEmail, name } });
}
