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

  const { text } = await request.json();
  if (!text || !text.trim()) return NextResponse.json({ error: 'Describe what you ate first.' }, { status: 400 });

  try {
    const result = await callGemini({
      prompt: [
        'You are a careful nutrition estimator. A user is describing, from memory, a meal they already ate but',
        'forgot to log at the time, so there is no photo to work from — use only the written description below.',
        'Identify every distinct food item mentioned or clearly implied. For each item, give a short, generic,',
        'plain-English name suitable for looking up in a nutrition database (e.g. "chicken breast, grilled" or',
        '"white rice, cooked" or "broccoli, steamed") rather than a stylized dish name, plus a realistic estimated',
        'portion weight in grams — use typical serving sizes unless the description gives you a specific amount (a',
        'count of pieces, a cup, "large", "small", a restaurant or brand name, etc — use those cues when given).',
        'Also give your own best-guess calories/protein/carbs/fat for that item, based on typical known',
        'nutrition-database values per 100g for that food and the weight you estimated. These are a fallback only —',
        'used only if that food cannot be matched in a real nutrition database afterwards — so make them as',
        'accurate as you can rather than treating them as unimportant.',
        'If the description is vague (e.g. just "pasta" with no sauce, size or extras mentioned), make a reasonable',
        'assumption for a typical home-cooked version rather than refusing to estimate, and reflect that vagueness',
        'with a lower confidence instead.',
        'People describing a meal from memory tend to name the main components and forget the highest-calorie',
        'extras mixed into it — the oil or butter it was cooked in, dressing on a salad, sauce, melted cheese,',
        'cream. Add a realistic item for these whenever the dish or preparation described would plausibly include',
        'them, rather than only estimating the items explicitly named.',
        'Respond ONLY with JSON matching this shape:',
        '{"items": [{"name": string, "grams": number, "calories": number, "protein": number, "carbs": number, "fat": number}], "description": string (a short, cleaned-up version of what they described, e.g. "Grilled chicken, rice, broccoli"), "confidence": "low" | "medium" | "high"}',
        'If the description does not name or imply any actual food, set items to an empty array, description to "Could not identify food", and confidence to "low".',
        `Description: "${text.trim().slice(0, 500)}"`,
      ].join(' '),
      temperature: 0.15,
      thinkingLevel: 'medium',
    });

    // Ground each identified item against a real nutrition database instead
    // of trusting the AI's memorized per-100g values outright.
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
