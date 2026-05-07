import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import Topbar from '@/components/app-shell/topbar';
import BottomNav from '@/components/app-shell/bottom-nav';
import PageTransition from '@/components/page-transition';
import dynamic from 'next/dynamic';

// Lazy-load: none of these are needed for the initial paint
const AppTour = dynamic(() => import('@/components/app-tour'), { ssr: false });
const FeedbackPopup = dynamic(() => import('@/components/feedback-popup'), { ssr: false });
const PushPermissionPrompt = dynamic(() => import('@/components/push-permission-prompt'), { ssr: false });
const PwaInstallDrawer = dynamic(() => import('@/components/pwa/install-prompt'), { ssr: false });
const RevenueCatInit = dynamic(() => import('@/components/revenuecat-init'), { ssr: false });

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
    .select('language, onboarding_complete')
    .eq('user_id', user.id)
    .single();

  if (!settings?.onboarding_complete) redirect('/onboarding');

  // Update last_active_at for B2B coach visibility (fire-and-forget, non-blocking)
  supabase.from('user_settings').update({ last_active_at: new Date().toISOString() }).eq('user_id', user.id).then(() => {});

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
      {/* Initialize RevenueCat SDK on iOS (no-op on web) */}
      <RevenueCatInit userId={user.id} />
    </div>
  );
}
