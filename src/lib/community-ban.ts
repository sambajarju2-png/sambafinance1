import { createServerSupabaseClient } from '@/lib/supabase/server';

interface BanStatus {
  isBanned: boolean;
  reason?: string;
  until?: string;
}

/**
 * Check if a user is banned from the community.
 * Automatically lifts expired temp bans.
 */
export async function checkCommunityBan(userId: string): Promise<BanStatus> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: profile } = await supabase
      .from('community_profiles')
      .select('is_banned, banned_until, ban_reason')
      .eq('user_id', userId)
      .single();

    if (!profile || !profile.is_banned) {
      return { isBanned: false };
    }

    // Check if temp ban has expired
    if (profile.banned_until) {
      const banEnd = new Date(profile.banned_until);
      if (banEnd < new Date()) {
        // Ban expired — auto-lift
        await supabase
          .from('community_profiles')
          .update({ is_banned: false, banned_until: null, ban_reason: null })
          .eq('user_id', userId);
        return { isBanned: false };
      }
    }

    return {
      isBanned: true,
      reason: profile.ban_reason || undefined,
      until: profile.banned_until || undefined,
    };
  } catch {
    return { isBanned: false };
  }
}
