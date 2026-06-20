'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  MessageCircle, Send, Loader2, X, ChevronDown, ChevronUp, Trophy,
  MoreHorizontal, Pencil, Trash2, Flag, Megaphone,
} from 'lucide-react';
import CommunityNamePicker from '@/components/community-name-picker';
import CommunityBanOverlay from '@/components/community-ban-overlay';
import ReportDrawer from '@/components/report-drawer';
import { PullToRefresh } from '@/components/pull-to-refresh';
import { useOrgFeatures } from '@/lib/use-org-features';
import FeatureUnavailable from '@/components/feature-unavailable';

interface Post {
  id: string;
  content: string;
  is_anonymous: boolean;
  badge_type: string | null;
  badge_data: Record<string, unknown> | null;
  created_at: string;
  display_name: string;
  user_id: string;
  is_own: boolean;
  reaction_counts: Record<string, number>;
  user_reactions: string[];
  total_reactions: number;
  comment_count: number;
  is_announcement?: boolean;
  author_type?: string;
  org_logo_url?: string | null;
}

interface FlatComment {
  id: string;
  content: string;
  is_anonymous: boolean;
  display_name: string;
  user_id: string;
  is_own: boolean;
  created_at: string;
  author_type?: string;
  org_logo_url?: string | null;
}

type FilterKey = 'all' | 'populair' | 'succesverhalen' | 'tips' | 'steun';

