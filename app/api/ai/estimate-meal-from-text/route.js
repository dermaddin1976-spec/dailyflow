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

  const { text } = await request.json();
  if (!text || !text.trim()) return NextResponse.json({ error: 'Describe what you ate first.' }, { status: 400 });

  try {
    const result = await callGemini({
      prompt: [
        'You are a careful nutrition estimator. A user is describing, from memory, a meal they already ate but',
        'forgot to log at the time, so there is no photo to work from — use only the written description below.',
        'First, mentally identify every distinct food item mentioned or clearly implied, and estimate a realistic',
        'portion weight in grams for each, using typical serving sizes unless the description gives you a specific',
        'amount (a count of pieces, a cup, "large", "small", a restaurant or brand name, etc — use those cues when',
        'given). Base calories/protein/carbs/fat on typical known nutrition-database values per 100g for those',
        'specific foods and the weights you estimated, rather than guessing a single total figure out of thin air.',
        'Then sum across all identified items for the totals.',
        'If the description is vague (e.g. just "pasta" with no sauce, size or extras mentioned), make a reasonable',
        'assumption for a typical home-cooked version rather than refusing to estimate, and reflect that vagueness',
        'with a lower confidence instead.',
        'Respond ONLY with JSON matching this shape:',
        '{"description": string (a short, cleaned-up version of what they described, e.g. "Grilled chicken, rice, broccoli"), "calories": number (estimated total kcal), "protein": number (estimated grams of protein), "carbs": number (estimated grams of carbohydrate), "fat": number (estimated grams of fat), "confidence": "low" | "medium" | "high"}',
        'If the description does not name or imply any actual food, set description to "Could not identify food" and calories/protein/carbs/fat to 0.',
        `Description: "${text.trim().slice(0, 500)}"`,
      ].join(' '),
      temperature: 0.15,
      thinkingLevel: 'medium',
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message || 'AI estimate failed.' }, { status: 502 });
  }
}
