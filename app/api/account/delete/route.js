import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '../../../../lib/db.js';
import { getCurrentUser, verifyPassword } from '../../../../lib/auth.js';
import { withApi } from '../../../../lib/apiHandler.js';

// Lets a signed-in user permanently delete their own account — the
// self-service counterpart to the admin Remove button in Settings. Unlike
// that one, this can be triggered by anyone signed in with no one else
// checking first, so it requires the current password as confirmation.
// Wipes every row this account owns, the same cascade the admin route
// uses, then signs the browser out since the account no longer exists.
export const POST = withApi(async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { password } = await request.json();
  const row = await db.prepare('SELECT password_hash FROM users WHERE id=?').get(user.id);
  if (!row || !verifyPassword(password || '', row.password_hash)) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  const uid = user.id;
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

  const cookieStore = await cookies();
  cookieStore.delete('anchor_session');

  return NextResponse.json({ ok: true });
});
