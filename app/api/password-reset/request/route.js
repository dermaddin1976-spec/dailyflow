import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import db from '../../../../lib/db.js';
import { checkRateLimit, clientIp } from '../../../../lib/rateLimit.js';

// Always returns the same generic message whether or not the email matches
// an account, so this endpoint can't be used to check who has signed up.
const GENERIC_MESSAGE = "If that email has an account, a reset link has been generated. There's no email sending set up yet, so ask whoever administers this DailyFlow instance to send it to you.";

export async function POST(request) {
  const rl = await checkRateLimit(`pwreset:ip:${clientIp(request)}`, 8, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many reset requests from this connection — try again later.' }, { status: 429 });
  }

  const { email } = await request.json();
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail) return NextResponse.json({ error: 'Email is required.' }, { status: 400 });

  const user = await db.prepare('SELECT id FROM users WHERE email=?').get(cleanEmail);
  if (user) {
    const token = crypto.randomBytes(24).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.prepare('INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, expires);
  }

  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
}
