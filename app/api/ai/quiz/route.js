import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { getCurrentUser } from '../../../../lib/auth.js';
import { callGemini } from '../../../../lib/gemini.js';

export async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { title } = await request.json();
  if (!title) return NextResponse.json({ error: 'Missing deck title.' }, { status: 400 });

  const cards = await db.prepare('SELECT question, answer FROM flashcards WHERE user_id=? AND source_title=?').all(user.id, title);
  if (!cards.length) return NextResponse.json({ error: 'That deck has no cards.' }, { status: 400 });

  const material = cards.map((c, i) => `${i + 1}. Q: ${c.question}\nA: ${c.answer}`).join('\n');

  try {
    const result = await callGemini({
      prompt: [
        'You are a quiz generator. Based on these flashcard question/answer pairs from a study deck, create multiple-choice',
        'quiz questions — one per flashcard. For each, write the question, the correct answer, and three plausible but',
        'incorrect distractor answers from the same topic (not obviously wrong or silly). Shuffle which position (0-3) the',
        'correct answer sits in across questions, do not always put it first.',
        'Respond ONLY with JSON matching this shape:',
        '{"questions": [{"question": string, "options": [string, string, string, string], "correctIndex": number}]}',
        '',
        'Flashcards:',
        material,
      ].join('\n'),
    });

    const questions = Array.isArray(result.questions) ? result.questions : [];
    await db.prepare('DELETE FROM quiz_questions WHERE user_id=? AND source_title=?').run(user.id, title);
    const insert = db.prepare('INSERT INTO quiz_questions (user_id, source_title, question, options, correct_index) VALUES (?, ?, ?, ?, ?)');
    for (const q of questions) {
      if (q && q.question && Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.correctIndex)) {
        await insert.run(user.id, title, q.question, JSON.stringify(q.options), q.correctIndex);
      }
    }
    return NextResponse.json({ ok: true, count: questions.length });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Quiz generation failed.' }, { status: 502 });
  }
}
