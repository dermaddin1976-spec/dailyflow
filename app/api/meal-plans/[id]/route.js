import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { getCurrentUser } from '../../../../lib/auth.js';
import { computeTargets } from '../../../../lib/nutrition.js';
import { generateMealPlan } from '../../../../lib/meal-plan.js';

function serialize(row) {
  if (!row) return null;
  return {
    ...row,
    answers: row.answers ? JSON.parse(row.answers) : null,
    days: row.plan_json ? JSON.parse(row.plan_json) : [],
    shoppingList: row.shopping_list_json ? JSON.parse(row.shopping_list_json) : [],
  };
}

export async function GET(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  const row = db.prepare('SELECT * FROM meal_plans WHERE id=? AND user_id=?').get(id, user.id);
  if (!row) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ plan: serialize(row) });
}

export async function PATCH(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  const row = db.prepare('SELECT * FROM meal_plans WHERE id=? AND user_id=?').get(id, user.id);
  if (!row) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (!row.answers) return NextResponse.json({ error: 'This plan has no stored answers to regenerate from.' }, { status: 400 });

  const targets = computeTargets(user);
  if (!targets) return NextResponse.json({ error: 'Your body profile is incomplete.' }, { status: 400 });

  try {
    const answers = JSON.parse(row.answers);
    const result = await generateMealPlan(answers, targets);
    db.prepare(`
      UPDATE meal_plans SET plan_json=?, shopping_list_json=?, total_est_cost=?, notes=? WHERE id=? AND user_id=?
    `).run(JSON.stringify(result.days), JSON.stringify(result.shoppingList), result.estimatedTotalCost, result.notes, id, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Regeneration failed.' }, { status: 502 });
  }
}

export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  db.prepare('DELETE FROM meal_plans WHERE id=? AND user_id=?').run(id, user.id);
  return NextResponse.json({ ok: true });
}
