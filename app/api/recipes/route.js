import { NextResponse } from 'next/server';
import db from '../../../lib/db.js';
import { getCurrentUser } from '../../../lib/auth.js';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const rows = await db.prepare('SELECT * FROM saved_recipes WHERE user_id=? ORDER BY id DESC').all(user.id);
  const recipes = rows.map(r => ({
    ...r,
    ingredients: r.ingredients_json ? JSON.parse(r.ingredients_json) : [],
  }));
  return NextResponse.json({ recipes });
}

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { mealType, name, description, calories, protein, carbs, fat, currency, ingredients } = await request.json();
  if (!name || !String(name).trim()) return NextResponse.json({ error: 'A name is required.' }, { status: 400 });

  await db.prepare(`
    INSERT INTO saved_recipes (user_id, meal_type, name, description, calories, protein, carbs, fat, currency, ingredients_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user.id, mealType || null, String(name).trim(), description || null,
    Number(calories) || null, Number(protein) || null, Number(carbs) || null, Number(fat) || null,
    currency || 'EUR', JSON.stringify(Array.isArray(ingredients) ? ingredients : []),
  );
  return NextResponse.json({ ok: true });
}
