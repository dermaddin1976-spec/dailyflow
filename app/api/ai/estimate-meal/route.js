import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth.js';
import { checkAiRateLimit, AI_DAILY_LIMIT } from '../../../../lib/rateLimit.js';
import { callGemini } from '../../../../lib/gemini.js';
import { groundMealTotals } from '../../../../lib/foodDb.js';

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
        'Identify every distinct food item visible. For each item, give a short, generic, plain-English name',
        'suitable for looking up in a nutrition database (e.g. "chicken breast, grilled" or "white rice, cooked" or',
        '"broccoli, steamed") rather than a stylized dish name, plus a realistic estimated portion weight in grams',
        'based on how it looks in the photo (plate size, thickness, how full a container is, etc).',
        'Also give your own best-guess calories/protein/carbs/fat for that item, based on typical known',
        'nutrition-database values per 100g for that food and the weight you estimated. These are a fallback only —',
        'used only if that food cannot be matched in a real nutrition database afterwards — so make them as',
        'accurate as you can rather than treating them as unimportant.',
        'Be consistent: if what you are looking at is fundamentally the same dish as something you might see again',
        'with only a minor visual variation (a different garnish, a different piece of fruit on top, slightly',
        'different plating), your item breakdown and weights should change by only a small amount reflecting that',
        'specific difference, not swing wildly from one look to the next.',
        'A photo hides some of the highest-calorie parts of a dish — cooking oil or butter, salad dressing, sauce,',
        'melted cheese, cream — because they are mixed in rather than sitting on top. List these as their own item',
        'with a realistic amount whenever the dish looks like it would plausibly include them (a shiny or glossy',
        'surface, a dressed salad, a creamy or fried appearance), instead of only accounting for what is cleanly',
        'visible as separate solid food.',
        'Respond ONLY with JSON matching this shape:',
        '{"items": [{"name": string, "grams": number, "calories": number, "protein": number, "carbs": number, "fat": number}], "description": string (short, e.g. "Grilled chicken, rice, broccoli"), "confidence": "low" | "medium" | "high"}',
        'If you cannot identify food in the image, set items to an empty array, description to "Could not identify food", and confidence to "low".',
      ].join(' '),
      fileBase64: imageBase64,
      mimeType: mimeType || 'image/jpeg',
      temperature: 0.15,
      thinkingLevel: 'medium',
    });

    // Ground each identified item against a real nutrition database instead
    // of trusting the AI's memorized per-100g values outright — this is what
    // keeps two near-identical meals from scoring wildly different totals.
    const totals = await groundMealTotals(result.items);
    const confidence = totals.totalCount === 0
      ? (result.confidence || 'low')
      : totals.matchedCount === totals.totalCount
      ? 'high'
      : totals.matchedCount > 0
      ? 'medium'
      : (result.confidence || 'medium');

    return NextResponse.json({
      description: result.description || 'Meal',
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      confidence,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'AI estimate failed.' }, { status: 502 });
  }
}
