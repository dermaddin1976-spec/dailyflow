import { NextResponse } from 'next/server';
import db from '../../../../lib/db.js';
import { getCurrentUser } from '../../../../lib/auth.js';
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

  const { pdfBase64, url, title } = await request.json();

  let sourceTitle = title;
  let callArgs;
  let intro;

  if (pdfBase64) {
    sourceTitle = sourceTitle || 'Untitled notes';
    intro = 'You are a study assistant. Read this document and produce a study guide for a student preparing for a test on it.';
    callArgs = { fileBase64: pdfBase64, mimeType: 'application/pdf' };
  } else if (url) {
    if (!YOUTUBE_RE.test(url)) {
      return NextResponse.json({ error: 'Please paste a public YouTube link (youtube.com/watch?v=... or youtu.be/...).' }, { status: 400 });
    }
    const videoTitle = await lookupVideoTitle(url);
    sourceTitle = videoTitle || `YouTube video (${url})`;
    intro = 'You are a study assistant. Watch this video and produce a study guide for a student preparing for a test on it.';
    callArgs = { fileUri: url };
  } else {
    return NextResponse.json({ error: 'No file or link provided.' }, { status: 400 });
  }

  try {
    const result = await callGemini({
      prompt: [
        intro,
        'Be selective, not exhaustive — this is a study guide someone will actually read before a test, not a full',
        'transcript. Cut anything minor, repeated, or obvious; keep only what genuinely matters.',
        'Include: a tight 2-3 sentence summary of what it covers,',
        'a short list of the key points worth writing down, each as a punchy phrase or short sentence (aim for well',
        'under 15 words — cut qualifiers and restate as a fact, not a full explanation),',
        'and a short list of the specific things most likely to actually be tested on this material',
        '(definitions, formulas, dates, named concepts, cause-effect relationships) — same length limit, same rule:',
        'only what matters.',
        'Respond ONLY with JSON matching this shape:',
        '{"summary": string, "keyPoints": [string, ...], "testFocus": [string, ...]}.',
        'Produce at most 5-8 key points and at most 4-6 test-focus items, fewer if the material genuinely doesn\'t',
        'support that many distinct points — never pad to hit a count.',
      ].join(' '),
      ...callArgs,
    });

    const summary = typeof result.summary === 'string' ? result.summary : '';
    const keyPoints = Array.isArray(result.keyPoints) ? result.keyPoints.filter(Boolean) : [];
    const testFocus = Array.isArray(result.testFocus) ? result.testFocus.filter(Boolean) : [];

    const insert = db.prepare('INSERT INTO study_notes (user_id, source_title, summary, key_points, test_focus) VALUES (?, ?, ?, ?, ?)');
    const inserted = insert.run(user.id, sourceTitle, summary, keyPoints.join('\n'), testFocus.join('\n'));

    return NextResponse.json({ ok: true, id: Number(inserted.lastInsertRowid), title: sourceTitle });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'AI note generation failed.' }, { status: 502 });
  }
}
