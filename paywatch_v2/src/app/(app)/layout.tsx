import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/topbar';
import { BottomNav } from '@/components/layout/bottom-nav';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get display name from user metadata or email
  const displayName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'Gebruiker';

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <Topbar displayName={displayName} streakDays={0} notificationCount={0} />
      <main className="flex-1 px-4 pt-4 pb-safe overflow-y-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
