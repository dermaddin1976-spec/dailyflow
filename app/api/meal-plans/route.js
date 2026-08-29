import { NextResponse } from 'next/server';
import db from '../../../lib/db.js';
import { getCurrentUser } from '../../../lib/auth.js';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const rows = await db.prepare(
    'SELECT id, title, budget, currency, total_est_cost, created_at FROM meal_plans WHERE user_id=? ORDER BY id DESC'
  ).all(user.id);
  return NextResponse.json({ plans: rows });
}
