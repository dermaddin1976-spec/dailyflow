import Link from 'next/link';
import { requireUser } from '../../../lib/auth.js';
import db from '../../../lib/db.js';
import { computeTargets, hasBodyProfile } from '../../../lib/nutrition.js';
import InfoTip from '../info-tip.js';
import MealLogger from '../meal-logger.js';

function todayStr(){ return new Date().toISOString().slice(0,10); }

const GOAL_LABELS = { lose: 'lose weight', maintain: 'maintain weight', gain: 'gain weight' };
function goalLabel(goal) { return GOAL_LABELS[goal] || 'maintain weight'; }

function macroColor(pct) {
  if (pct > 130) return 'var(--critical)';
  if (pct > 105) return 'var(--warning)';
  return 'var(--accent)';
}

function MacroBar({ label, consumed, target, unit }) {
  const pct = target ? Math.round((consumed / target) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
        <span style={{ color: 'var(--text-2)' }}>{label}</span>
        <span className="mono" style={{ color: 'var(--muted)' }}>{consumed}{unit} / {target}{unit}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: macroColor(pct), borderRadius: 3 }} />
      </div>
    </div>
  );
}

export default async function NutritionPage() {
  const user = await requireUser();
  const date = todayStr();
  const totals = await db.prepare(
    'SELECT COALESCE(SUM(calories),0) as calories, COALESCE(SUM(protein),0) as protein, COALESCE(SUM(carbs),0) as carbs, COALESCE(SUM(fat),0) as fat FROM meal_logs WHERE user_id=? AND date=?'
  ).get(user.id, date);
  const targets = computeTargets(user);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Nutrition</h1>
        <InfoTip>
          Your daily targets come from the age, weight, height, sex, activity level and goal you set in Settings,
          run through a standard calorie-needs formula (Mifflin-St Jeor) and then adjusted for whether you're
          losing, maintaining, or gaining weight. If you've also set a target weight, the pace is tapered by how
          far you actually have to go &mdash; a bigger push while you're far off, easing up as you get close &mdash;
          and used to estimate a rough timeline. Protein is set relative to your bodyweight; fat and carbs split the
          rest of your calories. Today's totals below come from the meals you log.
        </InfoTip>
      </div>
      <p style={{ color: 'var(--text-2)', margin: '0 0 24px' }}>
        Today&rsquo;s intake against your daily targets{targets ? ` — set to ${goalLabel(targets.goal)}` : ''}.
      </p>

      {!hasBodyProfile(user) ? (
        <div className="card" style={{ marginBottom: 28, textAlign: 'center', padding: '36px 28px' }}>
          <h3 style={{ marginBottom: 8 }}>Set up your daily targets</h3>
          <p style={{ color: 'var(--text-2)', fontSize: 13.5, maxWidth: 380, margin: '0 auto 18px' }}>
            Add your age, weight, height, sex and activity level in Settings and DailyFlow will work out a personalized
            calorie and macro target for each day.
          </p>
          <Link href="/settings" className="btn">Go to Settings</Link>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 28, padding: 28 }}>
          {targets.remainingKg != null && (
            <p className="mono" style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
              {targets.remainingKg <= 0
                ? 'At your target weight — calories are set to maintain.'
                : `${targets.remainingKg}kg to go${targets.weeksToGoal ? ` — about ${targets.weeksToGoal} week${targets.weeksToGoal === 1 ? '' : 's'} at this pace` : ''}.`}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <MacroBar label="Calories" consumed={totals.calories} target={targets.calories} unit=" cal" />
            <MacroBar label="Protein" consumed={totals.protein} target={targets.protein} unit="g" />
            <MacroBar label="Carbs" consumed={totals.carbs} target={targets.carbs} unit="g" />
            <MacroBar label="Fat" consumed={totals.fat} target={targets.fat} unit="g" />
          </div>
        </div>
      )}

      <MealLogger />
    </div>
  );
}
