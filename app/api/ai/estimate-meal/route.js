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

  const { imageBase64, mimeType } = await request.json();
  if (!imageBase64) return NextResponse.json({ error: 'No image provided.' }, { status: 400 });

  try {
    const result = await callGemini({
      prompt: [
        'You are a careful nutrition estimator looking at a photo of food.',
        'First, mentally identify every distinct food item visible and estimate a realistic portion weight in grams',
        'for each, based on how it looks in the photo (plate size, thickness, how full a container is, etc). Base',
        'calories/protein/carbs/fat on typical known nutrition-database values per 100g for those specific foods and',
        'the weights you estimated, rather than guessing a single total figure out of thin air. Then sum across all',
        'identified items for the totals.',
        'Be consistent: if what you are looking at is fundamentally the same dish as something you might see again',
        'with only a minor visual variation (a different garnish, a different piece of fruit on top, slightly',
        'different plating), that should change your estimate by only a small amount reflecting that specific',
        'difference, not swing the whole total up or down by a large margin. Judge portion size and macros primarily',
        'from the base dish, and treat small garnishes or toppings as minor adjustments on top of it, not the main',
        'driver of the estimate.',
        'Respond ONLY with JSON matching this shape:',
        '{"description": string (short, e.g. "Grilled chicken, rice, broccoli"), "calories": number (estimated total kcal), "protein": number (estimated grams of protein), "carbs": number (estimated grams of carbohydrate), "fat": number (estimated grams of fat), "confidence": "low" | "medium" | "high"}',
        'If you cannot identify food in the image, set description to "Could not identify food" and calories/protein/carbs/fat to 0.',
      ].join(' '),
      fileBase64: imageBase64,
      mimeType: mimeType || 'image/jpeg',
      temperature: 0.15,
      thinkingLevel: 'medium',
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message || 'AI estimate failed.' }, { status: 502 });
  }
}
