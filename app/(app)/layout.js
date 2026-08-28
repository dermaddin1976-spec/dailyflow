import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/auth.js';
import AppChrome from './app-chrome.js';

export default async function AppLayout({ children }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <AppChrome user={user}>{children}</AppChrome>;
}
