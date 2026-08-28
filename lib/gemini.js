const GEMINI_MODEL = 'gemini-3-flash-preview';

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Gemini is asked for JSON-only output, but every now and then it still tacks on
// trailing text after a otherwise-valid JSON value (an explanation, a stray code
// fence, etc). Rather than fail the whole request, find the first balanced
// {...} or [...] in the text and parse just that, ignoring whatever follows.
function extractFirstJsonValue(text) {
  const start = text.search(/[[{]/);
  if (start === -1) return null;
  const openChar = text[start];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseGeminiJson(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    const extracted = extractFirstJsonValue(text);
    if (extracted) {
      try {
        return JSON.parse(extracted);
      } catch (err2) { /* fall through */ }
    }
    throw new Error("DailyAI's response didn't come back in a valid format — try asking again.");
  }
}

export async function callGemini({ prompt, fileBase64, mimeType, fileUri, files, temperature }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set on the server.');

  const parts = [{ text: prompt }];
  if (Array.isArray(files) && files.length) {
    for (const f of files) {
      if (f && f.base64 && f.mimeType) {
        parts.push({ inline_data: { mime_type: f.mimeType, data: f.base64 } });
      }
    }
  } else if (fileBase64 && mimeType) {
    parts.push({ inline_data: { mime_type: mimeType, data: fileBase64 } });
  } else if (fileUri) {
    parts.push({ file_data: { file_uri: fileUri } });
  }

  const generationConfig = {
    responseMimeType: 'application/json',
    thinkingConfig: { thinkingLevel: 'low' },
  };
  if (typeof temperature === 'number') {
    generationConfig.temperature = temperature;
  }

  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig,
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const maxAttempts = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
      if (!text) throw new Error('Gemini returned no content.');
      return parseGeminiJson(text);
    }

    const text = await res.text();
    lastError = new Error(`Gemini API error (${res.status}): ${text.slice(0, 300)}`);

    // Retry only on transient server-side overload/unavailability, not on bad requests.
    if ((res.status === 503 || res.status === 429) && attempt < maxAttempts) {
      await sleep(attempt * 1500);
      continue;
    }
    throw lastError;
  }

  throw lastError;
}
