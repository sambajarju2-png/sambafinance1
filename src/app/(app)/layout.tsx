import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import Topbar from '@/components/app-shell/topbar';
import BottomNav from '@/components/app-shell/bottom-nav';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();

  // Auth check (middleware also handles this, but double-check)
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Fetch user settings
  const { data: settings } = await supabase
    .from('user_settings')
    .select('display_name, streak_current, language, onboarding_complete')
    .eq('user_id', user.id)
    .single();

  // Redirect to onboarding if not completed
  if (!settings?.onboarding_complete) {
    redirect('/onboarding');
  }

  const displayName = settings?.display_name || user.email?.split('@')[0] || '';
  const streakCurrent = settings?.streak_current || 0;

  return (
    <div className="flex min-h-dvh flex-col bg-pw-bg">
      {/* Glassmorphism Topbar */}
      <Topbar
        displayName={displayName}
        streakCurrent={streakCurrent}
        notificationCount={0}
      />

      {/* Content Area */}
      <main className="flex-1 px-4 pb-24 pt-4">
        {children}
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
