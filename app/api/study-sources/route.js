import { NextResponse } from 'next/server';
import db from '../../../lib/db.js';
import { getCurrentUser } from '../../../lib/auth.js';
import { withApi } from '../../../lib/apiHandler.js';

export const GET = withApi(async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const rows = await db.prepare('SELECT * FROM study_sources WHERE user_id=? ORDER BY notebook, id').all(user.id);
  return NextResponse.json({ sources: rows });
});