const REACTION_BUTTONS = [
  { key: 'heart', emoji: '❤️' },
  { key: 'goed', emoji: '👏' },
  { key: 'trots', emoji: '💪' },
  { key: 'top', emoji: '⭐' },
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

/* Wrap in Suspense for useSearchParams */
export default function FeedPage() {
  const { features } = useOrgFeatures();
  if (!features.community) return <FeatureUnavailable />;
  return (
    <Suspense fallback={<div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-[120px] rounded-card" />)}</div>}>
      <FeedContent />
    </Suspense>
  );
}

function FeedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const highlightPostId = searchParams.get('post') || null;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ display_name: string; is_banned?: boolean; banned_until?: string | null; ban_reason?: string | null } | null>(null);
  const [showNamePicker, setShowNamePicker] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [groups, setGroups] = useState<{ id: string; name: string; is_default: boolean }[]>([]);
  const [activeGroup, setActiveGroup] = useState<string | null>(() => searchParams.get('group')); // null = global; pre-selected from a deep link
  const [composeOpen, setComposeOpen] = useState(false);
  const [weekLabel, setWeekLabel] = useState('');
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'comment'; id: string; authorName: string; content: string } | null>(null);
  // Clean up ?post= from URL after reading it
  useEffect(() => {
    if (highlightPostId) {
      window.history.replaceState(null, '', '/feed');
    }
  }, [highlightPostId]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/community/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.profile) setProfile(data.profile);
          else setShowNamePicker(true);
        }
      } catch {}
    }
    load();
    fetch('/api/community/groups')
      .then((r) => (r.ok ? r.json() : { groups: [] }))
      .then((d) => setGroups(d.groups || []))
      .catch(() => {});
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/community/posts?filter=${activeFilter}&group=${activeGroup || 'global'}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
        if (data.week_label) setWeekLabel(data.week_label);
      }
    } catch {} finally { setLoading(false); }
  }, [activeFilter, activeGroup]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  function handleProfileComplete(name: string) {
    setProfile({ display_name: name });
    setShowNamePicker(false);
  }

  function handleCommentCountChange(postId: string, delta: number) {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comment_count: p.comment_count + delta } : p));
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

  async function handleDeletePost(postId: string) {
    if (!confirm('Weet je zeker dat je dit bericht wilt verwijderen?')) return;
    try {
      const res = await fetch('/api/community/posts', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId }),
      });
      if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {}
  }

  async function handleEditPost(postId: string, newContent: string) {
    try {
      const res = await fetch('/api/community/posts', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: postId, content: newContent }),
      });
      if (res.ok) {
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, content: newContent } : p));
      }
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-heading text-pw-navy">Community</h1>
        <p className="text-[13px] text-pw-muted">Deel ervaringen, steun elkaar</p>
      </div>

      {profile && !profile.is_banned && (
        <button onClick={() => setComposeOpen(true)}
          className="bill-row-press flex w-full items-center gap-3 rounded-card border border-dashed border-pw-blue/30 bg-pw-blue/5 px-4 py-3 text-left">
          <div className="h-8 w-8 overflow-hidden rounded-full border border-pw-border bg-pw-surface">
            <img src={`https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encodeURIComponent(profile.display_name)}`} alt="" className="h-full w-full" />
          </div>
          <span className="flex-1 text-[13px] text-pw-muted">Deel je verhaal...</span>
          <Send className="h-4 w-4 text-pw-blue" strokeWidth={1.5} />
        </button>
      )}

      {groups.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          <button onClick={() => setActiveGroup(null)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
              activeGroup === null ? 'bg-pw-blue text-white' : 'bg-pw-border/30 text-pw-muted hover:bg-pw-border/50'
            }`}>
            Algemeen
          </button>
          {groups.map((g) => (
            <button key={g.id} onClick={() => setActiveGroup(g.id)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                activeGroup === g.id ? 'bg-pw-blue text-white' : 'bg-pw-border/30 text-pw-muted hover:bg-pw-border/50'
              }`}>
              {g.name}
            </button>
          ))}
        </div>
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

      <PullToRefresh onRefresh={fetchPosts}>
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
              rank={activeFilter === 'populair' ? index + 1 : undefined}
              onCommentCountChange={handleCommentCountChange}
              onDelete={handleDeletePost} onEdit={handleEditPost}
              autoOpenComments={post.id === highlightPostId}
              onReportPost={(id, name, content) => setReportTarget({ type: 'post', id, authorName: name, content })}
              onReportComment={(id, name, content) => setReportTarget({ type: 'comment', id, authorName: name, content })} />
          ))}
        </div>
      )}
      </PullToRefresh>

      {showNamePicker && <CommunityNamePicker onComplete={handleProfileComplete} onClose={() => setShowNamePicker(false)} />}
      {composeOpen && profile && !profile.is_banned && (
        <ComposeDrawer displayName={profile.display_name} groupId={activeGroup} onClose={() => setComposeOpen(false)} onPosted={() => { setComposeOpen(false); fetchPosts(); }} />
      )}

      {/* Ban/timeout overlay */}
      {profile?.is_banned && (
        <div id="ban-overlay">
          <CommunityBanOverlay
            isBanned={true}
            bannedUntil={profile.banned_until || null}
            banReason={profile.ban_reason || null}
          />
        </div>
      )}

      {/* Report drawer */}
      {reportTarget && (
        <ReportDrawer
          type={reportTarget.type}
          targetId={reportTarget.id}
          authorName={reportTarget.authorName}
          contentPreview={reportTarget.content}
          onClose={() => setReportTarget(null)}
          onReported={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}

/* ============ Post Card ============ */
function PostCard({ post, index, onReaction, rank, onCommentCountChange, onDelete, onEdit, autoOpenComments, onReportPost, onReportComment }: {
  post: Post; index: number; onReaction: (id: string, type: string) => void;
  rank?: number; onCommentCountChange: (id: string, delta: number) => void;
  onDelete: (id: string) => void; onEdit: (id: string, content: string) => void;
  autoOpenComments?: boolean;
  onReportPost: (id: string, name: string, content: string) => void;
  onReportComment: (id: string, name: string, content: string) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<FlatComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const avatarUrl = post.author_type === 'org' && post.org_logo_url
    ? post.org_logo_url
    : post.is_anonymous
    ? 'https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=anonymous'
    : `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encodeURIComponent(post.display_name)}`;
  const badge = post.badge_type ? BADGE_LABELS[post.badge_type] : null;

  // Auto-open comments when navigated from notification deep link
  useEffect(() => {
    if (autoOpenComments) {
      loadComments();
      setShowComments(true);
      // Scroll this post into view after a short delay
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenComments]);

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
        onCommentCountChange(post.id, 1);
      } else {
        const data = await res.json();
        alert(data.error || 'Fout bij plaatsen');
      }
    } catch {} finally { setPosting(false); }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      const res = await fetch('/api/community/comments', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: commentId }),
      });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        onCommentCountChange(post.id, -1);
      }
    } catch {}
  }

  async function handleEditComment(commentId: string, newContent: string) {
    try {
      const res = await fetch('/api/community/comments', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: commentId, content: newContent }),
      });
      if (res.ok) {
        setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, content: newContent } : c));
      }
    } catch {}
  }

  function handleSaveEdit() {
    if (editContent.trim().length < 3) return;
    onEdit(post.id, editContent.trim());
    setEditing(false);
    setShowMenu(false);
  }

  return (
    <div
      ref={cardRef}
      className={`bill-row-enter rounded-card border bg-pw-surface p-4 transition-colors ${
        autoOpenComments ? 'border-pw-blue/40 ring-2 ring-pw-blue/20' : 'border-pw-border'
      }`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {post.is_announcement && (
        <div className="mb-2.5 flex items-center gap-1.5 rounded-lg bg-pw-blue/10 px-2.5 py-1.5">
          <Megaphone className="h-3.5 w-3.5 text-pw-blue" strokeWidth={1.5} />
          <span className="text-[11px] font-semibold text-pw-blue">Mededeling van je organisatie</span>
        </div>
      )}
      {rank && (
        <div className="mb-2 flex items-center gap-1.5">
          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white ${
            rank === 1 ? 'bg-pw-amber' : rank === 2 ? 'bg-gray-400' : rank === 3 ? 'bg-amber-700' : 'bg-pw-muted/40'
          }`}>{rank}</div>
          <span className="text-[10px] text-pw-muted">{post.total_reactions + post.comment_count} interacties</span>
        </div>
      )}

      {/* Header with menu */}
      <div className="flex items-center gap-3 mb-2.5">
        <div className="h-9 w-9 overflow-hidden rounded-full border border-pw-border bg-pw-bg">
          <img src={avatarUrl} alt="" className="h-full w-full" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-pw-text">{post.display_name}</p>
          <p className="text-[10px] text-pw-muted">{getTimeAgo(post.created_at)}</p>
        </div>
        {/* Menu — own: edit/delete, others: report */}
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="flex h-7 w-7 items-center justify-center rounded-full text-pw-muted hover:bg-pw-bg">
            <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-8 z-20 w-40 rounded-card border border-pw-border bg-pw-surface py-1 shadow-lg">
                {post.is_own ? (
                  <>
                    <button onClick={() => { setEditing(true); setShowMenu(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-pw-text hover:bg-pw-bg">
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} /> Bewerken
                    </button>
                    <button onClick={() => { onDelete(post.id); setShowMenu(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-pw-red hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} /> Verwijderen
                    </button>
                  </>
                ) : (
                  <button onClick={() => { onReportPost(post.id, post.display_name, post.content); setShowMenu(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-pw-red hover:bg-red-50">
                    <Flag className="h-3.5 w-3.5" strokeWidth={1.5} /> Melden
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {badge && (
        <div className={`mb-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${badge.bg}`}>
          <span className="text-[12px]">{badge.icon}</span>
          <span className={`text-[11px] font-semibold ${badge.text}`}>{badge.label}</span>
        </div>
      )}

      {/* Content or edit mode */}
      {editing ? (
        <div className="mb-2">
          <textarea value={editContent} onChange={(e) => setEditContent(e.target.value.slice(0, 500))} rows={3}
            className="w-full rounded-input border border-pw-blue bg-pw-surface px-3 py-2 text-[13px] text-pw-text focus:outline-none" />
          <div className="mt-1.5 flex gap-2">
            <button onClick={handleSaveEdit} className="rounded-button bg-pw-blue px-3 py-1.5 text-[11px] font-semibold text-white">Opslaan</button>
            <button onClick={() => { setEditing(false); setEditContent(post.content); }} className="text-[11px] text-pw-muted">Annuleren</button>
          </div>
        </div>
      ) : (
        <p className="text-[13px] leading-relaxed text-pw-text"><MentionText text={post.content} /></p>
      )}

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

      {/* Flat comments (Instagram/TikTok style) */}
      {showComments && (
        <div className="mt-3 border-t border-pw-border pt-3">
          {loadingComments ? (
            <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-pw-muted" strokeWidth={1.5} /></div>
          ) : (
            <div className="space-y-3">
              {comments.length === 0 && <p className="text-center text-[12px] text-pw-muted py-2">Nog geen reacties</p>}
              {comments.map((c) => (
                <CommentRow key={c.id} comment={c} onReplyTo={handleReplyTo} onDelete={handleDeleteComment} onEdit={handleEditComment} onReport={(id, name, content) => onReportComment(id, name, content)} />
              ))}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <input ref={inputRef} type="text" value={newComment} onChange={(e) => setNewComment(e.target.value.slice(0, 300))}
              placeholder="Schrijf een reactie..."
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handlePostComment()}
              className="flex-1 rounded-full border border-pw-border bg-pw-bg px-4 py-2 text-[12px] text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none" />
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

/* ============ Single Comment Row ============ */
function CommentRow({ comment, onReplyTo, onDelete, onEdit, onReport }: {
  comment: FlatComment; onReplyTo: (name: string) => void;
  onDelete: (id: string) => void; onEdit: (id: string, content: string) => void;
  onReport: (id: string, name: string, content: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  const cAvatar = comment.author_type === 'org' && comment.org_logo_url
    ? comment.org_logo_url
    : comment.is_anonymous
    ? 'https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=anonymous'
    : `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encodeURIComponent(comment.display_name)}`;

  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 h-7 w-7 flex-shrink-0 overflow-hidden rounded-full border border-pw-border bg-pw-bg">
        <img src={cAvatar} alt="" className="h-full w-full" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] font-bold text-pw-text">{comment.display_name}</span>
          <span className="text-[9px] text-pw-muted">{getTimeAgo(comment.created_at)}</span>
          <div className="relative ml-auto">
            <button onClick={() => setShowMenu(!showMenu)} className="text-pw-muted hover:text-pw-text">
              <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-5 z-20 w-36 rounded-card border border-pw-border bg-pw-surface py-1 shadow-lg">
                  {comment.is_own ? (
                    <>
                      <button onClick={() => { setEditing(true); setShowMenu(false); }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-pw-text hover:bg-pw-bg">
                        <Pencil className="h-3 w-3" strokeWidth={1.5} /> Bewerken
                      </button>
                      <button onClick={() => { onDelete(comment.id); setShowMenu(false); }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-pw-red hover:bg-red-50">
                        <Trash2 className="h-3 w-3" strokeWidth={1.5} /> Verwijderen
                      </button>
                    </>
                  ) : (
                    <button onClick={() => { onReport(comment.id, comment.display_name, comment.content); setShowMenu(false); }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-pw-red hover:bg-red-50">
                      <Flag className="h-3 w-3" strokeWidth={1.5} /> Melden
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        {editing ? (
          <div className="mt-1">
            <input type="text" value={editContent} onChange={(e) => setEditContent(e.target.value.slice(0, 300))}
              className="w-full rounded-input border border-pw-blue bg-pw-surface px-2 py-1 text-[12px] text-pw-text focus:outline-none"
              onKeyDown={(e) => { if (e.key === 'Enter') { onEdit(comment.id, editContent.trim()); setEditing(false); } if (e.key === 'Escape') { setEditing(false); setEditContent(comment.content); } }} />
            <div className="mt-1 flex gap-2">
              <button onClick={() => { onEdit(comment.id, editContent.trim()); setEditing(false); }} className="text-[10px] font-semibold text-pw-blue">Opslaan</button>
              <button onClick={() => { setEditing(false); setEditContent(comment.content); }} className="text-[10px] text-pw-muted">Annuleren</button>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-pw-text leading-relaxed"><MentionText text={comment.content} /></p>
        )}
        <button onClick={() => onReplyTo(comment.display_name)} className="mt-0.5 text-[10px] font-semibold text-pw-muted hover:text-pw-blue">
          Reageer
        </button>
      </div>
    </div>
  );
}

/* ============ @Mention highlighter ============ */
function MentionText({ text }: { text: string }) {
  const parts = text.split(/(@\S+)/g);
  return (<>{parts.map((part, i) => part.startsWith('@') ? <span key={i} className="font-semibold text-pw-blue">{part}</span> : <span key={i}>{part}</span>)}</>);
}

/* ============ Compose Drawer ============ */
function ComposeDrawer({ displayName, groupId, onClose, onPosted }: { displayName: string; groupId: string | null; onClose: () => void; onPosted: () => void }) {
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  async function handlePost() {
    const trimmed = content.trim();
    if (!trimmed || trimmed.length < 3) { setError('Minimaal 3 tekens'); return; }
    setPosting(true); setError('');
    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed, is_anonymous: isAnonymous, badge_type: selectedLabel, group_id: groupId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error === 'daily_limit' ? data.message : (data.error || 'Er ging iets mis'));
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
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-pw-muted hover:bg-pw-border/50"><X className="h-5 w-5" strokeWidth={1.5} /></button>
          </div>

          <div className="mb-4 flex items-center gap-3">
            <div className="h-9 w-9 overflow-hidden rounded-full border border-pw-border bg-pw-surface"><img src={avatarUrl} alt="" className="h-full w-full" /></div>
            <div>
              <p className="text-[13px] font-semibold text-pw-text">{isAnonymous ? 'Anoniem' : displayName}</p>
              <button onClick={() => setIsAnonymous(!isAnonymous)} className="text-[11px] text-pw-blue">{isAnonymous ? 'Post met naam' : 'Post anoniem'}</button>
            </div>
          </div>

          <div className="mb-3">
            <p className="mb-1.5 text-[11px] font-medium text-pw-muted">Label (optioneel)</p>
            <div className="flex flex-wrap gap-1.5">
              {POST_LABELS.map((pl) => (
                <button key={pl.key || 'none'} onClick={() => setSelectedLabel(pl.key)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                    selectedLabel === pl.key ? 'bg-pw-blue text-white' : 'bg-pw-border/30 text-pw-muted hover:bg-pw-border/50'
                  }`}>
                  {pl.icon && <span>{pl.icon}</span>}{pl.label}
                </button>
              ))}
            </div>
          </div>

          <textarea value={content} onChange={(e) => setContent(e.target.value.slice(0, 500))} rows={4}
            placeholder="Waar wil je over praten? Een tip, een succes, of gewoon even stoom afblazen..."
            className="w-full rounded-card border border-pw-border bg-pw-surface px-3.5 py-3 text-[13px] text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue" autoFocus />
          <p className="mt-1 text-[10px] text-pw-muted">{content.length}/500</p>

          {error && (<div className="mt-2 rounded-card border border-pw-amber/20 bg-amber-50/50 p-3"><p className="text-[12px] text-pw-text leading-relaxed">{error}</p></div>)}

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
