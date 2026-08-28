import { callGemini } from './gemini.js';

const COOKING_TIME_LABELS = {
  quick: 'quick — under 15 minutes of active cooking per meal',
  moderate: 'moderate — 15 to 30 minutes of active cooking per meal',
  none: 'no real time limit, longer or more involved recipes are fine',
};

function buildPrompt(answers, targets) {
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
    `Budget: ${budgetLine}`,
    extraNotes && extraNotes.trim() ? `Anything else the user wants considered: ${extraNotes.trim()}.` : '',
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

export async function generateMealPlan(answers, targets) {
  const result = await callGemini({ prompt: buildPrompt(answers, targets) });

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
