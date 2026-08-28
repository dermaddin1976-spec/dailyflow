import Link from 'next/link';
import { getCurrentUser } from '../../../../lib/auth.js';
import { computeTargets, hasBodyProfile } from '../../../../lib/nutrition.js';
import MealPlanner from '../../meal-planner.js';

export default async function MealPlannerPage({ searchParams }) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const openId = sp && sp.open ? Number(sp.open) : null;

  if (!hasBodyProfile(user)) {
    return (
      <div>
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>Meal planner</h1>
        <div className="card" style={{ textAlign: 'center', padding: '36px 28px' }}>
          <h3 style={{ marginBottom: 8 }}>Set up your daily targets first</h3>
          <p style={{ color: 'var(--text-2)', fontSize: 13.5, maxWidth: 380, margin: '0 auto 18px' }}>
            The planner builds meals around your daily calorie and macro targets, so add your age, weight, height,
            sex and activity level in Settings first.
          </p>
          <Link href="/settings" className="btn">Go to Settings</Link>
        </div>
      </div>
    );
  }

  const targets = computeTargets(user);

  return (
    <div>
      <p style={{ marginBottom: 20 }}><Link href="/nutrition">&larr; Back to Nutrition</Link></p>
      <MealPlanner targets={targets} initialPlanId={openId} />
    </div>
  );
}
