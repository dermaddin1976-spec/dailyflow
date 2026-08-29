import { getCurrentUser } from '../../../lib/auth.js';
import { ProfileForm, PasswordForm, BodyForm, StravaConnectionCard, AppleHealthCard } from '../settings-forms.js';
import WeightCard from '../weight-card.js';

export default async function SettingsPage({ searchParams }) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const stravaStatus = sp && sp.strava ? sp.strava : null;
  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Settings</h1>
      <ProfileForm user={user} />
      <BodyForm user={user} />
      <WeightCard initialWeightKg={user.weight_kg} />
      <PasswordForm />
      <StravaConnectionCard connected={user.strava_connected} status={stravaStatus} />
      <AppleHealthCard connected={user.apple_health_connected} />
    </div>
  );
}
