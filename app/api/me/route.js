import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '../../../lib/db.js';
import { getUserFromToken } from '../../../lib/auth.js';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('anchor_session')?.value;
  const user = getUserFromToken(token);
  return NextResponse.json({ user });
}

export async function PATCH(request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('anchor_session')?.value;
  const user = getUserFromToken(token);
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const body = await request.json();

  if ('name' in body) {
    db.prepare('UPDATE users SET name=? WHERE id=?').run((body.name || '').trim() || null, user.id);
  }

  if ('age' in body || 'weight_kg' in body || 'height_cm' in body || 'sex' in body || 'activity_level' in body || 'goal' in body || 'target_weight_kg' in body) {
    const age = body.age ? parseInt(body.age, 10) : null;
    const weight_kg = body.weight_kg ? parseFloat(body.weight_kg) : null;
    const height_cm = body.height_cm ? parseFloat(body.height_cm) : null;
    const sex = body.sex || null;
    const activity_level = body.activity_level || null;
    const goal = body.goal || null;
    const target_weight_kg = body.target_weight_kg ? parseFloat(body.target_weight_kg) : null;
    db.prepare('UPDATE users SET age=?, weight_kg=?, height_cm=?, sex=?, activity_level=?, goal=?, target_weight_kg=? WHERE id=?')
      .run(age, weight_kg, height_cm, sex, activity_level, goal, target_weight_kg, user.id);
  }

  return NextResponse.json({ ok: true });
}
