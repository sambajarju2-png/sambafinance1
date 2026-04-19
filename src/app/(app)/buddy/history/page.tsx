'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, MessageCircle, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface Conversation {
  date: string;
  dateLabel: string;
  messages: Message[];
  preview: string;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\|\|\|BREAK\|\|\|/g, '\n\n')
    .replace(/\|\|\|PENDING_BILL\|\|\|[\s\S]*$/g, '')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

function groupIntoConversations(messages: Message[], lang: string): Conversation[] {
  if (!messages.length) return [];

  const nl = lang === 'nl';
  const convos: Conversation[] = [];
  let current: Message[] = [messages[0]];

  for (let i = 1; i < messages.length; i++) {
    const prev = new Date(messages[i - 1].created_at);
    const curr = new Date(messages[i].created_at);
    const gapMinutes = (curr.getTime() - prev.getTime()) / (1000 * 60);

    if (gapMinutes > 60) {
      // New conversation
      convos.push(buildConvo(current, nl));
      current = [messages[i]];
    } else {
      current.push(messages[i]);
    }
  }
  convos.push(buildConvo(current, nl));

  return convos.reverse(); // Most recent first
}

function buildConvo(msgs: Message[], nl: boolean): Conversation {
  const first = new Date(msgs[0].created_at);
  const userMsg = msgs.find(m => m.role === 'user');
  const preview = userMsg
    ? userMsg.content.slice(0, 80) + (userMsg.content.length > 80 ? '...' : '')
    : msgs[0].content.slice(0, 80);

  const today = new Date();
  const isToday = first.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = first.toDateString() === yesterday.toDateString();

  let dateLabel: string;
  if (isToday) {
    dateLabel = nl ? 'Vandaag' : 'Today';
  } else if (isYesterday) {
    dateLabel = nl ? 'Gisteren' : 'Yesterday';
  } else {
    dateLabel = first.toLocaleDateString(nl ? 'nl-NL' : 'en-US', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
  }

  const timeStr = first.toLocaleTimeString(nl ? 'nl-NL' : 'en-US', { hour: '2-digit', minute: '2-digit' });

  return {
    date: first.toISOString(),
    dateLabel: `${dateLabel}, ${timeStr}`,
    messages: msgs,
    preview,
  };
}

export default function ChatHistoryPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState('nl');

  useEffect(() => {
    async function load() {
      try {
        const [settingsRes, histRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/chat/history?all=true'),
        ]);
        if (settingsRes.ok) {
          const s = await settingsRes.json();
          setLang(s.language || 'nl');
        }
        if (histRes.ok) {
          const data = await histRes.json();
          const convos = groupIntoConversations(data.messages || [], lang);
          setConversations(convos);
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const nl = lang === 'nl';

  return (
    <div className="-mx-4 -mt-4 flex flex-col" style={{ height: 'calc(100dvh - 56px - 82px)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-pw-border/40 px-4 py-3">
        <button onClick={() => router.push('/buddy')} className="text-pw-muted hover:text-pw-text">
          <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <span className="text-[15px] font-semibold text-pw-text dark:text-white">
          {nl ? 'Chatgeschiedenis' : 'Chat History'}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center pt-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-pw-blue border-t-transparent" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-center px-8">
            <MessageCircle className="h-12 w-12 text-pw-muted/30 mb-4" strokeWidth={1} />
            <p className="text-[15px] font-medium text-pw-muted">
              {nl ? 'Nog geen gesprekken' : 'No conversations yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-pw-border/40">
            {conversations.map((convo, idx) => (
              <div key={convo.date}>
                {/* Conversation header — tap to expand */}
                <button
                  onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-pw-border/10 active:bg-pw-border/20"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pw-blue/10">
                    <MessageCircle className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-pw-text dark:text-white truncate">
                      {convo.preview}
                    </p>
                    <p className="text-[11px] text-pw-muted mt-0.5">
                      {convo.dateLabel} - {convo.messages.length} {nl ? 'berichten' : 'messages'}
                    </p>
                  </div>
                </button>

                {/* Expanded messages */}
                {expandedIdx === idx && (
                  <div className="bg-pw-bg/50 px-4 py-3 border-t border-pw-border/20">
                    {convo.messages.map(msg => (
                      <div key={msg.id} className={`mb-2 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                            msg.role === 'user'
                              ? 'rounded-br-md bg-pw-blue text-white'
                              : 'rounded-bl-md border border-pw-border/60 bg-pw-surface dark:bg-pw-surface/50 text-pw-text dark:text-white'
                          }`}
                        >
                          {msg.role === 'assistant' ? (
                            <div className="chat-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                          ) : (
                            <span>{msg.content}</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {/* Continue button */}
                    <a
                      href={`/buddy?from=${encodeURIComponent(convo.messages[0].created_at)}`}
                      className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-pw-blue/30 bg-pw-blue/5 px-4 py-2 text-[12px] font-medium text-pw-blue transition-colors hover:bg-pw-blue/10 active:scale-[0.97]"
                    >
                      <ArrowRight className="h-3 w-3" strokeWidth={2} />
                      {nl ? 'Doorgaan met dit gesprek' : 'Continue this conversation'}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
