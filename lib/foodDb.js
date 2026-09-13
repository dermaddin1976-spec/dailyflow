const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1';

// USDA FoodData Central nutrient IDs for the four macros we track.
const NUTRIENT_IDS = { calories: 1008, protein: 1003, carbs: 1005, fat: 1004 };

// Cooking-state words are handled separately from the food's core identity
// (see isRelevantMatch below) — USDA's raw-ingredient entries and its
// cooked/prepared entries for the same food can differ hugely in calories
// per 100g (dry rice vs. cooked rice is roughly a 3x difference), so this
// list lets us tell "different preparation" apart from "different food."
const STATE_WORDS = new Set([
  'raw', 'cooked', 'grilled', 'roasted', 'boiled', 'steamed', 'baked',
  'fried', 'poached', 'sauteed', 'braised', 'blanched', 'stewed', 'broiled',
]);
const RAW_WORD = 'raw';

export function tokenize(text) {
  return (String(text || '').toLowerCase().match(/[a-z0-9]+/g)) || [];
}

// A USDA search for a composite/prepared dish name (e.g. "potato salad")
// often has no real match at all in the Foundation/SR Legacy data — those
// datasets are almost entirely raw single ingredients — and a naive "just
// take the first result" pick lands on something that merely shares one
// word (e.g. "Flour, potato" for a query of "potato salad": 361 kcal/100g
// applied to a whole bowl of potato salad, instead of ~100-150 kcal/100g,
// is how a real dinner log came back reading 1000+ calories for a small
// side dish). This requires every core word of the AI's item name to
// actually appear in the candidate's USDA description, and separately
// rejects a raw-labeled candidate when the AI described the food as
// cooked — both are "different food" mismatches, not just noisy ranking.
export function isRelevantMatch(queryTokens, candidateDescription) {
  const candTokens = new Set(tokenize(candidateDescription));
  const coreTokens = queryTokens.filter(w => w.length >= 3 && !STATE_WORDS.has(w));
  // If the name is nothing but state words (shouldn't normally happen —
  // the AI is asked for a food name, not just a cooking method) fall back
  // to requiring the state words themselves so this doesn't accidentally
  // accept everything.
  const required = coreTokens.length ? coreTokens : queryTokens.filter(w => w.length >= 3);
  if (!required.length) return false;
  if (!required.every(w => candTokens.has(w))) return false;

  const queryStates = queryTokens.filter(w => STATE_WORDS.has(w));
  const queryImpliesCooked = queryStates.length === 0 || queryStates.some(w => w !== RAW_WORD);
  const candIsRawOnly = candTokens.has(RAW_WORD) && !Array.from(STATE_WORDS).some(w => w !== RAW_WORD && candTokens.has(w));
  if (queryImpliesCooked && candIsRawOnly) return false;

  return true;
}

function nutrientValue(foodNutrients, id) {
  const hit = (foodNutrients || []).find(n => n.nutrientId === id);
  return hit ? hit.value : null;
}

// Looks up one food's per-100g macros from USDA's FoodData Central — a free,
// government-maintained nutrition database — instead of relying on the AI's
// memory of typical values, which is where estimates for near-identical
// dishes were drifting apart. Prefers lab-measured Foundation/SR Legacy
// entries over the modeled "as prepared" survey data (FNDDS) when both come
// back, but only among candidates that actually match what was asked for
// (see isRelevantMatch) — otherwise falls through to whatever else matches,
// and returns null if nothing does so the caller can fall back to the AI's
// own estimate for that item instead of grounding it against the wrong food.
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

    const queryTokens = tokenize(name);
    const candidates = foods.filter(f => isRelevantMatch(queryTokens, f.description));
    if (!candidates.length) return null;

    const best = candidates.find(f => f.dataType === 'Foundation' || f.dataType === 'SR Legacy') || candidates[0];
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
      // Even a topically-relevant match can still be the wrong variety (a
      // spice or a lean cut that happens to share every core word) and
      // applying that per-100g value to the item's full weight then makes
      // the total LESS accurate than just trusting the AI's own in-context
      // estimate would have been. When the grounded figure for one item is
      // wildly different from what the AI itself estimated for it, treat
      // the match as unreliable rather than trust it blindly.
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
