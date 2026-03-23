import { redirect } from 'next/navigation';
import { getAuthUserId } from '@/lib/auth';

export default async function HomePage() {
  const userId = await getAuthUserId();
  if (!userId) {
    redirect('/auth/login');
  }
  redirect('/overzicht');
}
