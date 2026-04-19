'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Paperclip, Mic, MicOff, Loader2, Check, Pencil, RotateCcw, ExternalLink, Copy, Clock, Phone, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';

const VoiceCall = dynamic(() => import('./voice-call'), { ssr: false });

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

interface PendingBill {
  vendor: string;
  amount_cents: number;
  due_date?: string;
  iban?: string;
  reference?: string;
  escalation_stage?: string;
  category?: string;
}

const BILL_MARKER = '|||PENDING_BILL|||';

function extractPendingBill(text: string): { cleanText: string; bill: PendingBill | null } {
  const idx = text.indexOf(BILL_MARKER);
  if (idx === -1) return { cleanText: text, bill: null };

  // Everything before the marker is the clean text
  const cleanText = text.slice(0, idx).trim();
  const afterMarker = text.slice(idx + BILL_MARKER.length);

  // Find JSON object — look for { ... } allowing newlines
  const jsonStart = afterMarker.indexOf('{');
  if (jsonStart === -1) return { cleanText, bill: null };

  // Find matching closing brace
  let braceCount = 0;
  let jsonEnd = -1;
  for (let i = jsonStart; i < afterMarker.length; i++) {
    if (afterMarker[i] === '{') braceCount++;
    if (afterMarker[i] === '}') braceCount--;
    if (braceCount === 0) { jsonEnd = i; break; }
  }
  if (jsonEnd === -1) return { cleanText, bill: null };

  try {
    const json = afterMarker.slice(jsonStart, jsonEnd + 1);
    const bill = JSON.parse(json) as PendingBill;
    return { cleanText, bill };
  } catch {
    return { cleanText, bill: null };
  }
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul class="list-disc pl-4 my-1 space-y-0.5">$&</ul>')
    .replace(/\n/g, '<br/>');
}

