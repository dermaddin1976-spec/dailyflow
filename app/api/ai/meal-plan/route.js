import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { getCurrentUser } from '../../../../lib/auth.js';
import { computeTargets, hasBodyProfile } from '../../../../lib/nutrition.js';
import { generateMealPlan } from '../../../../lib/meal-plan.js';

// Look back through this user's recently generated plans of the same shape
// (same scope, and for grab/meal scope the same store/meal-type) and pull out
// the meal/snack/item names so we can tell the AI not to just repeat itself
// on a regenerate.
async function recentMealNames(userId, answers) {
  const rows = await db.prepare(`
    SELECT answers, plan_json FROM meal_plans
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `).all(userId);

  const names = [];
  for (const row of rows) {
    let pastAnswers, plan;
    try { pastAnswers = JSON.parse(row.answers || '{}'); } catch { continue; }
    if (pastAnswers.scope !== answers.scope) continue;
    if (answers.scope === 'grab' && (pastAnswers.grabStore || '').trim().toLowerCase() !== (answers.grabStore || '').trim().toLowerCase()) continue;
    if (answers.scope === 'meal' && pastAnswers.mealType !== answers.mealType) continue;
    try { plan = JSON.parse(row.plan_json || '[]'); } catch { continue; }
    for (const day of plan) {
      for (const m of (day.meals || [])) {
        if (m.name && !names.includes(m.name)) names.push(m.name);
      }
    }
    if (names.length >= 8) break;
  }
  return names.slice(0, 8);
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!hasBodyProfile(user)) {
    return NextResponse.json({ error: 'Set up your body profile in Settings first — the plan is built around your daily targets.' }, { status: 400 });
  }

  const { answers } = await request.json();
  if (!answers || !answers.scope) {
    return NextResponse.json({ error: 'Missing answers.' }, { status: 400 });
  }
  if (answers.scope === 'plan' && (!answers.days || !answers.mealsPerDay)) {
    return NextResponse.json({ error: 'Missing answers.' }, { status: 400 });
  }
  if (answers.scope === 'meal' && !answers.mealType) {
    return NextResponse.json({ error: 'Missing answers.' }, { status: 400 });
  }

  const targets = computeTargets(user);

  try {
    const recentNames = await recentMealNames(user.id, answers);
    const result = await generateMealPlan(answers, targets, recentNames);
    const dateStr = new Date().toISOString().slice(0, 10);
    const title = answers.scope === 'meal'
      ? `${answers.mealType && answers.mealType !== 'any' ? answers.mealType[0].toUpperCase() + answers.mealType.slice(1) : 'Meal'} · ${dateStr}`
      : answers.scope === 'snack'
      ? `Snack · ${dateStr}`
      : answers.scope === 'grab'
      ? `Grab & go${answers.grabStore && answers.grabStore.trim() ? ' · ' + answers.grabStore.trim() : ''} · ${dateStr}`
      : `${answers.days}-day plan · ${dateStr}`;
    const budget = answers.scope !== 'plan'
      ? 'Single item'
      : answers.budgetAmount ? `${answers.budgetAmount} ${answers.currency}` : 'No strict budget';

    const insert = db.prepare(`
      INSERT INTO meal_plans (user_id, title, answers, budget, currency, plan_json, shopping_list_json, total_est_cost, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const inserted = await insert.run(
      user.id, title, JSON.stringify(answers), budget, answers.currency || 'EUR',
      JSON.stringify(result.days), JSON.stringify(result.shoppingList), result.estimatedTotalCost, result.notes
    );

    return NextResponse.json({ ok: true, id: Number(inserted.lastInsertRowid) });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Meal plan generation failed.' }, { status: 502 });
  }
}
