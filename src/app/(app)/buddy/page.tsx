import ChatView from '@/components/chat/chat-view';

export const metadata = {
  title: 'PayBuddy',
};

export default function BuddyPage() {
  return (
    <div className="-mx-4 -mt-4 flex flex-col" style={{ height: 'calc(100dvh - 56px - 82px)' }}>
      <ChatView />
    </div>
  );
}
