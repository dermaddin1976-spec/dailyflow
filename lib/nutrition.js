const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary (little to no exercise)' },
  { value: 'light', label: 'Light (exercise 1-3 days/week)' },
  { value: 'moderate', label: 'Moderate (exercise 3-5 days/week)' },
  { value: 'active', label: 'Active (exercise 6-7 days/week)' },
  { value: 'very_active', label: 'Very active (hard training or physical job)' },
];

export const GOALS = [
  { value: 'lose', label: 'Lose weight' },
  { value: 'maintain', label: 'Maintain weight' },
  { value: 'gain', label: 'Gain weight' },
];

// Default pace when there's no target weight to pace off: a flat, moderate deficit/surplus.
const GOAL_ADJUSTMENTS = {
  lose: { calorieDelta: -500, proteinPerKg: 1.8, minCalories: 1200 },
  maintain: { calorieDelta: 0, proteinPerKg: 1.6, minCalories: 1200 },
  gain: { calorieDelta: 300, proteinPerKg: 1.7, minCalories: 1200 },
};

const KCAL_PER_KG = 7700; // rough energy equivalent of 1kg of body weight change

export function hasBodyProfile(user) {
  return !!(user && user.age && user.weight_kg && user.height_cm && user.sex && user.activity_level);
}

// Mifflin-St Jeor for BMR, scaled by activity level for maintenance calories, then adjusted
// for the stated goal (lose/maintain/gain) before splitting into a standard macro target.
// When a target weight is set, the pace is tapered by how far there is to go — full pace while
// more than 2kg away, easing off as the target gets close so it doesn't overshoot — and used to
// estimate a rough timeline.
export function computeTargets(user) {
  if (!hasBodyProfile(user)) return null;
  const { age, weight_kg: weight, height_cm: height, sex, activity_level, target_weight_kg: targetWeight } = user;
  const goal = GOAL_ADJUSTMENTS[user.goal] ? user.goal : 'maintain';
  const base = GOAL_ADJUSTMENTS[goal];

  const bmr = sex === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  const multiplier = ACTIVITY_MULTIPLIERS[activity_level] || 1.2;
  const maintenance = bmr * multiplier;

  let calorieDelta = base.calorieDelta;
  let remainingKg = null;
  let weeksToGoal = null;

  if (goal !== 'maintain' && targetWeight) {
    const gap = goal === 'lose' ? weight - targetWeight : targetWeight - weight;
    if (gap <= 0.1) {
      // already at (or past) the target — ease off toward maintenance
      calorieDelta = 0;
      remainingKg = 0;
    } else {
      remainingKg = Math.round(gap * 10) / 10;
      const paceFactor = Math.max(0.4, Math.min(1, gap / 2)); // full pace >=2kg out, tapers under that, floors at 40%
      calorieDelta = Math.round(base.calorieDelta * paceFactor);
      weeksToGoal = calorieDelta !== 0 ? Math.max(1, Math.round((gap * KCAL_PER_KG) / Math.abs(calorieDelta) / 7)) : null;
    }
  }

  const calories = Math.max(base.minCalories, Math.round(maintenance + calorieDelta));

  const proteinG = Math.round(weight * base.proteinPerKg);
  const proteinCals = proteinG * 4;
  const fatCals = calories * 0.27;
  const fatG = Math.round(fatCals / 9);
  const carbsCals = Math.max(0, calories - proteinCals - fatCals);
  const carbsG = Math.round(carbsCals / 4);

  return { calories, protein: proteinG, carbs: carbsG, fat: fatG, goal, remainingKg, weeksToGoal };
}
