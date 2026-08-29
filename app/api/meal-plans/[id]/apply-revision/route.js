import { NextResponse } from 'next/server';
import db from '../../../../../lib/db.js';
import { getCurrentUser } from '../../../../../lib/auth.js';

export async function POST(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;

  const row = await db.prepare('SELECT answers FROM meal_plans WHERE id=? AND user_id=?').get(id, user.id);
  if (!row) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const { days, shoppingList, estimatedTotalCost, notes, answers } = await request.json();
  const answersJson = answers ? JSON.stringify(answers) : row.answers;

  await db.prepare(`
    UPDATE meal_plans SET plan_json=?, shopping_list_json=?, total_est_cost=?, notes=?, answers=? WHERE id=? AND user_id=?
  `).run(
    JSON.stringify(Array.isArray(days) ? days : []),
    JSON.stringify(Array.isArray(shoppingList) ? shoppingList : []),
    typeof estimatedTotalCost === 'number' ? estimatedTotalCost : null,
    typeof notes === 'string' ? notes : '',
    answersJson,
    id, user.id
  );
  return NextResponse.json({ ok: true });
}
