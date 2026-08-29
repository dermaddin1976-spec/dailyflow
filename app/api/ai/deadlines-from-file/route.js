import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth.js';
import { checkAiRateLimit, AI_DAILY_LIMIT } from '../../../../lib/rateLimit.js';
import { callGemini } from '../../../../lib/gemini.js';

function todayStr() { return new Date().toISOString().slice(0, 10); }

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

  const { pdfBase64, images } = await request.json();

  let callArgs;
  if (pdfBase64) {
    callArgs = { fileBase64: pdfBase64, mimeType: 'application/pdf' };
  } else if (Array.isArray(images) && images.length) {
    callArgs = { files: images.map(img => ({ base64: img.base64, mimeType: img.mimeType || 'image/jpeg' })) };
  } else {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  }

  const today = todayStr();
  const year = today.slice(0, 4);

  try {
    const result = await callGemini({
      prompt: [
        `You are extracting deadlines from a syllabus, course schedule, or assignment list for a student. Today's`,
        `date is ${today}.`,
        `Find every assignment, exam, quiz, project, or other graded deadline mentioned, with its due date.`,
        `Resolve each date using whatever semester/year context the document itself gives; if no year is stated,`,
        `use your best judgment based on today's date (${today}) and the surrounding context — when genuinely`,
        `ambiguous, make a reasonable guess rather than skipping it, but flag anything you're unsure about in`,
        `"warnings" rather than silently guessing something that could be wrong by a year.`,
        `Respond ONLY with JSON matching this shape:`,
        `{"deadlines": [{"title": string (short and specific, e.g. "Chemistry midterm", "Problem set 4 due"),`,
        `"due_date": string in YYYY-MM-DD format}], "warnings": string}.`,
        `"warnings" should be an empty string if there's nothing to flag, or a short note about dates you weren't`,
        `confident about, or that you couldn't find any real deadlines in the material.`,
      ].join(' '),
      ...callArgs,
    });

    const deadlines = Array.isArray(result.deadlines)
      ? result.deadlines
          .filter(d => d && d.title && d.due_date)
          .map(d => ({ title: String(d.title), due_date: String(d.due_date) }))
      : [];
    const warnings = typeof result.warnings === 'string' ? result.warnings : '';

    return NextResponse.json({ deadlines, warnings });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Reading that file failed.' }, { status: 502 });
  }
}
