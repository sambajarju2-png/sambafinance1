import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Achievement definitions — 11 achievements with Dutch names.
 */
export const ACHIEVEMENTS = [
  { key: 'eerste_betaling', name: 'Eerste Stap', description: 'Je eerste rekening betaald', icon: '🎯' },
  { key: 'vijf_betaald', name: 'Op Dreef', description: '5 rekeningen betaald', icon: '🔥' },
  { key: 'tien_betaald', name: 'Doorzetter', description: '10 rekeningen betaald', icon: '💪' },
  { key: 'streak_3', name: 'Drietal', description: '3 rekeningen op tijd achter elkaar', icon: '⚡' },
  { key: 'streak_5', name: 'Vijfklapper', description: '5 rekeningen op tijd achter elkaar', icon: '🌟' },
  { key: 'streak_10', name: 'Kampioen', description: '10 rekeningen op tijd achter elkaar', icon: '🏆' },
  { key: 'nul_achterstallig', name: 'Schoon Bord', description: 'Geen achterstallige rekeningen', icon: '✨' },
  { key: 'scanner', name: 'Scanner', description: 'Eerste rekening gescand via foto', icon: '📸' },
  { key: 'gmail_koppeling', name: 'Verbonden', description: 'Gmail account gekoppeld', icon: '📧' },
  { key: 'brief_geschreven', name: 'Woordvoerder', description: 'Eerste conceptbrief geschreven', icon: '📝' },
  { key: 'gemeente_ingesteld', name: 'Lokale Held', description: 'Je gemeente ingesteld', icon: '📍' },
] as const;

export type AchievementKey = typeof ACHIEVEMENTS[number]['key'];

/**
 * Check all achievement conditions and unlock any new ones.
 * Called after bill payment and other key actions.
 * SERVER-ONLY.
 */
export async function checkAndUnlockAchievements(userId: string): Promise<string[]> {
  const supabase = await createServerSupabaseClient();
  const unlocked: string[] = [];

  // Get existing achievements
  const { data: existing } = await supabase
    .from('user_achievements')
    .select('achievement')
    .eq('user_id', userId);

  const existingKeys = new Set((existing || []).map((a: { achievement: string }) => a.achievement));

  // Get bill stats
  const { data: bills } = await supabase
    .from('bills')
    .select('status, source, paid_date, due_date')
    .eq('user_id', userId);

  const settledBills = (bills || []).filter((b: { status: string }) => b.status === 'settled');
  const outstandingBills = (bills || []).filter((b: { status: string }) => b.status !== 'settled');
  const today = new Date().toISOString().split('T')[0];
  const overdueBills = outstandingBills.filter((b: { due_date: string }) => b.due_date < today);

  // Get streak
  const { data: settings } = await supabase
    .from('user_settings')
    .select('streak_current, gemeente')
    .eq('user_id', userId)
    .single();

  const streak = settings?.streak_current || 0;

  // Get gmail accounts count
  const { data: gmailAccounts } = await supabase
    .from('gmail_accounts')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  // Check each achievement
  const checks: Array<{ key: string; condition: boolean }> = [
    { key: 'eerste_betaling', condition: settledBills.length >= 1 },
    { key: 'vijf_betaald', condition: settledBills.length >= 5 },
    { key: 'tien_betaald', condition: settledBills.length >= 10 },
    { key: 'streak_3', condition: streak >= 3 },
    { key: 'streak_5', condition: streak >= 5 },
    { key: 'streak_10', condition: streak >= 10 },
    { key: 'nul_achterstallig', condition: overdueBills.length === 0 && (bills || []).length > 0 },
    { key: 'scanner', condition: (bills || []).some((b: { source: string }) => b.source === 'camera_scan') },
    { key: 'gmail_koppeling', condition: (gmailAccounts || []).length > 0 },
    { key: 'gemeente_ingesteld', condition: Boolean(settings?.gemeente) },
  ];

  for (const check of checks) {
    if (check.condition && !existingKeys.has(check.key)) {
      const { error } = await supabase.from('user_achievements').insert({
        user_id: userId,
        achievement: check.key,
        unlocked_at: new Date().toISOString(),
      });
      if (!error) unlocked.push(check.key);
    }
  }

  return unlocked;
}
