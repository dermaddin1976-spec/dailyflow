import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth.js';
import { checkAiRateLimit, AI_DAILY_LIMIT } from '../../../../lib/rateLimit.js';
import { callGemini } from '../../../../lib/gemini.js';

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const rl = await checkAiRateLimit(user.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `You've hit today's DailyAI limit (${AI_DAILY_LIMIT} requests/day). It resets on a rolling 24h window — try again a bit later.` },
      { status: 429 },
    );
  }

  const { images } = await request.json();
  if (!Array.isArray(images) || images.length === 0) {
    return NextResponse.json({ error: 'No screenshots provided.' }, { status: 400 });
  }

  try {
    const result = await callGemini({
      prompt: [
        'You are reading one or more screenshots of a sleep summary from an app like Apple Health, the Apple Watch',
        'Sleep app, Bevel, Oura, Garmin, or Whoop. The screenshots may show the same night from different screens',
        '(e.g. a summary card and a stages/detail screen) — combine them into one single night of sleep.',
        'Respond ONLY with JSON matching this shape:',
        '{"hours": number (total time asleep, in decimal hours, e.g. 7.5),',
        '"quality": number 1-5 (your best estimate of sleep quality from any score/stages/consistency data shown; if the app gives its own 0-100 sleep score, map it roughly onto 1-5),',
        '"summary": string (one compact line of the other stats shown — time in bed, bedtime/wake time, sleep stages breakdown, resting heart rate, respiratory rate, sleep score, whatever is visible; e.g. "11:42pm-7:15am · deep 1h20m · REM 1h45m · RHR 54bpm · score 82")',
        '"confidence": "low" | "medium" | "high"}',
        'If you cannot make out real sleep data in the images, set hours to 0, quality to 0, and explain briefly in summary.',
      ].join(' '),
      files: images.map(img => ({ base64: img.base64, mimeType: img.mimeType || 'image/jpeg' })),
      temperature: 0.1,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message || 'DailyAI read failed.' }, { status: 502 });
  }
}
