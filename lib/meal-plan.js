import { callGemini } from './gemini.js';

const COOKING_TIME_LABELS = {
  quick: 'quick — under 15 minutes of active cooking per meal',
  moderate: 'moderate — 15 to 30 minutes of active cooking per meal',
  none: 'no real time limit, longer or more involved recipes are fine',
};

const MEAL_TYPE_LABELS = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  any: null,
};

const CONTEXT_LINES = {
  'Post-workout': 'This is right after a workout — prioritize protein and easy digestion for recovery.',
  'Pre-workout': 'This is shortly before a workout — keep it easy to digest, moderate carbs, not too heavy or greasy.',
  'Late night': "It's late at night — keep it lighter and easy to fall asleep after eating.",
  'On the go': 'This needs to be eaten immediately, on the go, right after getting it — easy to eat without plates or utensils where possible.',
};

function contextLine(context) {
  return context && CONTEXT_LINES[context] ? CONTEXT_LINES[context] : '';
}

function storeAndToolsLines(answers) {
  const { groceryStore, kitchenTools } = answers;
  return [
    groceryStore && groceryStore.trim()
      ? `Shops mainly at: ${groceryStore.trim()}. Prefer ingredients that would realistically be available there.`
      : 'No particular grocery store specified.',
    kitchenTools && kitchenTools.trim()
      ? `Kitchen equipment available: ${kitchenTools.trim()}. Do not suggest recipes or techniques that need equipment not on this list.`
      : 'No kitchen equipment limitations were stated — assume a normal, reasonably equipped home kitchen.',
  ];
}

function buildSingleServingPrompt(answers, targets, recentNames) {
  const {
    scope, mealType, diet, dietOther, allergies, cuisines,
    cookingTime, servings, currency, extraNotes, context, grabStore,
  } = answers;

  const isGrab = scope === 'grab';
  const kind = scope === 'snack' ? 'snack' : isGrab ? 'ready-to-eat item or two' : 'meal';
  const mealTypeLabel = scope === 'meal' ? MEAL_TYPE_LABELS[mealType] : null;

  const dietLine = (Array.isArray(diet) && diet.length ? diet.join(', ') : 'no particular dietary style')
    + (dietOther && dietOther.trim() ? `; also: ${dietOther.trim()}` : '');

  const grabLines = isGrab ? [
    `The user is physically at or heading to ${grabStore && grabStore.trim() ? grabStore.trim() : 'a grocery store'} right now and wants something to eat immediately — this is NOT a recipe to cook at home.`,
    `Only suggest ready-to-eat or zero-prep products that store would realistically sell on its shelves (e.g. a protein shake or drink, a pre-made sandwich or bread roll with deli meat, a piece of fruit, a yogurt, a protein bar, nuts). Nothing that needs a stove, oven, or any cooking — at most simple assembly like putting deli meat on a roll.`,
  ] : [];

  return [
    `You are a nutrition planning assistant. The user wants ${isGrab ? 'something to grab and eat right now with zero cooking' : `ONE ${kind} right now, not a multi-day plan`}.`,
    ``,
    `For rough context only, their daily targets are about ${targets.calories} calories, ${targets.protein}g protein, ${targets.carbs}g carbs, ${targets.fat}g fat — use this only to judge a sensible portion, not as something this needs to hit on its own.`,
    mealTypeLabel ? `This should work as: ${mealTypeLabel}.` : '',
    contextLine(context),
    ...grabLines,
    `Dietary style: ${dietLine}.`,
    `Allergies or foods to strictly avoid — do not include these under any circumstances, in any form: ${allergies && allergies.trim() ? allergies.trim() : 'none stated'}.`,
    !isGrab && cuisines && cuisines.trim() ? `Preferred cuisines or foods to lean into where it fits: ${cuisines.trim()}.` : '',
    !isGrab ? `Cooking time budget: ${COOKING_TIME_LABELS[cookingTime] || COOKING_TIME_LABELS.quick}.` : '',
    ...(!isGrab ? storeAndToolsLines(answers) : []),
    !isGrab ? `Cook for ${servings || 1} serving${(servings || 1) === 1 ? '' : 's'}.` : '',
    extraNotes && extraNotes.trim()
      ? `Important context for this specific ${kind} — factor this in when choosing what to suggest (e.g. timing around exercise, how hungry, time of day): ${extraNotes.trim()}.`
      : '',
    Array.isArray(recentNames) && recentNames.length
      ? `Variety matters: the user has been given these ${kind}s recently for this same kind of request — pick something meaningfully different this time, not a reworded or barely-tweaked version of any of them: ${recentNames.join('; ')}.`
      : '',
    ``,
    `Give ${isGrab ? 'one simple combo of items — it is fine if that means more than one product, like a drink plus a sandwich' : `exactly ONE ${kind}`} with a short recognizable name, a one-sentence description, and its combined calories/protein/carbs/fat for one serving.`,
    `Then list the ${isGrab ? 'individual products to buy' : 'ingredients it actually needs'} as a shopping list (skip pantry basics the user would obviously already`,
    `have, like salt, water, or oil, unless the recipe needs an unusual amount), grouped into categories (Produce, Meat`,
    `& fish, Dairy & eggs, Pantry, Frozen, Other), each with a realistic estimated cost in ${currency || 'EUR'}. Sum those`,
    `into an estimated total cost.`,
    ``,
    `Respond ONLY with JSON matching this shape:`,
    `{"days": [{"day": "Today", "meals": [{"meal": string, "name": string, "description": string, "calories": number, "protein": number, "carbs": number, "fat": number}]}],`,
    `"shoppingList": [{"item": string, "quantity": string, "category": string, "estCost": number}],`,
    `"estimatedTotalCost": number,`,
    `"notes": string (any caveats or substitutions worth flagging — empty string if there's nothing to add)}`,
  ].filter(Boolean).join('\n');
}

