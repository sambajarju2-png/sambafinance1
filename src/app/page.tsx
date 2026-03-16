import { redirect } from 'next/navigation';
import { getAuthUserId } from '@/lib/auth';
import AuthenticatedHome from './authenticated-home';

export default async function HomePage() {
  const userId = await getAuthUserId();

  if (!userId) {
    redirect('/auth/login');
  }

  return <AuthenticatedHome />;
}
