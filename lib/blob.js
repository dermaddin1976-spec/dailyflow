import { put } from '@vercel/blob';

// Meal photos used to be stored inline as base64 in the meal_logs row,
// which bloated every list/query that touched the table. This decodes a
// `data:<mime>;base64,<data>` URL (already downsized client-side — see
// resizeForStorage in meal-logger.js) and uploads it to Vercel Blob public
// storage instead, returning just the resulting URL to store in the row.
export async function uploadMealPhoto(userId, dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) throw new Error('Invalid photo data URL.');
  const [, mimeType, base64] = match;
  const buffer = Buffer.from(base64, 'base64');
  const ext = (mimeType.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
  const key = `meal-photos/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { url } = await put(key, buffer, { access: 'public', contentType: mimeType });
  return url;
}
