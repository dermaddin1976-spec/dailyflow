import db from './db.js';
import { callGemini } from './gemini.js';
import { checkAiRateLimit } from './rateLimit.js';

// A once-a-day, cached coaching-style note to sit under the readiness score —
// specific to today's actual numbers rather than a generic tip. Regenerating
// this on every page load would be wasteful (and slow), so it's cached on the
// user row and only refreshed once the date rolls over.
export async function getReadinessTip(userId, date, readiness) {
  if (readiness.overall == null) return null; // not enough data yet — nothing useful to say

  const row = await db.prepare('SELECT readiness_tip, readiness_tip_date FROM users WHERE id=?').get(userId);
  if (row && row.readiness_tip_date === date && row.readiness_tip) {
    return row.readiness_tip;
  }

  const rl = await checkAiRateLimit(userId);
  if (!rl.allowed) return null;

  const summary = readiness.components
    .filter(c => c.score != null)
    .map(c => `${c.name}: ${c.score}/100 (${c.reason})`)
    .join('; ');

  try {
    const result = await callGemini({
      prompt: [
        "You are a concise, encouraging coach writing a single short note for a student's daily readiness",
        'dashboard. Based on the numbers below, write ONE specific, actionable sentence (max ~20 words) — not a',
        "generic platitude, reference what's actually going on. Talk directly to them (\"you\"), warm but",
        'plain-spoken, no emoji, no exclamation marks.',
        `Overall readiness: ${readiness.overall}/100 (${readiness.label}). Components — ${summary}.`,
        'Respond ONLY with JSON: {"tip": string}',
      ].join(' '),
      temperature: 0.6,
      thinkingLevel: 'low',
    });
    const tip = (result.tip || '').trim().slice(0, 200);
    if (!tip) return null;
    await db.prepare('UPDATE users SET readiness_tip=?, readiness_tip_date=? WHERE id=?').run(tip, date, userId);
    return tip;
  } catch (err) {
    return null; // never let a flaky AI call break the dashboard
  }
}
