import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { getCurrentUser } from '../../../../lib/auth.js';
import { computeTargets, hasBodyProfile } from '../../../../lib/nutrition.js';
import { generateMealPlan } from '../../../../lib/meal-plan.js';

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  if (!hasBodyProfile(user)) {
    return NextResponse.json({ error: 'Set up your body profile in Settings first — the plan is built around your daily targets.' }, { status: 400 });
  }

  const { answers } = await request.json();
  if (!answers || !answers.days || !answers.mealsPerDay) {
    return NextResponse.json({ error: 'Missing answers.' }, { status: 400 });
  }

  const targets = computeTargets(user);

  try {
    const result = await generateMealPlan(answers, targets);
    const title = `${answers.days}-day plan · ${new Date().toISOString().slice(0, 10)}`;
    const budget = answers.budgetAmount ? `${answers.budgetAmount} ${answers.currency}` : 'No strict budget';

    const insert = db.prepare(`
      INSERT INTO meal_plans (user_id, title, answers, budget, currency, plan_json, shopping_list_json, total_est_cost, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const inserted = insert.run(
      user.id, title, JSON.stringify(answers), budget, answers.currency || 'EUR',
      JSON.stringify(result.days), JSON.stringify(result.shoppingList), result.estimatedTotalCost, result.notes
    );

    return NextResponse.json({ ok: true, id: Number(inserted.lastInsertRowid) });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Meal plan generation failed.' }, { status: 502 });
  }
}
