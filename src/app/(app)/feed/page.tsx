'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  MessageCircle,
  Send,
  Loader2,
  Heart,
  Flag,
  X,
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
}

type FilterKey = 'all' | 'succesverhalen' | 'tips' | 'steun';

const REACTION_BUTTONS = [
  { key: 'heart', emoji: '❤️', label: '' },
  { key: 'goed', emoji: '👏', label: 'Goed gedaan' },
  { key: 'trots', emoji: '💪', label: 'Trots op je' },
  { key: 'top', emoji: '⭐', label: 'Top gedaan' },
];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Alles' },
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

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ display_name: string } | null>(null);
  const [showNamePicker, setShowNamePicker] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [composeOpen, setComposeOpen] = useState(false);

  // Load profile + posts
  useEffect(() => {
    async function load() {
      try {
        const profileRes = await fetch('/api/community/profile');
        if (profileRes.ok) {
          const data = await profileRes.json();
          if (data.profile) {
            setProfile(data.profile);
          } else {
            setShowNamePicker(true);
          }
        }
      } catch {}
    }
    load();
  }, []);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch(`/api/community/posts?filter=${activeFilter}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch {} finally { setLoading(false); }
  }, [activeFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  function handleProfileComplete(name: string) {
    setProfile({ display_name: name });
    setShowNamePicker(false);
  }

  async function handleReaction(postId: string, reactionType: string) {
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const hasReaction = p.user_reactions.includes(reactionType);
        return {
          ...p,
          user_reactions: hasReaction
            ? p.user_reactions.filter((r) => r !== reactionType)
            : [...p.user_reactions, reactionType],
          reaction_counts: {
            ...p.reaction_counts,
            [reactionType]: (p.reaction_counts[reactionType] || 0) + (hasReaction ? -1 : 1),
          },
          total_reactions: p.total_reactions + (hasReaction ? -1 : 1),
        };
      })
    );

    try {
      await fetch('/api/community/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, reaction_type: reactionType }),
      });
    } catch {
      fetchPosts(); // Revert on error
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-heading text-pw-navy">Community</h1>
        <p className="text-[13px] text-pw-muted">Deel ervaringen, steun elkaar</p>
      </div>

      {/* Compose card */}
      {profile && (
        <button
          onClick={() => setComposeOpen(true)}
          className="bill-row-press flex w-full items-center gap-3 rounded-card border border-dashed border-pw-blue/30 bg-pw-blue/5 px-4 py-3 text-left"
        >
          <div className="h-8 w-8 overflow-hidden rounded-full border border-pw-border bg-pw-surface">
            <img
              src={`https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encodeURIComponent(profile.display_name)}`}
              alt=""
              className="h-full w-full"
            />
          </div>
          <span className="flex-1 text-[13px] text-pw-muted">Deel je verhaal...</span>
          <Send className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
        </button>
      )}

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
              activeFilter === f.key
                ? 'bg-pw-navy text-white'
                : 'bg-pw-border/30 text-pw-muted hover:bg-pw-border/50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Posts */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-[120px] rounded-card" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <MessageCircle className="mb-4 h-12 w-12 text-pw-muted/40" strokeWidth={1.5} />
          <h2 className="text-[16px] font-semibold text-pw-text">Nog geen berichten</h2>
          <p className="mt-1 max-w-[280px] text-[13px] text-pw-muted">
            Wees de eerste die iets deelt met de community!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post, index) => (
            <PostCard
              key={post.id}
              post={post}
              index={index}
              onReaction={handleReaction}
            />
          ))}
        </div>
      )}

      {/* Name picker (first time) */}
      {showNamePicker && (
        <CommunityNamePicker
          onComplete={handleProfileComplete}
          onClose={() => setShowNamePicker(false)}
        />
      )}

      {/* Compose drawer */}
      {composeOpen && profile && (
        <ComposeDrawer
          displayName={profile.display_name}
          onClose={() => setComposeOpen(false)}
          onPosted={() => { setComposeOpen(false); fetchPosts(); }}
        />
      )}
    </div>
  );
}

/* Post card */
function PostCard({ post, index, onReaction }: { post: Post; index: number; onReaction: (postId: string, type: string) => void }) {
  const avatarUrl = post.is_anonymous
    ? 'https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=anonymous'
    : `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encodeURIComponent(post.display_name)}`;

  const badge = post.badge_type ? BADGE_LABELS[post.badge_type] : null;
  const timeAgo = getTimeAgo(post.created_at);

  return (
    <div
      className="bill-row-enter rounded-card border border-pw-border bg-pw-surface p-4"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-2.5">
        <div className="h-9 w-9 overflow-hidden rounded-full border border-pw-border bg-pw-bg">
          <img src={avatarUrl} alt="" className="h-full w-full" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-pw-text">{post.display_name}</p>
          <p className="text-[10px] text-pw-muted">{timeAgo}</p>
        </div>
      </div>

      {/* Badge */}
      {badge && (
        <div className={`mb-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${badge.bg}`}>
          <span className="text-[12px]">{badge.icon}</span>
          <span className={`text-[11px] font-semibold ${badge.text}`}>{badge.label}</span>
        </div>
      )}

      {/* Content */}
      <p className="text-[13px] leading-relaxed text-pw-text">{post.content}</p>

      {/* Reactions */}
      <div className="mt-3 flex items-center gap-1.5 border-t border-pw-border pt-2.5">
        {REACTION_BUTTONS.map((rb) => {
          const count = post.reaction_counts[rb.key] || 0;
          const isActive = post.user_reactions.includes(rb.key);

          return (
            <button
              key={rb.key}
              onClick={() => onReaction(post.id, rb.key)}
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] transition-colors ${
                isActive
                  ? 'bg-pw-blue/10 text-pw-blue'
                  : 'bg-pw-bg text-pw-muted hover:bg-pw-border/50'
              }`}
            >
              <span className="text-[13px]">{rb.emoji}</span>
              {count > 0 && <span className="font-semibold">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* Compose drawer */
function ComposeDrawer({ displayName, onClose, onPosted }: { displayName: string; onClose: () => void; onPosted: () => void }) {
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  async function handlePost() {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length < 3) { setError('Minimaal 3 tekens'); return; }

    setPosting(true);
    setError('');

    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed, is_anonymous: isAnonymous }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Er ging iets mis');
        return;
      }

      onPosted();
    } catch {
      setError('Er ging iets mis');
    } finally {
      setPosting(false);
    }
  }

  const avatarUrl = isAnonymous
    ? 'https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=anonymous'
    : `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encodeURIComponent(displayName)}`;

  return (
    <>
      <div className="drawer-backdrop fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div className="drawer-spring fixed bottom-0 left-0 right-0 z-50 rounded-t-[20px] bg-pw-bg shadow-[var(--shadow-drawer)]">
        <div className="flex justify-center pt-3"><div className="h-1 w-10 rounded-full bg-pw-border" /></div>

        <div className="px-5 pb-8 pt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[18px] font-bold text-pw-navy">Deel je verhaal</h2>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/50">
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Author preview */}
          <div className="mb-4 flex items-center gap-3">
            <div className="h-9 w-9 overflow-hidden rounded-full border border-pw-border bg-pw-surface">
              <img src={avatarUrl} alt="" className="h-full w-full" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-pw-text">
                {isAnonymous ? 'Anoniem' : displayName}
              </p>
              <button
                onClick={() => setIsAnonymous(!isAnonymous)}
                className="text-[11px] text-pw-blue"
              >
                {isAnonymous ? 'Post met naam' : 'Post anoniem'}
              </button>
            </div>
          </div>

          {/* Content */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, 500))}
            rows={4}
            placeholder="Waar wil je over praten? Een tip, een succes, of gewoon even stoom afblazen..."
            className="w-full rounded-card border border-pw-border bg-pw-surface px-3.5 py-3 text-[13px] text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
            autoFocus
          />
          <div className="mt-1 flex items-center justify-between">
            <p className="text-[10px] text-pw-muted">{content.length}/500</p>
            {error && <p className="text-[11px] text-pw-red">{error}</p>}
          </div>

          <button
            onClick={handlePost}
            disabled={posting || content.trim().length < 3}
            className="btn-press mt-4 flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {posting && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />}
            {posting ? 'Posten...' : 'Deel met de community'}
          </button>
        </div>
      </div>
    </>
  );
}

/* Relative time helper */
function getTimeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Zojuist';
  if (minutes < 60) return `${minutes}m geleden`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}u geleden`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d geleden`;

  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}
