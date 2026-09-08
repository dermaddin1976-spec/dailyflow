import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/auth.js';
import { checkAiRateLimit, AI_DAILY_LIMIT } from '../../../../lib/rateLimit.js';
import { callGemini } from '../../../../lib/gemini.js';

const MAX_HISTORY_TURNS = 6;
const MAX_CONTEXT_CHARS = 12000;
const MAX_QUESTION_CHARS = 1000;

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

  const { context, question, history, domain } = await request.json();

  if (!context || typeof context !== 'string') {
    return NextResponse.json({ error: 'No study material to ask about.' }, { status: 400 });
  }
  const trimmedQuestion = typeof question === 'string' ? question.trim() : '';
  if (!trimmedQuestion) {
    return NextResponse.json({ error: 'Type a question first.' }, { status: 400 });
  }
  if (trimmedQuestion.length > MAX_QUESTION_CHARS) {
    return NextResponse.json({ error: 'That question is too long.' }, { status: 400 });
  }

  const safeContext = context.slice(0, MAX_CONTEXT_CHARS);
  const safeHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS) : [];

  const historyText = safeHistory
    .filter(m => m && typeof m.text === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .map(m => `${m.role === 'user' ? 'Student' : 'You'}: ${m.text}`)
    .join('\n');

  // Each tab's Ask panel passes its own domain so DailyAI answers as a
  // specialist in that area instead of one generic assistant guessing at
  // what kind of material it's looking at.
  const PERSONAS = {
    study: [
      "You are DailyAI's study tutor — an expert at explaining academic material clearly, connecting related",
      "concepts, catching gaps in understanding, and helping a student actually learn the material below (their",
      'own notes, flashcards, or source summaries) rather than just repeating it back.',
    ].join(' '),
    nutrition: [
      "You are DailyAI's nutrition coach — knowledgeable about sports nutrition, macros, and fueling for daily",
      'training. The material below is the user\'s own logged meals. They train every day on purpose and want',
      'practical advice on hitting their targets and supporting training, not generic diet talk.',
    ].join(' '),
  };
  const persona = PERSONAS[domain] || [
    'You are DailyAI, a helpful assistant embedded in the DailyFlow app, answering questions about whatever',
    'material is provided below — this could be study notes, flashcards, a meal plan, or something else entirely.',
  ].join(' ');

  const prompt = [
    persona,
    'Below is that material, then the conversation so far, then the user\'s new question.',
    'Answer the new question clearly and simply, grounding your answer in the material when it\'s relevant.',
    'If the question goes beyond what\'s in the material, you can still answer using your own knowledge, but say',
    'so briefly rather than pretending it\'s all from the material. If the question is unclear, ask for',
    'clarification instead of guessing.',
    'Important: you can only answer in words here — you have no way to actually save, apply, or change anything',
    'the material describes. If the user asks you to change, redesign, or update something (like "redo my plan",',
    '"swap this out"), do not claim you made a change. Instead, describe what the change would look like, and',
    'briefly mention that they\'ll need to use this app\'s dedicated tool for actually applying changes, if one exists.',
    'Keep answers focused and not overly long — a few sentences to a short paragraph, unless the question genuinely',
    'needs a longer explanation (like working through a formula or a multi-step process).',
    '--- MATERIAL ---',
    safeContext,
    historyText ? '--- CONVERSATION SO FAR ---' : '',
    historyText,
    '--- NEW QUESTION ---',
    trimmedQuestion,
    'Respond ONLY with JSON matching this shape: {"answer": string}.',
  ].filter(Boolean).join('\n');

  try {
    const result = await callGemini({ prompt });
    const answer = typeof result.answer === 'string' ? result.answer : '';
    if (!answer) return NextResponse.json({ error: 'The AI gave an empty answer — try rephrasing.' }, { status: 502 });
    return NextResponse.json({ answer });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Something went wrong asking that.' }, { status: 502 });
  }
}
