import { requireUser } from '../../../lib/auth.js';
import { ProfileForm, PasswordForm, BodyForm, StravaConnectionCard, GoogleCalendarCard, AppleHealthCard, NotificationsCard, AdminPasswordResetsCard, AdminUsersCard } from '../settings-forms.js';
import WeightCard from '../weight-card.js';
import { isAdminEmail } from '../../../lib/config.js';

export default async function SettingsPage({ searchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  const stravaStatus = sp && sp.strava ? sp.strava : null;
  const gcalStatus = sp && sp.gcal ? sp.gcal : null;
  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Settings</h1>
      <ProfileForm user={user} />
      <BodyForm user={user} />
      <WeightCard initialWeightKg={user.weight_kg} />
      <PasswordForm />
      <StravaConnectionCard connected={user.strava_connected} status={stravaStatus} />
      <GoogleCalendarCard connected={user.google_calendar_connected} email={user.google_calendar_email} status={gcalStatus} />
      <AppleHealthCard connected={user.apple_health_connected} />
      <NotificationsCard />
      {isAdminEmail(user.email) && <AdminPasswordResetsCard />}
      {isAdminEmail(user.email) && <AdminUsersCard />}
    </div>
  );
}
