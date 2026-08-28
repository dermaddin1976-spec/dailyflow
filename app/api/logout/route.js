import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deleteSession } from '../../../lib/auth.js';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get('anchor_session')?.value;
  if (token) deleteSession(token);
  cookieStore.delete('anchor_session');
  return NextResponse.json({ ok: true });
}
