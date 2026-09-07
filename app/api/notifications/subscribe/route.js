import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth.js';
import db from '../../../../lib/db.js';

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const body = await request.json();
  const { endpoint, keys } = body || {};
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return NextResponse.json({ error: 'Invalid subscription.' }, { status: 400 });
  }

  // A device that already has a subscription row (re-enabling after
  // disabling, or a refreshed subscription from the browser) just updates
  // that row rather than creating a duplicate.
  await db.prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
  `).run(user.id, endpoint, keys.p256dh, keys.auth);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { endpoint } = await request.json();
  if (!endpoint) return NextResponse.json({ error: 'Missing endpoint.' }, { status: 400 });

  await db.prepare('DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?').run(user.id, endpoint);
  return NextResponse.json({ ok: true });
}
