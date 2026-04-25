import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import Topbar from '@/components/app-shell/topbar';
import BottomNav from '@/components/app-shell/bottom-nav';
import PageTransition from '@/components/page-transition';
import AppTour from '@/components/app-tour';
import FeedbackPopup from '@/components/feedback-popup';
import PushPermissionPrompt from '@/components/push-permission-prompt';
import PwaInstallDrawer from '@/components/pwa/install-prompt';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data: settings } = await supabase
    .from('user_settings')
    .select('language, onboarding_complete')
    .eq('user_id', user.id)
    .single();

  if (!settings?.onboarding_complete) redirect('/onboarding');

  return (
    <div className="flex min-h-dvh flex-col bg-pw-bg">
      <Topbar notificationCount={0} />
      <main className="flex-1 px-4 pb-24 pt-4">
        <PageTransition>{children}</PageTransition>
      </main>
      <BottomNav />
      <AppTour />
      <FeedbackPopup />
      <PwaInstallDrawer />
      <PushPermissionPrompt />
    </div>
  );
}
