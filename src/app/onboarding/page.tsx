import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
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

  // Language priority: the paywatch-locale cookie (set when a user opens an invite
  // in a given language) wins, so invited users continue onboarding in that language;
  // otherwise fall back to the saved user_settings.language, then Dutch.
  const ONB_LOCALES = ['nl', 'en', 'pl', 'tr'];
  const cookieLang = (await cookies()).get('paywatch-locale')?.value;
  const dbLang = settings?.language as string | undefined;
  const initialLanguage =
    cookieLang && ONB_LOCALES.includes(cookieLang) ? cookieLang
    : dbLang && ONB_LOCALES.includes(dbLang) ? dbLang
    : 'nl';

  return (
    <div className="flex flex-col bg-pw-bg" style={{ height: '100dvh' }}>
      <TrustBadges />
      <div className="flex-1 min-h-0">
        <OnboardingWizard
          initialName={settings?.display_name || user.email?.split('@')[0] || ''}
          initialLanguage={initialLanguage}
        />
      </div>
    </div>
  );
}
