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
        'You are reading one or more screenshots of a workout summary from an app like Strava, Apple Fitness, a Garmin',
        'or Apple Watch app, or a hybrid training app. The screenshots may show the same workout from different screens',
        '(e.g. an overview screen and a splits/laps screen) — combine them into one single workout.',
        'Respond ONLY with JSON matching this shape:',
        '{"type": string (short label, e.g. "Run", "Ride", "Strength", "Swim", "Football"),',
        '"minutes": number (total duration in whole minutes),',
        '"intensity": number 1-5 (your best estimate of how hard the session was, from any pace/heart-rate/effort data shown),',
        '"summary": string (one compact line of the other stats shown — distance, pace, heart rate, calories, elevation, sets/reps, whatever is visible; e.g. "5.2km · 5:30/km avg pace · 320 cal · avg HR 152bpm"),',
        '"confidence": "low" | "medium" | "high"}',
        'If you cannot make out a real workout in the images, set type to "Unknown", minutes to 0, and explain briefly in summary.',
      ].join(' '),
      files: images.map(img => ({ base64: img.base64, mimeType: img.mimeType || 'image/jpeg' })),
      temperature: 0.1,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message || 'DailyAI read failed.' }, { status: 502 });
  }
}
