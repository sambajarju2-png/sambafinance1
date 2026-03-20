import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import OnboardingWizard from './wizard';
import TrustBadges from '@/components/trust-badges';

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: settings } = await supabase
    .from('user_settings')
    .select('onboarding_complete, display_name, language')
    .eq('user_id', user.id)
    .single();

  // If no settings row exists, create one (edge case: trigger didn't fire)
  if (!settings) {
    await supabase.from('user_settings').upsert({
      user_id: user.id,
      display_name: user.email?.split('@')[0] || '',
      language: 'nl',
      onboarding_complete: false,
    }, { onConflict: 'user_id' });
  }

  if (settings?.onboarding_complete) redirect('/overzicht');

  return (
    <div className="flex min-h-dvh flex-col bg-pw-bg">
      <TrustBadges />
      <div className="flex-1">
        <OnboardingWizard
          initialName={settings?.display_name || user.email?.split('@')[0] || ''}
          initialLanguage={(settings?.language as 'nl' | 'en') || 'nl'}
        />
      </div>
    </div>
  );
}
