import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import OnboardingWizard from './onboarding-wizard';

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Check if onboarding is already complete
  const { data: settings } = await supabase
    .from('user_settings')
    .select('onboarding_complete, display_name, language')
    .eq('user_id', user.id)
    .single();

  if (settings?.onboarding_complete) {
    redirect('/');
  }

  return (
    <OnboardingWizard
      initialName={settings?.display_name || user.email?.split('@')[0] || ''}
      initialLanguage={(settings?.language as 'nl' | 'en') || 'nl'}
    />
  );
}
