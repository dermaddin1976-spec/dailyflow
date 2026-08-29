import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { getCurrentUser } from '../../../../lib/auth.js';
import { isAdminEmail } from '../../../../lib/config.js';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

// All accounts, newest first, with ban status — lets an admin see who's on
// the app and ban/unban problem accounts (e.g. abusive display names).
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const rows = await db.prepare(`
    SELECT id, email, name, created_at, banned_at FROM users ORDER BY created_at DESC
  `).all();

  return NextResponse.json({ users: rows });
}

// Bans or unbans an account. Banning deletes all of that user's sessions
// immediately, so it takes effect even if they're currently signed in —
// and getUserFromToken() also checks banned_at directly as a backstop.
export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const { userId, action } = await request.json();
  if (!userId || !['ban', 'unban'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const target = await db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId);
  if (!target) return NextResponse.json({ error: 'No account with that id.' }, { status: 404 });
  if (isAdminEmail(target.email)) {
    return NextResponse.json({ error: "Admin accounts can't be banned." }, { status: 400 });
  }

  if (action === 'ban') {
    await db.prepare('UPDATE users SET banned_at = ? WHERE id = ?').run(new Date().toISOString(), userId);
    await db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  } else {
    await db.prepare('UPDATE users SET banned_at = NULL WHERE id = ?').run(userId);
  }

  return NextResponse.json({ ok: true });
}
