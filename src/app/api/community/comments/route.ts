import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendPushToUser } from '@/lib/push';
import { checkCommunityBan } from '@/lib/community-ban';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' };

const BLOCKED_WORDS = ['kanker', 'tering', 'tyfus', 'hoer', 'kut', 'fuck', 'shit'];
function containsBlockedWords(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_WORDS.some((w) => lower.includes(w));
}

/**
 * Extract @mentions from text. Returns array of display names.
 * Handles multi-word names by matching against known community profiles.
 */
function extractMentionCandidates(text: string): string[] {
  // Match @word patterns (simple single-word mentions)
  const matches = text.match(/@(\S+)/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1)); // Remove @ prefix
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const postId = req.nextUrl.searchParams.get('post_id');
  if (!postId) return NextResponse.json({ error: 'post_id required' }, { status: 400, headers: NO_CACHE });

  const { data: comments, error } = await supabase
    .from('community_comments')
    .select('*')
    .eq('post_id', postId)
    .eq('is_flagged', false)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });
  if (!comments || comments.length === 0) return NextResponse.json({ comments: [] }, { headers: NO_CACHE });

  const userIds = Array.from(new Set(comments.map((c) => c.user_id)));
  const { data: profiles } = await supabase
    .from('community_profiles')
    .select('user_id, display_name')
    .in('user_id', userIds);

  const profileMap: Record<string, string> = {};
  for (const p of profiles || []) profileMap[p.user_id] = p.display_name;

  // Org-authored comments show the org logo + "{person} van {org}".
  const orgIds = Array.from(new Set(
    comments.filter((c) => c.author_type === 'org' && c.author_org_id).map((c) => c.author_org_id as string)
  ));
  const orgInfoMap: Record<string, { name: string; logo_url: string | null }> = {};
  if (orgIds.length > 0) {
    const { data: orgRows } = await supabase.from('organizations').select('id, name, logo_url').in('id', orgIds);
    for (const o of (orgRows || []) as Array<{ id: string; name: string; logo_url: string | null }>) {
      orgInfoMap[o.id] = { name: o.name, logo_url: o.logo_url };
    }
  }

  const enriched = comments.map((c) => {
    const isOrg = c.author_type === 'org';
    const orgInfo = isOrg ? orgInfoMap[c.author_org_id as string] : undefined;
    const staffName = isOrg ? profileMap[c.user_id] : undefined;
    return {
      id: c.id,
      content: c.content,
      is_anonymous: c.is_anonymous,
      display_name: isOrg
        ? (staffName ? `${staffName} van ${orgInfo?.name || 'de organisatie'}` : (orgInfo?.name || 'Organisatie'))
        : (c.is_anonymous ? 'Anoniem' : (profileMap[c.user_id] || 'Gebruiker')),
      user_id: c.user_id,
      is_own: c.user_id === user.id,
      created_at: c.created_at,
      author_type: (c.author_type as string) || 'user',
      org_logo_url: isOrg ? (orgInfo?.logo_url || null) : null,
    };
  });

  return NextResponse.json({ comments: enriched }, { headers: NO_CACHE });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  // Check if user is banned from community
  const ban = await checkCommunityBan(user.id);
  if (ban.isBanned) {
    const msg = ban.until
      ? `Je bent geblokkeerd tot ${new Date(ban.until).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : 'Je bent geblokkeerd van de community';
    return NextResponse.json({ error: msg }, { status: 403, headers: NO_CACHE });
  }

  const body = await req.json();
  const content = (body.content || '').trim();
  const postId = body.post_id;

  if (!postId) return NextResponse.json({ error: 'post_id required' }, { status: 400, headers: NO_CACHE });
  if (!content || content.length < 1) return NextResponse.json({ error: 'Content too short' }, { status: 400, headers: NO_CACHE });
  if (content.length > 300) return NextResponse.json({ error: 'Content too long (max 300)' }, { status: 400, headers: NO_CACHE });
  if (containsBlockedWords(content)) return NextResponse.json({ error: 'Ongepaste taal gedetecteerd' }, { status: 400, headers: NO_CACHE });

  const { data, error } = await supabase
    .from('community_comments')
    .insert({ post_id: postId, user_id: user.id, content, is_anonymous: body.is_anonymous || false })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });

  // === @Mention detection & push notifications (fire and forget) ===
  processMentions(content, postId, data.id, user.id).catch(() => {});

  return NextResponse.json({ comment: data }, { status: 201, headers: NO_CACHE });
}

/**
 * Process @mentions in a comment:
 * 1. Extract @username candidates
 * 2. Look up matching community profiles
 * 3. Check if mentioned user has community notifications enabled
 * 4. Store notification record
 * 5. Send push notification with deep link
 */
async function processMentions(content: string, postId: string, commentId: string, fromUserId: string) {
  try {
    const candidates = extractMentionCandidates(content);
    if (candidates.length === 0) return;

    const serviceClient = createServiceRoleClient();

    // Get the commenter's display name
    const { data: fromProfile } = await serviceClient
      .from('community_profiles')
      .select('display_name')
      .eq('user_id', fromUserId)
      .single();

    const fromName = fromProfile?.display_name || 'Iemand';

    // Look up all community profiles to match mentions
    // We try exact match on display_name (case-insensitive)
    for (const candidate of candidates) {
      // Try to find profile where display_name matches the candidate
      const { data: profiles } = await serviceClient
        .from('community_profiles')
        .select('user_id, display_name')
        .ilike('display_name', candidate);

      if (!profiles || profiles.length === 0) continue;

      for (const mentioned of profiles) {
        // Don't notify yourself
        if (mentioned.user_id === fromUserId) continue;

        // Check if user has community notifications enabled
        const { data: settings } = await serviceClient
          .from('user_settings')
          .select('notify_community_enabled, notify_push_enabled, language')
          .eq('user_id', mentioned.user_id)
          .single();

        if (settings?.notify_community_enabled === false) continue;

        const isNl = settings?.language !== 'en';
        const preview = content.length > 80 ? content.slice(0, 80) + '...' : content;

        // Store notification record
        await serviceClient.from('community_notifications').insert({
          user_id: mentioned.user_id,
          type: 'mention',
          from_user_id: fromUserId,
          from_display_name: fromName,
          post_id: postId,
          comment_id: commentId,
          content_preview: preview,
          is_read: false,
        });

        // Send push notification
        const title = isNl
          ? `${fromName} heeft je genoemd`
          : `${fromName} mentioned you`;
        const pushBody = isNl
          ? `"${preview}"`
          : `"${preview}"`;

        await sendPushToUser(mentioned.user_id, {
          title,
          body: pushBody,
          tag: `mention-${commentId}`,
          url: `/feed?post=${postId}`,
        });
      }
    }
  } catch (err) {
    console.error('processMentions error:', err);
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const { id, content } = await req.json();
  if (!id || !content?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: NO_CACHE });
  if (containsBlockedWords(content)) return NextResponse.json({ error: 'Ongepaste taal gedetecteerd' }, { status: 400, headers: NO_CACHE });

  const { error } = await supabase.from('community_comments').update({ content: content.trim() }).eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });
  return NextResponse.json({ success: true }, { headers: NO_CACHE });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400, headers: NO_CACHE });

  const { error } = await supabase.from('community_comments').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NO_CACHE });
  return NextResponse.json({ success: true }, { headers: NO_CACHE });
}
