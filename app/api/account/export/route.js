import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { getCurrentUser } from '../../../../lib/auth.js';
import { withApi } from '../../../../lib/apiHandler.js';

// A full copy of everything this account has ever logged, as one JSON
// file. Credentials and OAuth tokens are deliberately left out — this is
// a data export, not a way to hand yourself a copy of your own password
// hash or a live Strava/Google token.
export const GET = withApi(async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const uid = user.id;

  const [
    profile, sleep_logs, study_logs, workout_logs, meal_logs, deadlines,
    flashcards, weight_logs, calendar_events, quiz_questions, study_notes,
    study_sources, meal_plans, saved_recipes,
  ] = await Promise.all([
    db.prepare('SELECT email, name, age, weight_kg, height_cm, sex, activity_level, goal, target_weight_kg, grocery_store, kitchen_tools, created_at FROM users WHERE id=?').get(uid),
    db.prepare('SELECT * FROM sleep_logs WHERE user_id=?').all(uid),
    db.prepare('SELECT * FROM study_logs WHERE user_id=?').all(uid),
    db.prepare('SELECT * FROM workout_logs WHERE user_id=?').all(uid),
    db.prepare('SELECT * FROM meal_logs WHERE user_id=?').all(uid),
    db.prepare('SELECT * FROM deadlines WHERE user_id=?').all(uid),
    db.prepare('SELECT * FROM flashcards WHERE user_id=?').all(uid),
    db.prepare('SELECT * FROM weight_logs WHERE user_id=?').all(uid),
    db.prepare('SELECT * FROM calendar_events WHERE user_id=?').all(uid),
    db.prepare('SELECT * FROM quiz_questions WHERE user_id=?').all(uid),
    db.prepare('SELECT * FROM study_notes WHERE user_id=?').all(uid),
    db.prepare('SELECT * FROM study_sources WHERE user_id=?').all(uid),
    db.prepare('SELECT * FROM meal_plans WHERE user_id=?').all(uid),
    db.prepare('SELECT * FROM saved_recipes WHERE user_id=?').all(uid),
  ]);

  const data = {
    exported_at: new Date().toISOString(),
    profile, sleep_logs, study_logs, workout_logs, meal_logs, deadlines,
    flashcards, weight_logs, calendar_events, quiz_questions, study_notes,
    study_sources, meal_plans, saved_recipes,
  };

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="dailyflow-export.json"',
    },
  });
});
