// Accounts allowed to see the admin tools in Settings (currently just
// password-reset assistance for friends, since there's no way to send
// email from the app yet). Edit this list directly to add or remove admins.
export const ADMIN_EMAILS = ['dermaddin1976@gmail.com'];

export function isAdminEmail(email) {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}
