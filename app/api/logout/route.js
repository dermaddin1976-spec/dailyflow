import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deleteSession } from '../../../lib/auth.js';
import { withApi } from '../../../lib/apiHandler.js';

export const POST = withApi(async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get('anchor_session')?.value;
  if (token) await deleteSession(token);
  cookieStore.delete('anchor_session');
  return NextResponse.json({ ok: true });
});
