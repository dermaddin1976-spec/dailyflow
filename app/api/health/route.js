import { NextResponse } from 'next/server';
import db from '../../../lib/db.js';
import { withApi } from '../../../lib/apiHandler.js';

export const GET = withApi(async function GET() {
  const row = await db.prepare('SELECT COUNT(*) as count FROM users').get();
  return NextResponse.json({ ok: true, users: row.count, time: new Date().toISOString() });
});
