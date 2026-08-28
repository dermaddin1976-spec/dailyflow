import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth.js';
import { callGemini } from '../../../../lib/gemini.js';

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { imageBase64, mimeType } = await request.json();
  if (!imageBase64) return NextResponse.json({ error: 'No image provided.' }, { status: 400 });

  try {
    const result = await callGemini({
      prompt: [
        'You are a nutrition estimator. Look at this photo of a meal and estimate its contents.',
        'Respond ONLY with JSON matching this shape:',
        '{"description": string (short, e.g. "Grilled chicken, rice, broccoli"), "calories": number (estimated total kcal), "protein": number (estimated grams of protein), "carbs": number (estimated grams of carbohydrate), "fat": number (estimated grams of fat), "confidence": "low" | "medium" | "high"}',
        'If you cannot identify food in the image, set description to "Could not identify food" and calories/protein/carbs/fat to 0.',
      ].join(' '),
      fileBase64: imageBase64,
      mimeType: mimeType || 'image/jpeg',
      temperature: 0.2,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message || 'AI estimate failed.' }, { status: 502 });
  }
}
