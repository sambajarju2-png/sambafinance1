import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import LandingPage from './landing';
import { createClient } from '@supabase/supabase-js';

async function getLandingContent(): Promise<Record<string, string>> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase.from('landing_content').select('key, value');
    const content: Record<string, string> = {};
    for (const row of data || []) content[row.key] = row.value;
    return content;
  } catch {
    return {};
  }
}

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

  const content = await getLandingContent();
  return <LandingPage content={content} />;
}
