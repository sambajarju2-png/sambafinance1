import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import LandingPage from './landing';

export default async function RootPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Logged-in users go straight to dashboard
  if (user) {
    const { data: settings } = await supabase
      .from('user_settings')
      .select('onboarding_complete')
      .eq('user_id', user.id)
      .single();

    if (settings?.onboarding_complete) {
      redirect('/overzicht');
    } else {
      redirect('/onboarding');
    }
  }

  // Anonymous users see the landing page
  return <LandingPage />;
}
