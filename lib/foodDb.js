const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1';

// USDA FoodData Central nutrient IDs for the four macros we track.
const NUTRIENT_IDS = { calories: 1008, protein: 1003, carbs: 1005, fat: 1004 };

function nutrientValue(foodNutrients, id) {
  const hit = (foodNutrients || []).find(n => n.nutrientId === id);
  return hit ? hit.value : null;
}

// Looks up one food's per-100g macros from USDA's FoodData Central — a free,
// government-maintained nutrition database — instead of relying on the AI's
// memory of typical values, which is where estimates for near-identical
// dishes were drifting apart. Prefers lab-measured Foundation/SR Legacy
// entries over the modeled "as prepared" survey data (FNDDS) when both come
// back, but falls through to whatever the search turns up. Returns null on
// any failure (no match, rate limit, network hiccup) so the caller can fall
// back to the AI's own estimate for that item instead of failing outright.
export async function lookupFoodPer100g(name) {
  if (!name || !String(name).trim()) return null;
  const key = process.env.USDA_FDC_API_KEY || 'DEMO_KEY';

  const params = new URLSearchParams({ api_key: key, query: String(name).trim(), pageSize: '5' });
  params.append('dataType', 'Foundation');
  params.append('dataType', 'SR Legacy');
  params.append('dataType', 'Survey (FNDDS)');

  try {
    const res = await fetch(`${FDC_BASE}/foods/search?${params.toString()}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const foods = data.foods || [];
    if (!foods.length) return null;

    const best = foods.find(f => f.dataType === 'Foundation' || f.dataType === 'SR Legacy') || foods[0];
    const per100g = {
      calories: nutrientValue(best.foodNutrients, NUTRIENT_IDS.calories),
      protein: nutrientValue(best.foodNutrients, NUTRIENT_IDS.protein),
      carbs: nutrientValue(best.foodNutrients, NUTRIENT_IDS.carbs),
      fat: nutrientValue(best.foodNutrients, NUTRIENT_IDS.fat),
    };
    if (per100g.calories == null) return null;
    return { matchedName: best.description, per100g };
  } catch (err) {
    return null;
  }
}

// Combines an AI's per-item breakdown (a food name + estimated grams, plus
// its own fallback macro guess for that item) with real per-100g values from
// FoodData Central wherever a lookup succeeds, and falls back to the AI's
// own guess for any item that can't be matched — so a lookup outage or an
// odd food name degrades gracefully instead of failing the whole estimate.
export async function groundMealTotals(items) {
  const list = Array.isArray(items) ? items : [];
  const lookups = await Promise.all(
    list.map(item => (item && item.name) ? lookupFoodPer100g(item.name) : Promise.resolve(null))
  );

  let calories = 0, protein = 0, carbs = 0, fat = 0, matched = 0;
  list.forEach((item, i) => {
    const grams = Number(item && item.grams) || 0;
    const hit = lookups[i];
    const aiCalories = Number(item && item.calories) || 0;

    let useGrounded = !!(hit && grams > 0);
    if (useGrounded && aiCalories > 0) {
      // A plain-text search against FDC can land on the wrong entry — e.g. a
      // spice or a lean variant that happens to share a name with the actual
      // item — and applying that per-100g value to the item's full weight
      // then makes the total LESS accurate than just trusting the AI's own
      // in-context estimate would have been. When the grounded figure for
      // one item is wildly different from what the AI itself estimated for
      // it, treat the match as unreliable rather than trust it blindly.
      const groundedCalories = (hit.per100g.calories || 0) * grams / 100;
      const ratio = groundedCalories / aiCalories;
      if (ratio > 2.5 || ratio < 0.4) useGrounded = false;
    }

    if (useGrounded) {
      matched++;
      calories += (hit.per100g.calories || 0) * grams / 100;
      protein += (hit.per100g.protein || 0) * grams / 100;
      carbs += (hit.per100g.carbs || 0) * grams / 100;
      fat += (hit.per100g.fat || 0) * grams / 100;
    } else {
      calories += aiCalories;
      protein += Number(item && item.protein) || 0;
      carbs += Number(item && item.carbs) || 0;
      fat += Number(item && item.fat) || 0;
    }
  });

  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    matchedCount: matched,
    totalCount: list.length,
  };
}
