import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../../lib/auth.js';
import { withApi } from '../../../../../lib/apiHandler.js';
import { uploadMealPhoto } from '../../../../../lib/blob.js';

export const POST = withApi(async function POST(request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const { photo_data_url } = await request.json();
  if (!photo_data_url) return NextResponse.json({ error: 'No photo provided.' }, { status: 400 });
  const url = await uploadMealPhoto(user.id, photo_data_url);
  return NextResponse.json({ url });
});
