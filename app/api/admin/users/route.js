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

// Bans, unbans, or permanently deletes an account. Banning deletes all of
// that user's sessions immediately, so it takes effect even if they're
// currently signed in — and getUserFromToken() also checks banned_at
// directly as a backstop. Deleting wipes the account and every row of
// theirs across every table (no undo) — used to actually clear old or
// unwanted accounts out of the list below instead of just hiding them.
export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

  const { userId, action } = await request.json();
  if (!userId || !['ban', 'unban', 'delete'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const target = await db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId);
  if (!target) return NextResponse.json({ error: 'No account with that id.' }, { status: 404 });
  if (isAdminEmail(target.email)) {
    return NextResponse.json({ error: "Admin accounts can't be banned or removed." }, { status: 400 });
  }

  if (action === 'ban') {
    await db.prepare('UPDATE users SET banned_at = ? WHERE id = ?').run(new Date().toISOString(), userId);
    await db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  } else if (action === 'unban') {
    await db.prepare('UPDATE users SET banned_at = NULL WHERE id = ?').run(userId);
  } else {
    const uid = target.id;
    await db.exec(`
      BEGIN;
      DELETE FROM sessions WHERE user_id = ${uid};
      DELETE FROM sleep_logs WHERE user_id = ${uid};
      DELETE FROM study_logs WHERE user_id = ${uid};
      DELETE FROM workout_logs WHERE user_id = ${uid};
      DELETE FROM meal_logs WHERE user_id = ${uid};
      DELETE FROM deadlines WHERE user_id = ${uid};
      DELETE FROM flashcards WHERE user_id = ${uid};
      DELETE FROM weight_logs WHERE user_id = ${uid};
      DELETE FROM calendar_events WHERE user_id = ${uid};
      DELETE FROM quiz_questions WHERE user_id = ${uid};
      DELETE FROM study_notes WHERE user_id = ${uid};
      DELETE FROM study_sources WHERE user_id = ${uid};
      DELETE FROM password_resets WHERE user_id = ${uid};
      DELETE FROM meal_plans WHERE user_id = ${uid};
      DELETE FROM saved_recipes WHERE user_id = ${uid};
      DELETE FROM push_subscriptions WHERE user_id = ${uid};
      DELETE FROM users WHERE id = ${uid};
      COMMIT;
    `);
  }

  return NextResponse.json({ ok: true });
}
