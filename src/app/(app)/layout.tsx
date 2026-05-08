import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import Topbar from '@/components/app-shell/topbar';
import BottomNav from '@/components/app-shell/bottom-nav';
import PageTransition from '@/components/page-transition';
import AppTour from '@/components/app-tour';
import FeedbackPopup from '@/components/feedback-popup';
import PushPermissionPrompt from '@/components/push-permission-prompt';
import PwaInstallDrawer from '@/components/pwa/install-prompt';
import RevenueCatInit from '@/components/revenuecat-init';
import PostHogIdentify from '@/components/providers/posthog-identify';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();

  // Use getSession() here — NOT getUser() — because proxy.ts already verified
  // and refreshed the JWT on this request. getSession() reads the cookie locally
  // (no network call), while getUser() would make a redundant HTTP call to
  // Supabase Auth on every single page navigation.
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) redirect('/auth/login');
  const user = session.user;

  const { data: settings } = await supabase
    .from('user_settings')
    .select('language, onboarding_complete, plan, gemeente')
    .eq('user_id', user.id)
    .single();

  if (!settings?.onboarding_complete) redirect('/onboarding');

  // Update last_active_at for B2B coach visibility (fire-and-forget, non-blocking)
  supabase.from('user_settings').update({ last_active_at: new Date().toISOString() }).eq('user_id', user.id).then(() => {});

  return (
    <div className="flex min-h-dvh flex-col bg-pw-bg">
      <Topbar notificationCount={0} />
      <PostHogIdentify userId={user.id} plan={settings?.plan} gemeente={settings?.gemeente} />
      <main className="flex-1 px-4 pb-24 pt-4">
        <PageTransition>{children}</PageTransition>
      </main>
      <BottomNav />
      <AppTour />
      <FeedbackPopup />
      <PwaInstallDrawer />
      <PushPermissionPrompt />
      {/* Initialize RevenueCat SDK on iOS (no-op on web) */}
      <RevenueCatInit userId={user.id} />
    </div>
  );
}
