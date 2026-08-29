import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import db from '../../../../lib/db.js';
import { getCurrentUser } from '../../../../lib/auth.js';
import { isAdminEmail } from '../../../../lib/config.js';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

// Pending (unused, unexpired) reset requests, oldest first, so an admin can
// see who's waiting and copy them a link.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const rows = await db.prepare(`
    SELECT pr.token, pr.expires_at, pr.created_at, u.email
    FROM password_resets pr JOIN users u ON u.id = pr.user_id
    WHERE pr.used_at IS NULL AND pr.expires_at > ?
    ORDER BY pr.created_at ASC
  `).all(new Date().toISOString());

  return NextResponse.json({ requests: rows });
}

// Lets an admin generate a reset link for someone directly (a friend texts
// them instead of using the "forgot password" form) without waiting for a
// request to come in first.
export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const { email } = await request.json();
  const cleanEmail = (email || '').toLowerCase().trim();
  const user = await db.prepare('SELECT id FROM users WHERE email=?').get(cleanEmail);
  if (!user) return NextResponse.json({ error: 'No account with that email.' }, { status: 404 });

  const token = crypto.randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await db.prepare('INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, expires);

  return NextResponse.json({ ok: true, token });
}