function buildFullPlanPrompt(answers, targets, recentNames) {
  const {
    days, mealsPerDay, includeSnacks, diet, dietOther, allergies, cuisines,
    cookingTime, servings, budgetAmount, currency, extraNotes,
  } = answers;

  const dietLine = (Array.isArray(diet) && diet.length ? diet.join(', ') : 'no particular dietary style')
    + (dietOther && dietOther.trim() ? `; also: ${dietOther.trim()}` : '');

  const budgetLine = budgetAmount
    ? `${budgetAmount} ${currency} for the whole plan's shopping list — try hard to stay at or under this, and say clearly in "notes" if it genuinely isn't achievable for what's been asked for.`
    : 'no strict budget was given, but still keep costs reasonable and avoid unnecessarily expensive ingredients.';

  return [
    `You are a nutrition planning assistant. Build a ${days}-day meal plan.`,
    ``,
    `Daily targets per person, per day: ${targets.calories} calories, ${targets.protein}g protein, ${targets.carbs}g carbs, ${targets.fat}g fat.`,
    `Hit these as closely as practical across each day's meals — these are single-serving daily targets.`,
    ``,
    `Structure: ${mealsPerDay} meals per day${includeSnacks ? ', plus one snack per day' : ''}.`,
    `Cook for ${servings} serving${servings === 1 ? '' : 's'} per meal.`,
    `Dietary style: ${dietLine}.`,
    `Allergies or foods to strictly avoid — do not include these under any circumstances, in any form: ${allergies && allergies.trim() ? allergies.trim() : 'none stated'}.`,
    `Preferred cuisines or foods to lean into where it fits: ${cuisines && cuisines.trim() ? cuisines.trim() : 'no particular preference'}.`,
    `Cooking time budget per meal: ${COOKING_TIME_LABELS[cookingTime] || COOKING_TIME_LABELS.moderate}.`,
    ...storeAndToolsLines(answers),
    `Budget: ${budgetLine}`,
    extraNotes && extraNotes.trim() ? `Anything else the user wants considered: ${extraNotes.trim()}.` : '',
    Array.isArray(recentNames) && recentNames.length
      ? `Variety matters: the user has been given these meals recently in past plans — avoid repeating them, or only lightly rewording them, across this new plan: ${recentNames.join('; ')}.`
      : '',
    ``,
    `For each day, list every meal with a short recognizable name, a one-sentence description, and its calories/protein/carbs/fat`,
    `for ONE serving. Then produce ONE consolidated shopping list for the whole plan — combine repeated ingredients across`,
    `days into single line items, with quantities scaled for ${servings} serving${servings === 1 ? '' : 's'} per meal, grouped into`,
    `categories (Produce, Meat & fish, Dairy & eggs, Pantry, Frozen, Other), each with a realistic estimated cost in ${currency}.`,
    `Sum those into an estimated total cost for the whole list.`,
    ``,
    `Respond ONLY with JSON matching this shape:`,
    `{"days": [{"day": string, "meals": [{"meal": string, "name": string, "description": string, "calories": number, "protein": number, "carbs": number, "fat": number}]}],`,
    `"shoppingList": [{"item": string, "quantity": string, "category": string, "estCost": number}],`,
    `"estimatedTotalCost": number,`,
    `"notes": string (any caveats, substitutions, or budget notes worth flagging — empty string if there's nothing to add)}`,
  ].filter(Boolean).join('\n');
}

function buildPrompt(answers, targets, recentNames) {
  if (answers.scope === 'meal' || answers.scope === 'snack' || answers.scope === 'grab') {
    return buildSingleServingPrompt(answers, targets, recentNames);
  }
  return buildFullPlanPrompt(answers, targets, recentNames);
}

export function extractMealNames(days) {
  const names = [];
  if (Array.isArray(days)) {
    for (const day of days) {
      for (const m of (day && day.meals) || []) {
        if (m && m.name && !names.includes(m.name)) names.push(m.name);
      }
    }
  }
  return names;
}

export async function generateMealPlan(answers, targets, recentNames = []) {
  const result = await callGemini({ prompt: buildPrompt(answers, targets, recentNames), temperature: 1.15 });

  const days = Array.isArray(result.days)
    ? result.days.map(d => ({
        day: String(d.day || ''),
        meals: Array.isArray(d.meals) ? d.meals.map(m => ({
          meal: String(m.meal || ''),
          name: String(m.name || ''),
          description: String(m.description || ''),
          calories: Number(m.calories) || 0,
          protein: Number(m.protein) || 0,
          carbs: Number(m.carbs) || 0,
          fat: Number(m.fat) || 0,
        })) : [],
      }))
    : [];

  const shoppingList = Array.isArray(result.shoppingList)
    ? result.shoppingList.map(i => ({
        item: String(i.item || ''),
        quantity: String(i.quantity || ''),
        category: String(i.category || 'Other'),
        estCost: Number(i.estCost) || 0,
      }))
    : [];

  const estimatedTotalCost = typeof result.estimatedTotalCost === 'number'
    ? result.estimatedTotalCost
    : shoppingList.reduce((s, i) => s + (i.estCost || 0), 0);

  const notes = typeof result.notes === 'string' ? result.notes : '';

  return { days, shoppingList, estimatedTotalCost, notes };
}
