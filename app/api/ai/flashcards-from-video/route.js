import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { getCurrentUser } from '../../../../lib/auth.js';
import { checkAiRateLimit, AI_DAILY_LIMIT } from '../../../../lib/rateLimit.js';
import { callGemini } from '../../../../lib/gemini.js';

const YOUTUBE_RE = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/i;

async function lookupVideoTitle(url) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.title || null;
  } catch (err) {
    return null;
  }
}

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

  const { url } = await request.json();
  if (!url || !YOUTUBE_RE.test(url)) {
    return NextResponse.json({ error: 'Please paste a public YouTube link (youtube.com/watch?v=... or youtu.be/...).' }, { status: 400 });
  }

  const videoTitle = await lookupVideoTitle(url);
  const sourceTitle = videoTitle || `YouTube video (${url})`;

  try {
    const result = await callGemini({
      prompt: [
        'You are a study assistant. Watch this video and produce flashcards covering its key facts,',
        'definitions, and concepts a student should memorize for a test.',
        'Respond ONLY with JSON matching this shape: {"cards": [{"question": string, "answer": string}, ...]}.',
        'Produce between 8 and 20 cards depending on how much material the video covers. Keep questions and answers concise.',
      ].join(' '),
      fileUri: url,
    });
    const cards = Array.isArray(result.cards) ? result.cards : [];
    const insert = db.prepare('INSERT INTO flashcards (user_id, source_title, question, answer) VALUES (?, ?, ?, ?)');
    for (const c of cards) {
      if (c && c.question && c.answer) await insert.run(user.id, sourceTitle, c.question, c.answer);
    }
    return NextResponse.json({ ok: true, count: cards.length, title: sourceTitle });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'AI flashcard generation failed.' }, { status: 502 });
  }
}
