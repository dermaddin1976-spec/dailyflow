import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../../lib/auth.js';

export async function GET(request, { params }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { code } = await params;
  const cleanCode = String(code || '').replace(/[^0-9]/g, '');
  if (!cleanCode) return NextResponse.json({ error: 'Invalid barcode.' }, { status: 400 });

  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${cleanCode}.json`, {
      headers: { 'User-Agent': 'DailyFlow - personal nutrition tracker - contact: none' },
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'Could not reach the product database — try again.' }, { status: 502 });
    }
    const data = await res.json();
    if (data.status !== 1 || !data.product) {
      return NextResponse.json({ error: `No product found for barcode ${cleanCode}. Try typing it in manually.` }, { status: 404 });
    }

    const p = data.product;
    const n = p.nutriments || {};
    const name = [p.product_name, p.brands].filter(Boolean).join(' — ') || 'Unknown product';

    const hasServing = n['energy-kcal_serving'] != null;
    const calories = Math.round(hasServing ? n['energy-kcal_serving'] : (n['energy-kcal_100g'] || 0));
    const protein = Math.round(hasServing ? (n['proteins_serving'] || 0) : (n['proteins_100g'] || 0));
    const carbs = Math.round(hasServing ? (n['carbohydrates_serving'] || 0) : (n['carbohydrates_100g'] || 0));
    const fat = Math.round(hasServing ? (n['fat_serving'] || 0) : (n['fat_100g'] || 0));
    const servingSize = p.serving_size ? ` (${p.serving_size})` : '';

    return NextResponse.json({
      description: name,
      calories, protein, carbs, fat,
      note: hasServing
        ? `Found "${name}" — per serving${servingSize} — review before saving.`
        : `Found "${name}" — per 100g, no serving size listed, so scale it for what you actually ate — review before saving.`,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong looking that up.' }, { status: 502 });
  }
}
