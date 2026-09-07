import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { sendPushToUser } from '../../../../lib/push.js';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Hit once a day by a scheduled GitHub Actions workflow (see
// .github/workflows/daily-reminder.yml) rather than a Vercel cron job,
// since Vercel's Hobby plan only allows one cron run a day and doesn't
// guarantee the exact minute — a free external scheduler sidesteps both
// limits. Protected by a shared secret rather than requireUser(), since
// this is called by a script, not a signed-in browser.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get('x-cron-secret') || new URL(request.url).searchParams.get('secret');
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  const date = todayStr();

  // Only users with at least one active push subscription, who haven't
  // already been sent today's reminder (guards against the workflow firing
  // twice, or a manual re-run on the same day).
  const users = await db.prepare(`
    SELECT DISTINCT u.id
    FROM users u
    JOIN push_subscriptions p ON p.user_id = u.id
    WHERE COALESCE(u.last_reminder_date, '') != ?
  `).all(date);

  let notified = 0;
  for (const user of users) {
    const [meals, sleep, study, workout] = await Promise.all([
      db.prepare('SELECT COUNT(*) as count FROM meal_logs WHERE user_id=? AND date=?').get(user.id, date),
      db.prepare('SELECT COUNT(*) as count FROM sleep_logs WHERE user_id=? AND date=?').get(user.id, date),
      db.prepare('SELECT COUNT(*) as count FROM study_logs WHERE user_id=? AND date=?').get(user.id, date),
      db.prepare('SELECT COUNT(*) as count FROM workout_logs WHERE user_id=? AND date=?').get(user.id, date),
    ]);

    const missing = [];
    if (!meals.count) missing.push('meals');
    if (!sleep.count) missing.push('sleep');
    if (!study.count) missing.push('study');
    if (!workout.count) missing.push('training');

    // Fully caught up today — nothing to nag about, and don't mark the day
    // as "reminded" so a later check the same day can still notify if
    // something's still missing by then.
    if (!missing.length) continue;

    const body = missing.length === 4
      ? "You haven't logged anything today yet."
      : `Still missing: ${missing.join(', ')}.`;

    await sendPushToUser(user.id, {
      title: 'DailyFlow check-in',
      body,
      url: '/today',
    });
    await db.prepare('UPDATE users SET last_reminder_date=? WHERE id=?').run(date, user.id);
    notified++;
  }

  return NextResponse.json({ ok: true, checked: users.length, notified });
}
