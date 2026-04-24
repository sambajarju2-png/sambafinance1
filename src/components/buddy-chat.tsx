'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, ChevronLeft, Loader2, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Conversation {
  buddy_link_id: string;
  buddy_user_id: string;
  buddy_name: string;
  role: string;
  last_message: { content: string; is_mine: boolean; created_at: string } | null;
  unread: number;
  accepted_at: string;
}

interface Message {
  id: string;
  buddy_link_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface BuddyChatProps {
  onClose: () => void;
}

export default function BuddyChat({ onClose }: BuddyChatProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch current user ID
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/buddy/messages');
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (err) {
      console.error('Failed to load buddy conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  async function openConversation(convo: Conversation) {
    setActiveConvo(convo);
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/buddy/messages?buddy_link_id=${convo.buddy_link_id}`);
      const data = await res.json();
      setMessages(data.messages || []);
      // Clear unread count locally
      setConversations(prev => prev.map(c =>
        c.buddy_link_id === convo.buddy_link_id ? { ...c, unread: 0 } : c
      ));
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Poll for new messages every 10s when in a conversation
  useEffect(() => {
    if (!activeConvo) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/buddy/messages?buddy_link_id=${activeConvo.buddy_link_id}`);
        const data = await res.json();
        if (data.messages?.length !== messages.length) {
          setMessages(data.messages || []);
        }
      } catch { /* silent */ }
    }, 10000);
    return () => clearInterval(interval);
  }, [activeConvo, messages.length]);

  async function handleSend() {
    if (!input.trim() || !activeConvo || sending || !currentUserId) return;
    const content = input.trim();
    setInput('');
    setSending(true);

    // Optimistic: add message locally
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      buddy_link_id: activeConvo.buddy_link_id,
      sender_id: currentUserId!,
      content,
      is_read: true,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const res = await fetch('/api/buddy/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buddy_link_id: activeConvo.buddy_link_id, content })
      });
      const data = await res.json();
      if (data.message) {
        // Replace optimistic message with real one
        setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? data.message : m));
      }
    } catch {
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setInput(content); // Restore input
    } finally {
      setSending(false);
    }
  }

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);

  // ─── Chat View (active conversation) ───────────────────────
  if (activeConvo) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-pw-bg dark:bg-pw-navy">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-pw-border/40 px-4 py-3">
          <button
            onClick={() => { setActiveConvo(null); fetchConversations(); }}
            className="rounded-lg p-1.5 hover:bg-pw-border/30"
          >
            <ChevronLeft className="h-5 w-5 text-pw-text dark:text-white" strokeWidth={1.5} />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pw-blue/10">
            <User className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-pw-navy dark:text-white">{activeConvo.buddy_name}</h3>
            <p className="text-[11px] text-pw-muted capitalize">{activeConvo.role}</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2">
          {loadingMessages ? (
            <div className="flex items-center justify-center py-8 gap-2 text-pw-muted">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
              <span className="text-[13px]">Berichten laden...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="h-8 w-8 text-pw-muted/30 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-[13px] text-pw-muted">Nog geen berichten</p>
              <p className="text-[11px] text-pw-muted mt-1">Stuur je buddy een berichtje</p>
            </div>
          ) : (
            messages.map(msg => {
              const isMine = msg.sender_id === currentUserId;
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                    isMine
                      ? 'bg-pw-blue text-white rounded-br-md'
                      : 'bg-pw-bg text-pw-text rounded-bl-md'
                  }`}>
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-[10px] mt-1 ${isMine ? 'text-white/60' : 'text-pw-muted'}`}>
                      {new Date(msg.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 pt-3 border-t border-pw-border">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Typ een bericht..."
            className="flex-1 rounded-xl border border-pw-border bg-white px-4 py-2.5 text-[13px] text-pw-text placeholder:text-pw-muted focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
            autoFocus
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="btn-press flex h-10 w-10 items-center justify-center rounded-xl bg-pw-blue text-white disabled:opacity-40 transition-opacity"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <Send className="h-4 w-4" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>
    );
  }

  // ─── Conversation List ─────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-pw-bg dark:bg-pw-navy">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-pw-border/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-pw-border/30">
            <ChevronLeft className="h-5 w-5 text-pw-text dark:text-white" strokeWidth={1.5} />
          </button>
          <h2 className="text-[15px] font-semibold text-pw-text dark:text-white">Buddy Berichten</h2>
        </div>
        {totalUnread > 0 && (
          <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-pw-blue px-1.5 text-[10px] font-bold text-white">
            {totalUnread}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-pw-muted">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
          <span className="text-[13px]">Gesprekken laden...</span>
        </div>
      ) : conversations.length === 0 ? (
        <div className="rounded-card border border-pw-border bg-pw-surface p-6 text-center">
          <MessageCircle className="h-8 w-8 text-pw-muted/30 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-[13px] text-pw-muted">Nog geen buddy gesprekken</p>
          <p className="text-[11px] text-pw-muted mt-1">Nodig een buddy uit via Instellingen → Buddy</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {conversations.map(convo => (
            <button
              key={convo.buddy_link_id}
              onClick={() => openConversation(convo)}
              className="btn-press flex w-full items-center gap-3 rounded-card border border-pw-border bg-pw-surface p-3 text-left transition-colors hover:bg-pw-bg"
            >
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pw-blue/10">
                <User className="h-5 w-5 text-pw-blue" strokeWidth={1.5} />
                {convo.unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-pw-blue text-[9px] font-bold text-white px-1">
                    {convo.unread}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-[13px] font-semibold text-pw-navy truncate">{convo.buddy_name}</h4>
                  {convo.last_message && (
                    <span className="text-[10px] text-pw-muted shrink-0 ml-2">
                      {formatTimeAgo(convo.last_message.created_at)}
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-pw-muted truncate mt-0.5">
                  {convo.last_message
                    ? `${convo.last_message.is_mine ? 'Jij: ' : ''}${convo.last_message.content}`
                    : 'Stuur een berichtje'
                  }
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'nu';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}
