'use client';

import { useSearchParams } from 'next/navigation';
import ChatView from '@/components/chat/chat-view';

export default function BuddyPage() {
  const searchParams = useSearchParams();
  const continueFrom = searchParams.get('from') || undefined;

  return (
    <div className="-mx-4 -mt-4 flex flex-col" style={{ height: 'calc(100dvh - 56px - 82px)' }}>
      <ChatView continueFrom={continueFrom} />
    </div>
  );
}
