import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import db from './db.js';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  await db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  return { token, expires };
}

export async function getUserFromToken(token) {
  if (!token) return null;
  const row = await db.prepare(`
    SELECT s.expires_at as expires_at, u.id as id, u.email as email, u.name as name,
           u.age as age, u.weight_kg as weight_kg, u.height_cm as height_cm,
           u.sex as sex, u.activity_level as activity_level, u.goal as goal,
           u.target_weight_kg as target_weight_kg, u.strava_athlete_id as strava_athlete_id,
           u.apple_health_token as apple_health_token
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?
  `).get(token);
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  return {
    id: row.id, email: row.email, name: row.name,
    age: row.age, weight_kg: row.weight_kg, height_cm: row.height_cm,
    sex: row.sex, activity_level: row.activity_level, goal: row.goal,
    target_weight_kg: row.target_weight_kg,
    strava_connected: !!row.strava_athlete_id,
    apple_health_connected: !!row.apple_health_token,
  };
}

export async function deleteSession(token) {
  await db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('anchor_session')?.value;
  return await getUserFromToken(token);
}

// Server-component pages under (app) are guarded by app/(app)/layout.js on
// first load, but Next.js reuses that already-mounted layout across
// client-side navigations to sibling routes — it does not re-run, and so
// does not re-check auth, when only the page below it changes. If a
// session becomes invalid in between (signed out elsewhere, expired,
// deleted), a page that blindly destructures getCurrentUser()'s result
// crashes instead of bouncing to /login. Pages should call this instead.
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}
