import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ensure a connected user is a member of their organisation's default community
 * group. Creates the default group on the fly if the org doesn't have one yet
 * (e.g. an org created after the Phase 7 backfill). Call with a service-role
 * client (RLS is bypassed). Best-effort: never throws.
 */
export async function ensureDefaultGroupMembership(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string
): Promise<void> {
  try {
    let groupId: string | null = null;

    const { data: existing } = await supabase
      .from('community_groups')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_default', true)
      .maybeSingle();
    groupId = existing?.id ?? null;

    if (!groupId) {
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .maybeSingle();
      const { data: created } = await supabase
        .from('community_groups')
        .insert({ organization_id: organizationId, name: org?.name || 'Community', is_default: true })
        .select('id')
        .maybeSingle();
      groupId = created?.id ?? null;
    }

    if (groupId) {
      await supabase
        .from('community_group_members')
        .upsert({ group_id: groupId, user_id: userId, role: 'member' }, { onConflict: 'group_id,user_id' });
    }
  } catch {
    // best-effort — never block activation on community membership
  }
}
