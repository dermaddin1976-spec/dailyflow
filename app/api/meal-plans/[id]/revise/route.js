import { NextResponse } from 'next/server';
import db from '../../../../../lib/db.js';
import { getCurrentUser } from '../../../../../lib/auth.js';
import { computeTargets } from '../../../../../lib/nutrition.js';
import { generateMealPlan } from '../../../../../lib/meal-plan.js';

export async function POST(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { id } = await params;

  const { instructions } = await request.json();
  const trimmed = typeof instructions === 'string' ? instructions.trim() : '';
  if (!trimmed) return NextResponse.json({ error: 'Describe what you want changed first.' }, { status: 400 });

  const row = await db.prepare('SELECT * FROM meal_plans WHERE id=? AND user_id=?').get(id, user.id);
  if (!row) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (!row.answers) return NextResponse.json({ error: 'This plan has no stored answers to revise from.' }, { status: 400 });

  const targets = computeTargets(user);
  if (!targets) return NextResponse.json({ error: 'Your body profile is incomplete.' }, { status: 400 });

  try {
    const baseAnswers = JSON.parse(row.answers);
    const revisedAnswers = {
      ...baseAnswers,
      extraNotes: [baseAnswers.extraNotes, trimmed]
        .map(s => (s || '').trim())
        .filter(Boolean)
        .join(' Also: '),
    };
    const result = await generateMealPlan(revisedAnswers, targets);
    return NextResponse.json({ ok: true, preview: result, answers: revisedAnswers });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Revision failed.' }, { status: 502 });
  }
}
