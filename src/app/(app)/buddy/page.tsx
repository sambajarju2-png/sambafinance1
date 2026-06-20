'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ChatView from '@/components/chat/chat-view';
import { useOrgFeatures } from '@/lib/use-org-features';
import FeatureUnavailable from '@/components/feature-unavailable';

function BuddyContent() {
  const searchParams = useSearchParams();
  const continueFrom = searchParams.get('from') || undefined;

  return <ChatView continueFrom={continueFrom} />;
}

export default function BuddyPage() {
  const { features } = useOrgFeatures();
  if (!features.buddy_system) return <FeatureUnavailable />;
  return (
    <div className="-mx-4 -mt-4 flex flex-col" style={{ height: 'calc(100dvh - 56px - 82px)' }}>
      <Suspense fallback={<div className="flex items-center justify-center pt-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-pw-blue border-t-transparent" /></div>}>
        <BuddyContent />
      </Suspense>
    </div>
  );
}
