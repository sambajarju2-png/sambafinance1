import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function RootPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: settings } = await supabase
      .from('user_settings')
      .select('onboarding_complete')
      .eq('user_id', user.id)
      .single();

    if (settings?.onboarding_complete) redirect('/overzicht');
    else redirect('/onboarding');
  }

  // Not logged in → login page
  redirect('/auth/login');
}
