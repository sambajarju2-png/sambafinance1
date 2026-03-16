'use client';

import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SignOutButton() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="btn-press inline-flex items-center gap-2 rounded-button border border-pw-border bg-pw-surface px-4 py-2 text-label text-pw-muted transition-colors hover:border-pw-red hover:text-pw-red disabled:opacity-50"
    >
      <LogOut className="h-4 w-4" strokeWidth={1.5} />
      {t('signOut')}
    </button>
  );
}
