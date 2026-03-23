'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageCircle, Send, Loader2, X, ChevronDown, ChevronUp, Trophy,
} from 'lucide-react';
import CommunityNamePicker from '@/components/community-name-picker';

interface Post {
  id: string;
  content: string;
  is_anonymous: boolean;
  badge_type: string | null;
  badge_data: Record<string, unknown> | null;
  created_at: string;
  display_name: string;
  user_id: string;
  reaction_counts: Record<string, number>;
  user_reactions: string[];
  total_reactions: number;
  comment_count: number;
}

interface FlatComment {
  id: string;
  content: string;
  is_anonymous: boolean;
  display_name: string;
  user_id: string;
  created_at: string;
}

type FilterKey = 'all' | 'populair' | 'succesverhalen' | 'tips' | 'steun';

const REACTION_BUTTONS = [
  { key: 'heart', emoji: '❤️', label: '' },
  { key: 'goed', emoji: '👏', label: 'Goed gedaan' },
  { key: 'trots', emoji: '💪', label: 'Trots op je' },
  { key: 'top', emoji: '⭐', label: 'Top gedaan' },
];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Alles' },
  { key: 'populair', label: 'Populair' },
  { key: 'succesverhalen', label: 'Succesverhalen' },
  { key: 'tips', label: 'Tips' },
  { key: 'steun', label: 'Steun' },
];

const BADGE_LABELS: Record<string, { icon: string; label: string; bg: string; text: string }> = {
  streak: { icon: '🔥', label: 'Streak behaald', bg: 'bg-amber-50', text: 'text-pw-amber' },
  milestone: { icon: '🏆', label: 'Mijlpaal bereikt', bg: 'bg-green-50', text: 'text-pw-green' },
  debt_free: { icon: '🎉', label: 'Schuldenvrij!', bg: 'bg-green-50', text: 'text-pw-green' },
  tip: { icon: '💡', label: 'Tip', bg: 'bg-blue-50', text: 'text-pw-blue' },
};

