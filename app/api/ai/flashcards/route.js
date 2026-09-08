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

  const { pdfBase64, title, notebook } = await request.json();
  if (!pdfBase64) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });

  try {
    const result = await callGemini({
      prompt: [
        'You are a study assistant. Read this document and produce flashcards covering its key facts,',
        'definitions, and concepts a student should memorize for a test. Also write a thorough summary of',
        "the document's content — a few paragraphs, dense with the actual facts and explanations it contains —",
        "so it can be used later to answer questions the flashcards alone don't cover.",
        'Respond ONLY with JSON matching this shape:',
        '{"cards": [{"question": string, "answer": string}, ...], "summary": string}.',
        'Produce between 8 and 20 cards depending on how much material is in the document. Keep questions and answers concise.',
      ].join(' '),
      fileBase64: pdfBase64,
      mimeType: 'application/pdf',
    });
    const cards = Array.isArray(result.cards) ? result.cards : [];
    const sourceTitle = title || 'Untitled deck';
    // A notebook groups multiple sources together so Ask can draw on all of
    // them at once; left blank, a source is its own single-source notebook —
    // this keeps every deck uploaded before this feature existed behaving
    // exactly as it did (each one's notebook defaults to its own title).
    const notebookName = (notebook || '').trim() || sourceTitle;

    const insert = db.prepare('INSERT INTO flashcards (user_id, source_title, notebook, question, answer) VALUES (?, ?, ?, ?, ?)');
    for (const c of cards) {
      if (c && c.question && c.answer) await insert.run(user.id, sourceTitle, notebookName, c.question, c.answer);
    }
    if (result.summary) {
      await db.prepare(
        "INSERT INTO study_sources (user_id, notebook, title, content, source_type) VALUES (?, ?, ?, ?, 'pdf')"
      ).run(user.id, notebookName, sourceTitle, String(result.summary).slice(0, 8000));
    }
    return NextResponse.json({ ok: true, count: cards.length });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'AI flashcard generation failed.' }, { status: 502 });
  }
}
