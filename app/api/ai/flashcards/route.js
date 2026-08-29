import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
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

  const { pdfBase64, title } = await request.json();
  if (!pdfBase64) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });

  try {
    const result = await callGemini({
      prompt: [
        'You are a study assistant. Read this document and produce flashcards covering its key facts,',
        'definitions, and concepts a student should memorize for a test.',
        'Respond ONLY with JSON matching this shape: {"cards": [{"question": string, "answer": string}, ...]}.',
        'Produce between 8 and 20 cards depending on how much material is in the document. Keep questions and answers concise.',
      ].join(' '),
      fileBase64: pdfBase64,
      mimeType: 'application/pdf',
    });
    const cards = Array.isArray(result.cards) ? result.cards : [];
    const sourceTitle = title || 'Untitled deck';
    const insert = db.prepare('INSERT INTO flashcards (user_id, source_title, question, answer) VALUES (?, ?, ?, ?)');
    for (const c of cards) {
      if (c && c.question && c.answer) await insert.run(user.id, sourceTitle, c.question, c.answer);
    }
    return NextResponse.json({ ok: true, count: cards.length });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'AI flashcard generation failed.' }, { status: 502 });
  }
}