export default function ChatView({ continueFrom }: { continueFrom?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [chips, setChips] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lang, setLang] = useState('nl');
  const [confirmingBill, setConfirmingBill] = useState(false);
  const [confirmedBills, setConfirmedBills] = useState<Set<string>>(new Set());
  const [failedMessages, setFailedMessages] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showVoiceCall, setShowVoiceCall] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef</* SpeechRecognition */ unknown>(null);

  // Load messages on mount
  useEffect(() => {
    async function load() {
      try {
        // Load settings
        const settingsRes = await fetch('/api/settings');
        if (settingsRes.ok) {
          const s = await settingsRes.json();
          setFirstName(s.first_name || '');
          setLang(s.language || 'nl');
        }

        if (continueFrom) {
          // Loading a specific past conversation
          const histRes = await fetch(`/api/chat/history?all=true`);
          if (histRes.ok) {
            const data = await histRes.json();
            const allMsgs = (data.messages || []) as { id: string; role: string; content: string; created_at: string }[];
            // Find messages in the conversation window (within 60min of continueFrom)
            const fromTime = new Date(continueFrom).getTime();
            const windowMsgs = allMsgs.filter(m => {
              const t = new Date(m.created_at).getTime();
              return t >= fromTime;
            });
            setMessages(windowMsgs.map(m => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content.replace(/\|\|\|BREAK\|\|\|/g, '\n\n'),
              createdAt: new Date(m.created_at),
            })));
            setChips(data.chips || []);
          }
        } else {
          // Fresh start check — auto-clear on new app session
          const isNewSession = !sessionStorage.getItem('pw-chat-session');
          if (isNewSession) {
            sessionStorage.setItem('pw-chat-session', '1');
            // Clear chat for fresh start
            await fetch('/api/chat/history', { method: 'DELETE' });
            // Just load chips
            const histRes = await fetch('/api/chat/history');
            if (histRes.ok) {
              const data = await histRes.json();
              setChips(data.chips || []);
            }
          } else {
            // Continuing current session
            const histRes = await fetch('/api/chat/history');
            if (histRes.ok) {
              const data = await histRes.json();
              setMessages(data.messages?.map((m: { id: string; role: string; content: string; created_at: string }) => ({
                id: m.id,
                role: m.role as 'user' | 'assistant',
                content: m.content.replace(/\|\|\|BREAK\|\|\|/g, '\n\n'),
                createdAt: new Date(m.created_at),
              })) || []);
              setChips(data.chips || []);
            }
          }
        }
      } catch {}
    }
    load();
  }, [continueFrom]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = '24px';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const sendMessage = useCallback(async (text: string, file?: File) => {
    if ((!text.trim() && !file) || isStreaming) return;
    const isNl = lang === 'nl';

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text || (file ? `📎 ${file.name}` : ''),
      createdAt: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', createdAt: new Date() }]);

    try {
      let response: Response;

      if (file) {
        const formData = new FormData();
        formData.append('message', text);
        formData.append('file', file);
        response = await fetch('/api/chat', { method: 'POST', body: formData });
      } else {
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        });
      }

      // Read chips from header
      const chipsHeader = response.headers.get('X-Chat-Chips');
      if (chipsHeader) {
        try { setChips(JSON.parse(chipsHeader)); } catch {}
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Fout' }));
        const errorContent = err.error === 'Rate limited'
          ? (isNl ? 'Even rustig aan! Probeer het over een minuutje opnieuw.' : 'Slow down! Try again in a minute.')
          : (isNl ? 'Er ging iets mis. Tik op Opnieuw om het nog eens te proberen.' : 'Something went wrong. Tap Retry to try again.');
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: errorContent } : m
        ));
        setFailedMessages(prev => new Set(prev).add(assistantId));
        setIsStreaming(false);
        return;
      }

      // Stream the response
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === 'text') {
              fullContent += parsed.text;
              // Strip any stray markers during streaming display
              const displayText = fullContent.replace(/\|\|\|BREAK\|\|\|/g, '\n\n').split('|||PENDING_BILL|||')[0];
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: displayText } : m
              ));
            }
          } catch {}
        }
      }

      // Final content — strip any stray markers
      const cleanFinal = fullContent.replace(/\|\|\|BREAK\|\|\|/g, '\n\n');
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: cleanFinal } : m
      ));
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: isNl ? 'Er ging iets mis. Tik op Opnieuw om het nog eens te proberen.' : 'Something went wrong. Tap Retry to try again.' } : m
      ));
      setFailedMessages(prev => new Set(prev).add(assistantId));
    }

    setIsStreaming(false);
  }, [isStreaming, lang]);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = input.trim();
    sendMessage(text || '', file);
    e.target.value = '';
  }

  function toggleVoice() {
    if (isRecording) {
      (recognitionRef.current as any)?.stop();
      setIsRecording(false);
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (!SR) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new SR() as any;
      recognition.lang = lang === 'nl' ? 'nl-NL' : 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results as ArrayLike<{ 0: { transcript: string } }>)
          .map((r: { 0: { transcript: string } }) => r[0].transcript)
          .join('');
        setInput(transcript);
      };

      recognition.onend = () => setIsRecording(false);
      recognition.onerror = () => setIsRecording(false);

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    } catch {
      // Speech recognition not supported
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const nl = lang === 'nl';
  const isEmpty = messages.length === 0;

  async function newChat() {
    try {
      await fetch('/api/chat/history', { method: 'DELETE' });
    } catch {}
    setMessages([]);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Chat header */}
      {!isEmpty && (
        <div className="flex items-center justify-between border-b border-pw-border/40 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-pw-text dark:text-white">PayBuddy</span>
            <button
              onClick={() => setShowVoiceCall(true)}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-pw-green/10 text-pw-green transition-colors hover:bg-pw-green/20"
              aria-label={nl ? 'Bel PayBuddy' : 'Call PayBuddy'}
            >
              <Phone className="h-3 w-3" strokeWidth={2} />
            </button>
          </div>
        <div className="flex items-center gap-2">
          <a
            href="/buddy/history"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-pw-muted transition-colors hover:bg-pw-border/30 hover:text-pw-text"
          >
            <Clock className="h-3 w-3" strokeWidth={1.5} />
            {nl ? 'Geschiedenis' : 'History'}
          </a>
          <button
            onClick={newChat}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-pw-muted transition-colors hover:bg-pw-border/30 hover:text-pw-text"
          >
            <Plus className="h-3 w-3" strokeWidth={1.5} />
            {nl ? 'Nieuw' : 'New'}
          </button>
        </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {isEmpty ? (
          // Empty state
          <div className="flex flex-col items-center justify-center pt-16">
            {/* Zen visual */}
            <div className="relative mb-8">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-pw-blue/20 to-pw-green/20 blur-xl" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-pw-blue/30 to-pw-green/30" />
              </div>
            </div>

            <p className="text-pw-blue text-base font-medium">
              {nl ? `Hoi${firstName ? ` ${firstName}` : ''}` : `Hi${firstName ? ` ${firstName}` : ''}`}
            </p>
            <p className="mt-1 text-xl font-bold text-pw-text dark:text-white">
              {nl ? 'Hoe kan ik je helpen?' : 'How can I help you?'}
            </p>

            {/* Quick action chips */}
            {chips.length > 0 && (
              <div className="mt-8 grid w-full max-w-sm grid-cols-2 gap-2">
                {chips.map(chip => (
                  <button
                    key={chip}
                    onClick={() => sendMessage(chip)}
                    className="rounded-xl border border-pw-border p-3 text-left text-[13px] font-medium text-pw-text transition-colors hover:bg-pw-border/30 active:scale-[0.97] dark:text-white dark:border-pw-border/50"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {/* Voice call button */}
            <button
              onClick={() => setShowVoiceCall(true)}
              className="mt-4 flex items-center gap-2 rounded-full border border-pw-green/30 bg-pw-green/5 px-5 py-2.5 text-[13px] font-medium text-pw-green transition-colors hover:bg-pw-green/10 active:scale-[0.97]"
            >
              <Phone className="h-4 w-4" strokeWidth={1.5} />
              {nl ? 'Bel PayBuddy' : 'Call PayBuddy'}
            </button>
          </div>
        ) : (
          // Message list
          <>
            {messages.map((msg, idx) => {
              const isLast = idx === messages.length - 1;
              const { cleanText, bill } = msg.role === 'assistant'
                ? extractPendingBill(msg.content)
                : { cleanText: msg.content, bill: null };
              const showButtons = bill && isLast && !isStreaming;

              return (
                <div key={msg.id} className="chat-bubble-enter">
                  <div className={`mb-1 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${
                        msg.role === 'user'
                          ? 'rounded-br-md bg-pw-blue text-white'
                          : 'rounded-bl-md border border-pw-border/60 bg-pw-surface dark:bg-pw-surface/50 text-pw-text dark:text-white'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div
                          className="chat-markdown"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(cleanText) }}
                        />
                      ) : (
                        <span>{msg.content}</span>
                      )}
                      {msg.role === 'assistant' && msg.content === '' && isStreaming && (
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pw-muted [animation-delay:0ms]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pw-muted [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-pw-muted [animation-delay:300ms]" />
                        </span>
                      )}
                    </div>
                    {/* Copy button for assistant messages */}
                    {msg.role === 'assistant' && cleanText && !isStreaming && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(cleanText.replace(/\*\*/g, ''));
                          setCopiedId(msg.id);
                          setTimeout(() => setCopiedId(null), 1500);
                        }}
                        className="ml-1 mb-0.5 flex items-center gap-1 text-[10px] text-pw-muted/50 transition-colors hover:text-pw-muted"
                      >
                        {copiedId === msg.id ? (
                          <><Check className="h-2.5 w-2.5" strokeWidth={2} /> {nl ? 'Gekopieerd' : 'Copied'}</>
                        ) : (
                          <Copy className="h-2.5 w-2.5" strokeWidth={1.5} />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Confirm / Edit buttons */}
                  {showButtons && !confirmedBills.has(msg.id) && (
                    <div className="mb-3 flex gap-2 pl-1">
                      <button
                        onClick={async () => {
                          setConfirmingBill(true);
                          try {
                            const res = await fetch('/api/chat/confirm-bill', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(bill),
                            });
                            const data = await res.json();
                            if (data.success) {
                              setConfirmedBills(prev => new Set(prev).add(msg.id));
                              // Add success message as assistant bubble (no AI call)
                              const successMsg = nl
                                ? `**${bill!.vendor}** is toegevoegd aan je rekeningen (${((bill!.amount_cents || 0) / 100).toFixed(2).replace('.', ',')} euro).`
                                : `**${bill!.vendor}** has been added to your bills (€${((bill!.amount_cents || 0) / 100).toFixed(2)}).`;
                              setMessages(prev => [...prev, {
                                id: Date.now().toString(),
                                role: 'assistant' as const,
                                content: successMsg,
                                createdAt: new Date(),
                              }]);
                            } else {
                              setMessages(prev => [...prev, {
                                id: Date.now().toString(),
                                role: 'assistant' as const,
                                content: nl ? 'Er ging iets mis bij het toevoegen. Probeer het opnieuw.' : 'Something went wrong. Try again.',
                                createdAt: new Date(),
                              }]);
                            }
                          } catch {
                            setMessages(prev => [...prev, {
                              id: Date.now().toString(),
                              role: 'assistant' as const,
                              content: nl ? 'Er ging iets mis bij het toevoegen.' : 'Something went wrong.',
                              createdAt: new Date(),
                            }]);
                          }
                          setConfirmingBill(false);
                        }}
                        disabled={confirmingBill}
                        className="flex items-center gap-1.5 rounded-lg bg-pw-green px-4 py-2 text-[13px] font-semibold text-white transition-all hover:bg-pw-green/90 active:scale-[0.97] disabled:opacity-50"
                      >
                        {confirmingBill ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" strokeWidth={2} />
                        )}
                        {nl ? 'Bevestig' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => sendMessage(nl ? 'Ik wil iets aanpassen' : 'I want to edit something')}
                        disabled={confirmingBill}
                        className="flex items-center gap-1.5 rounded-lg border border-pw-border px-4 py-2 text-[13px] font-medium text-pw-text transition-all hover:bg-pw-border/30 active:scale-[0.97] dark:text-white dark:border-pw-border/50"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                        {nl ? 'Bewerken' : 'Edit'}
                      </button>
                    </div>
                  )}

                  {/* Confirmed badge */}
                  {showButtons && confirmedBills.has(msg.id) && (
                    <div className="mb-3 flex items-center gap-2 pl-1">
                      <span className="flex items-center gap-1 rounded-lg bg-pw-green/10 px-3 py-1.5 text-[12px] font-medium text-pw-green">
                        <Check className="h-3.5 w-3.5" strokeWidth={2} />
                        {nl ? 'Toegevoegd' : 'Added'}
                      </span>
                      <a
                        href="/betalingen"
                        className="flex items-center gap-1 rounded-lg border border-pw-border/60 px-3 py-1.5 text-[12px] font-medium text-pw-blue transition-colors hover:bg-pw-blue/5"
                      >
                        <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                        {nl ? 'Bekijk' : 'View'}
                      </a>
                    </div>
                  )}

                  {/* Retry button for failed messages */}
                  {failedMessages.has(msg.id) && (
                    <div className="mb-3 pl-1">
                      <button
                        onClick={() => {
                          // Find the user message before this failed assistant message
                          const msgIdx = messages.findIndex(m => m.id === msg.id);
                          const userMsg = msgIdx > 0 ? messages[msgIdx - 1] : null;
                          if (userMsg && userMsg.role === 'user') {
                            // Remove failed messages
                            setMessages(prev => prev.filter(m => m.id !== msg.id && m.id !== userMsg.id));
                            setFailedMessages(prev => { const s = new Set(prev); s.delete(msg.id); return s; });
                            // Retry
                            sendMessage(userMsg.content);
                          }
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-pw-amber/50 bg-pw-amber/5 px-3 py-1.5 text-[12px] font-medium text-pw-amber transition-colors hover:bg-pw-amber/10 active:scale-[0.97]"
                      >
                        <RotateCcw className="h-3 w-3" strokeWidth={2} />
                        {nl ? 'Opnieuw proberen' : 'Retry'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Inline chips after last assistant message */}
            {!isStreaming && chips.length > 0 && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !extractPendingBill(messages[messages.length - 1].content).bill && (
              <div className="mb-3 flex flex-wrap gap-1.5 pl-1">
                {chips.slice(0, 3).map(chip => (
                  <button
                    key={chip}
                    onClick={() => sendMessage(chip)}
                    className="rounded-full border border-pw-border/60 px-3 py-1.5 text-[12px] font-medium text-pw-muted transition-colors hover:bg-pw-border/30 hover:text-pw-text active:scale-[0.97] dark:border-pw-border/40"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-pw-border/60 bg-pw-surface px-4 py-3 dark:bg-pw-surface/50">
        <div className="flex items-end gap-2">
          {/* File upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-pw-muted transition-colors hover:bg-pw-border/30 hover:text-pw-text"
            aria-label={nl ? 'Bestand uploaden' : 'Upload file'}
          >
            <Paperclip className="h-5 w-5" strokeWidth={1.5} />
          </button>

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={nl ? 'Typ je vraag...' : 'Type your question...'}
            rows={1}
            className="min-h-[36px] max-h-[120px] flex-1 resize-none rounded-2xl border border-pw-border/60 bg-pw-bg px-4 py-2 text-[14px] text-pw-text outline-none transition-colors placeholder:text-pw-muted focus:border-pw-blue/50 dark:bg-pw-bg/50 dark:text-white"
          />

          {/* Voice */}
          <button
            onClick={toggleVoice}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
              isRecording
                ? 'bg-pw-red/10 text-pw-red'
                : 'text-pw-muted hover:bg-pw-border/30 hover:text-pw-text'
            }`}
            aria-label={isRecording ? 'Stop' : (nl ? 'Spraak' : 'Voice')}
          >
            {isRecording ? <MicOff className="h-5 w-5" strokeWidth={1.5} /> : <Mic className="h-5 w-5" strokeWidth={1.5} />}
          </button>

          {/* Send */}
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pw-blue text-white transition-all hover:bg-pw-blue/90 active:scale-[0.95] disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={nl ? 'Verstuur' : 'Send'}
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            ) : (
              <Send className="h-4 w-4" strokeWidth={2} />
            )}
          </button>
        </div>

        {/* Recording indicator */}
        {isRecording && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-pw-red" />
            <span className="text-[12px] font-medium text-pw-red">
              {nl ? 'Luisteren...' : 'Listening...'}
            </span>
          </div>
        )}
      </div>

      {/* Voice call overlay */}
      {showVoiceCall && (
        <VoiceCall onClose={() => setShowVoiceCall(false)} lang={lang} />
      )}
    </div>
  );
}
