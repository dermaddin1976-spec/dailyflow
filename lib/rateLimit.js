import db from './db.js';

// Fixed-window rate limiter backed by Postgres, so it works across Vercel's
// stateless serverless functions without needing a separate service like
// Redis. It isn't perfectly atomic under heavy concurrent traffic, but at
// this app's scale (a small group of friends) a rare double-count is a
// non-issue — this exists to catch a runaway bug, an accidental refresh
// loop, or a stranger finding the URL, not to police real users.
export async function checkRateLimit(key, limit, windowMs) {
  const row = await db.prepare('SELECT count, window_start FROM rate_limits WHERE key=?').get(key);
  const now = Date.now();

  if (!row || now - new Date(row.window_start).getTime() > windowMs) {
    await db.prepare(`
      INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, now())
      ON CONFLICT (key) DO UPDATE SET count = 1, window_start = now()
    `).run(key);
    return { allowed: true };
  }

  if (row.count >= limit) {
    const retryAfterMs = windowMs - (now - new Date(row.window_start).getTime());
    return { allowed: false, retryAfterMs };
  }

  await db.prepare('UPDATE rate_limits SET count = count + 1 WHERE key=?').run(key);
  return { allowed: true };
}

// Best-effort caller IP from Vercel's forwarding headers — good enough to
// throttle unauthenticated endpoints (signup, login, password reset).
export function clientIp(request) {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

// One shared daily budget for every DailyAI-powered endpoint (meal photos,
// flashcard/quiz/notes generation, screenshot imports, chat) per user —
// simple to reason about, and enough headroom for genuine daily use while
// bounding how much a single account can spend against the Gemini API.
export const AI_DAILY_LIMIT = 50;
export const AI_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function checkAiRateLimit(userId) {
  return checkRateLimit(`ai:${userId}`, AI_DAILY_LIMIT, AI_DAILY_WINDOW_MS);
}