const POST_LABELS = [
  { key: null, label: 'Geen label', icon: '' },
  { key: 'tip', label: 'Tip', icon: '💡' },
  { key: 'milestone', label: 'Succesverhaal', icon: '🏆' },
  { key: 'streak', label: 'Streak behaald', icon: '🔥' },
  { key: 'debt_free', label: 'Schuldenvrij!', icon: '🎉' },
];

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ display_name: string } | null>(null);
  const [showNamePicker, setShowNamePicker] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [composeOpen, setComposeOpen] = useState(false);
  const [weekLabel, setWeekLabel] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const profileRes = await fetch('/api/community/profile');
        if (profileRes.ok) {
          const data = await profileRes.json();
          if (data.profile) setProfile(data.profile);
          else setShowNamePicker(true);
        }
      } catch {}
    }
    load();
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/community/posts?filter=${activeFilter}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
        if (data.week_label) setWeekLabel(data.week_label);
      }
    } catch {} finally { setLoading(false); }
  }, [activeFilter]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  function handleProfileComplete(name: string) {
    setProfile({ display_name: name });
    setShowNamePicker(false);
  }

  async function handleReaction(postId: string, reactionType: string) {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const has = p.user_reactions.includes(reactionType);
        return {
          ...p,
          user_reactions: has ? p.user_reactions.filter((r) => r !== reactionType) : [...p.user_reactions, reactionType],
          reaction_counts: { ...p.reaction_counts, [reactionType]: (p.reaction_counts[reactionType] || 0) + (has ? -1 : 1) },
          total_reactions: p.total_reactions + (has ? -1 : 1),
        };
      })
    );
    try {
      await fetch('/api/community/reactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, reaction_type: reactionType }),
      });
    } catch { fetchPosts(); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-heading text-pw-navy">Community</h1>
        <p className="text-[13px] text-pw-muted">Deel ervaringen, steun elkaar</p>
      </div>

      {profile && (
        <button onClick={() => setComposeOpen(true)}
          className="bill-row-press flex w-full items-center gap-3 rounded-card border border-dashed border-pw-blue/30 bg-pw-blue/5 px-4 py-3 text-left">
          <div className="h-8 w-8 overflow-hidden rounded-full border border-pw-border bg-pw-surface">
            <img src={`https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encodeURIComponent(profile.display_name)}`} alt="" className="h-full w-full" />
          </div>
          <span className="flex-1 text-[13px] text-pw-muted">Deel je verhaal...</span>
          <Send className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
        </button>
      )}

      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setActiveFilter(f.key)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
              activeFilter === f.key ? 'bg-pw-navy text-white' : 'bg-pw-border/30 text-pw-muted hover:bg-pw-border/50'
            }`}>
            {f.key === 'populair' && '🔥 '}{f.label}
          </button>
        ))}
      </div>

      {activeFilter === 'populair' && weekLabel && (
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-pw-amber" strokeWidth={1.5} />
          <p className="text-[12px] font-semibold text-pw-navy">Top 10 — {weekLabel}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-[120px] rounded-card" />)}</div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <MessageCircle className="mb-4 h-12 w-12 text-pw-muted/40" strokeWidth={1.5} />
          <h2 className="text-[16px] font-semibold text-pw-text">
            {activeFilter === 'populair' ? 'Nog geen populaire posts deze week' : 'Nog geen berichten'}
          </h2>
          <p className="mt-1 max-w-[280px] text-[13px] text-pw-muted">
            {activeFilter === 'populair' ? 'Post iets en verzamel reacties!' : 'Wees de eerste die iets deelt!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post, index) => (
            <PostCard key={post.id} post={post} index={index} onReaction={handleReaction}
              rank={activeFilter === 'populair' ? index + 1 : undefined} onCommentAdded={fetchPosts} />
          ))}
        </div>
      )}

      {showNamePicker && <CommunityNamePicker onComplete={handleProfileComplete} onClose={() => setShowNamePicker(false)} />}
      {composeOpen && profile && (
        <ComposeDrawer displayName={profile.display_name} onClose={() => setComposeOpen(false)} onPosted={() => { setComposeOpen(false); fetchPosts(); }} />
      )}
    </div>
  );
}

/* ============ Post Card with Flat Comments ============ */
function PostCard({ post, index, onReaction, rank, onCommentAdded }: {
  post: Post; index: number; onReaction: (id: string, type: string) => void;
  rank?: number; onCommentAdded: () => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<FlatComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const avatarUrl = post.is_anonymous
    ? 'https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=anonymous'
    : `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encodeURIComponent(post.display_name)}`;

  const badge = post.badge_type ? BADGE_LABELS[post.badge_type] : null;

  async function loadComments() {
    setLoadingComments(true);
    try {
      const res = await fetch(`/api/community/comments?post_id=${post.id}`);
      if (res.ok) { const data = await res.json(); setComments(data.comments || []); }
    } catch {} finally { setLoadingComments(false); }
  }

  function handleToggleComments() {
    if (!showComments) loadComments();
    setShowComments(!showComments);
  }

  function handleReplyTo(displayName: string) {
    setNewComment(`@${displayName} `);
    inputRef.current?.focus();
  }

  async function handlePostComment() {
    const trimmed = newComment.trim();
    if (!trimmed) return;
    setPosting(true);
    try {
      const res = await fetch('/api/community/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id, content: trimmed }),
      });
      if (res.ok) {
        setNewComment('');
        loadComments();
        onCommentAdded();
      } else {
        const data = await res.json();
        alert(data.error || 'Fout bij plaatsen');
      }
    } catch {} finally { setPosting(false); }
  }

  return (
    <div className="bill-row-enter rounded-card border border-pw-border bg-pw-surface p-4" style={{ animationDelay: `${index * 60}ms` }}>
      {/* Rank badge for popular */}
      {rank && (
        <div className="mb-2 flex items-center gap-1.5">
          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white ${
            rank === 1 ? 'bg-pw-amber' : rank === 2 ? 'bg-gray-400' : rank === 3 ? 'bg-amber-700' : 'bg-pw-muted/40'
          }`}>{rank}</div>
          <span className="text-[10px] text-pw-muted">{post.total_reactions + post.comment_count} interacties</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-2.5">
        <div className="h-9 w-9 overflow-hidden rounded-full border border-pw-border bg-pw-bg">
          <img src={avatarUrl} alt="" className="h-full w-full" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-pw-text">{post.display_name}</p>
          <p className="text-[10px] text-pw-muted">{getTimeAgo(post.created_at)}</p>
        </div>
      </div>

      {badge && (
        <div className={`mb-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${badge.bg}`}>
          <span className="text-[12px]">{badge.icon}</span>
          <span className={`text-[11px] font-semibold ${badge.text}`}>{badge.label}</span>
        </div>
      )}

      {/* Content with @mention highlighting */}
      <p className="text-[13px] leading-relaxed text-pw-text">
        <MentionText text={post.content} />
      </p>

      {/* Reactions + Comments toggle */}
      <div className="mt-3 flex items-center justify-between border-t border-pw-border pt-2.5">
        <div className="flex items-center gap-1.5">
          {REACTION_BUTTONS.map((rb) => {
            const count = post.reaction_counts[rb.key] || 0;
            const isActive = post.user_reactions.includes(rb.key);
            return (
              <button key={rb.key} onClick={() => onReaction(post.id, rb.key)}
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] transition-colors ${
                  isActive ? 'bg-pw-blue/10 text-pw-blue' : 'bg-pw-bg text-pw-muted hover:bg-pw-border/50'
                }`}>
                <span className="text-[13px]">{rb.emoji}</span>
                {count > 0 && <span className="font-semibold">{count}</span>}
              </button>
            );
          })}
        </div>
        <button onClick={handleToggleComments}
          className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-pw-muted hover:bg-pw-bg">
          <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
          {post.comment_count > 0 && <span className="font-semibold">{post.comment_count}</span>}
          {showComments ? <ChevronUp className="h-3 w-3" strokeWidth={1.5} /> : <ChevronDown className="h-3 w-3" strokeWidth={1.5} />}
        </button>
      </div>

      {/* Flat comments section (Instagram/TikTok style) */}
      {showComments && (
        <div className="mt-3 border-t border-pw-border pt-3">
          {loadingComments ? (
            <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-pw-muted" strokeWidth={1.5} /></div>
          ) : (
            <div className="space-y-3">
              {comments.length === 0 && <p className="text-center text-[12px] text-pw-muted py-2">Nog geen reacties</p>}
              {comments.map((c) => {
                const cAvatar = c.is_anonymous
                  ? 'https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=anonymous'
                  : `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encodeURIComponent(c.display_name)}`;

                return (
                  <div key={c.id} className="flex items-start gap-2.5">
                    <div className="mt-0.5 h-7 w-7 flex-shrink-0 overflow-hidden rounded-full border border-pw-border bg-pw-bg">
                      <img src={cAvatar} alt="" className="h-full w-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[12px] font-bold text-pw-text">{c.display_name}</span>
                        <span className="text-[9px] text-pw-muted">{getTimeAgo(c.created_at)}</span>
                      </div>
                      <p className="text-[12px] text-pw-text leading-relaxed">
                        <MentionText text={c.content} />
                      </p>
                      <button
                        onClick={() => handleReplyTo(c.display_name)}
                        className="mt-0.5 text-[10px] font-semibold text-pw-muted hover:text-pw-blue"
                      >
                        Reageer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Comment input */}
          <div className="mt-3 flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value.slice(0, 300))}
              placeholder="Schrijf een reactie..."
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handlePostComment()}
              className="flex-1 rounded-full border border-pw-border bg-pw-bg px-4 py-2 text-[12px] text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none"
            />
            <button onClick={handlePostComment} disabled={posting || !newComment.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-pw-blue text-white disabled:opacity-40">
              {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} /> : <Send className="h-3.5 w-3.5" strokeWidth={1.5} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ @Mention highlighter ============ */
function MentionText({ text }: { text: string }) {
  // Split on @username patterns and highlight them blue
  const parts = text.split(/(@\S+)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="font-semibold text-pw-blue">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/* ============ Compose Drawer ============ */
function ComposeDrawer({ displayName, onClose, onPosted }: { displayName: string; onClose: () => void; onPosted: () => void }) {
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  async function handlePost() {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length < 3) { setError('Minimaal 3 tekens'); return; }
    setPosting(true);
    setError('');
    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed, is_anonymous: isAnonymous, badge_type: selectedLabel }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (data.error === 'daily_limit') { setError(data.message); return; }
        setError(data.error || 'Er ging iets mis');
        return;
      }
      onPosted();
    } catch { setError('Er ging iets mis'); } finally { setPosting(false); }
  }

  const avatarUrl = isAnonymous
    ? 'https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=anonymous'
    : `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encodeURIComponent(displayName)}`;

  return (
    <>
      <div className="drawer-backdrop fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="drawer-spring fixed bottom-0 left-0 right-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-[20px] bg-pw-bg shadow-[var(--shadow-drawer)]">
        <div className="flex justify-center pt-3"><div className="h-1 w-10 rounded-full bg-pw-border" /></div>
        <div className="px-5 pb-8 pt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[18px] font-bold text-pw-navy">Deel je verhaal</h2>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/50">
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>

          <div className="mb-4 flex items-center gap-3">
            <div className="h-9 w-9 overflow-hidden rounded-full border border-pw-border bg-pw-surface">
              <img src={avatarUrl} alt="" className="h-full w-full" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-pw-text">{isAnonymous ? 'Anoniem' : displayName}</p>
              <button onClick={() => setIsAnonymous(!isAnonymous)} className="text-[11px] text-pw-blue">
                {isAnonymous ? 'Post met naam' : 'Post anoniem'}
              </button>
            </div>
          </div>

          {/* Label selector */}
          <div className="mb-3">
            <p className="mb-1.5 text-[11px] font-medium text-pw-muted">Label (optioneel)</p>
            <div className="flex flex-wrap gap-1.5">
              {POST_LABELS.map((pl) => (
                <button key={pl.key || 'none'} onClick={() => setSelectedLabel(pl.key)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                    selectedLabel === pl.key ? 'bg-pw-blue text-white' : 'bg-pw-border/30 text-pw-muted hover:bg-pw-border/50'
                  }`}>
                  {pl.icon && <span>{pl.icon}</span>}
                  {pl.label}
                </button>
              ))}
            </div>
          </div>

          <textarea value={content} onChange={(e) => setContent(e.target.value.slice(0, 500))} rows={4}
            placeholder="Waar wil je over praten? Een tip, een succes, of gewoon even stoom afblazen..."
            className="w-full rounded-card border border-pw-border bg-pw-surface px-3.5 py-3 text-[13px] text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
            autoFocus />
          <div className="mt-1 flex items-center justify-between">
            <p className="text-[10px] text-pw-muted">{content.length}/500</p>
          </div>

          {error && (
            <div className="mt-2 rounded-card border border-pw-amber/20 bg-amber-50/50 p-3">
              <p className="text-[12px] text-pw-text leading-relaxed">{error}</p>
            </div>
          )}

          <button onClick={handlePost} disabled={posting || content.trim().length < 3}
            className="btn-press mt-4 flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-50">
            {posting && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />}
            {posting ? 'Posten...' : 'Deel met de community'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ============ Helper ============ */
function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Zojuist';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}u`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}
