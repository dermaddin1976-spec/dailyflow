import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { getCurrentUser } from '../../../../lib/auth.js';
import { computeTargets } from '../../../../lib/nutrition.js';
import { generateMealPlan, extractMealNames } from '../../../../lib/meal-plan.js';

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
  const row = await db.prepare('SELECT * FROM meal_plans WHERE id=? AND user_id=?').get(id, user.id);
  if (!row) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ plan: serialize(row) });
}

export async function PATCH(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  const row = await db.prepare('SELECT * FROM meal_plans WHERE id=? AND user_id=?').get(id, user.id);
  if (!row) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (!row.answers) return NextResponse.json({ error: 'This plan has no stored answers to regenerate from.' }, { status: 400 });

  const targets = computeTargets(user);
  if (!targets) return NextResponse.json({ error: 'Your body profile is incomplete.' }, { status: 400 });

  try {
    const answers = JSON.parse(row.answers);

    // Regenerating overwrites this same plan in place, so the previous result
    // doesn't survive anywhere else on its own. Carry forward a short rolling
    // history of what's already been suggested for this specific plan so
    // hitting Regenerate repeatedly doesn't just keep landing back on the same
    // handful of ideas.
    let history = [];
    try { history = JSON.parse(row.regen_history_json || '[]'); } catch { history = []; }
    if (!Array.isArray(history)) history = [];
    let currentPlan = [];
    try { currentPlan = JSON.parse(row.plan_json || '[]'); } catch { currentPlan = []; }
    for (const name of extractMealNames(currentPlan)) {
      if (!history.includes(name)) history.unshift(name);
    }
    history = history.slice(0, 10);

    const result = await generateMealPlan(answers, targets, history);

    const newHistory = [...extractMealNames(result.days), ...history]
      .filter((name, i, arr) => arr.indexOf(name) === i)
      .slice(0, 10);

    await db.prepare(`
      UPDATE meal_plans SET plan_json=?, shopping_list_json=?, total_est_cost=?, notes=?, regen_history_json=? WHERE id=? AND user_id=?
    `).run(
      JSON.stringify(result.days), JSON.stringify(result.shoppingList), result.estimatedTotalCost, result.notes,
      JSON.stringify(newHistory), id, user.id
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Regeneration failed.' }, { status: 502 });
  }
}

export async function DELETE(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;
  await db.prepare('DELETE FROM meal_plans WHERE id=? AND user_id=?').run(id, user.id);
  return NextResponse.json({ ok: true });
}
