import webpush from 'web-push';
import db from './db.js';

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (PUBLIC_KEY && PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:dermaddin1976@gmail.com', PUBLIC_KEY, PRIVATE_KEY);
}

// Sends one push notification to every device a user has subscribed on. A
// subscription the browser has since revoked (410 Gone, or 404 Not Found)
// is deleted so it stops being retried on future sends.
export async function sendPushToUser(userId, payload) {
  if (!PUBLIC_KEY || !PRIVATE_KEY) return { sent: 0, reason: 'VAPID keys not configured' };

  const subs = await db.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id=?').all(userId);
  let sent = 0;
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
      sent++;
    } catch (err) {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        await db.prepare('DELETE FROM push_subscriptions WHERE id=?').run(sub.id);
      }
    }
  }));
  return { sent };
}
