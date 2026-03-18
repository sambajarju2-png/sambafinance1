import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * 20 achievements — keys only, names/descriptions come from translation files.
 */
export const ACHIEVEMENTS = [
  { key: 'eerste_betaling', icon: '🎯', category: 'betalingen' },
  { key: 'vijf_betaald', icon: '🔥', category: 'betalingen' },
  { key: 'tien_betaald', icon: '💪', category: 'betalingen' },
  { key: 'twintig_betaald', icon: '👑', category: 'betalingen' },
  { key: 'vijftig_betaald', icon: '🏅', category: 'betalingen' },
  { key: 'streak_3', icon: '⚡', category: 'streak' },
  { key: 'streak_5', icon: '🌟', category: 'streak' },
  { key: 'streak_10', icon: '🏆', category: 'streak' },
  { key: 'streak_20', icon: '🚀', category: 'streak' },
  { key: 'nul_achterstallig', icon: '✨', category: 'gezondheid' },
  { key: 'alle_betaald', icon: '🎉', category: 'gezondheid' },
  { key: 'bespaard_100', icon: '🐷', category: 'gezondheid' },
  { key: 'bespaard_500', icon: '💎', category: 'gezondheid' },
  { key: 'scanner', icon: '📸', category: 'gebruik' },
  { key: 'gmail_koppeling', icon: '📧', category: 'gebruik' },
  { key: 'brief_geschreven', icon: '📝', category: 'gebruik' },
  { key: 'gemeente_ingesteld', icon: '📍', category: 'gebruik' },
  { key: 'donkere_modus', icon: '🌙', category: 'gebruik' },
  { key: 'meldingen_aan', icon: '🔔', category: 'gebruik' },
  { key: 'mood_gelogd', icon: '😊', category: 'gebruik' },
] as const;

export type AchievementKey = typeof ACHIEVEMENTS[number]['key'];

export async function checkAndUnlockAchievements(userId: string): Promise<string[]> {
  const supabase = await createServerSupabaseClient();
  const unlocked: string[] = [];

  const { data: existing } = await supabase.from('user_achievements').select('achievement').eq('user_id', userId);
  const existingKeys = new Set((existing || []).map((a: { achievement: string }) => a.achievement));

  const { data: bills } = await supabase.from('bills').select('status, source, paid_date, due_date, amount').eq('user_id', userId);
  const allBills = bills || [];
  const settledBills = allBills.filter((b: { status: string }) => b.status === 'settled');
  const outstandingBills = allBills.filter((b: { status: string }) => b.status !== 'settled');
  const today = new Date().toISOString().split('T')[0];
  const overdueBills = outstandingBills.filter((b: { due_date: string }) => b.due_date < today);

  const { data: settings } = await supabase.from('user_settings').select('streak_current, gemeente, dark_mode, notify_push_enabled').eq('user_id', userId).single();
  const streak = settings?.streak_current || 0;

  const { data: gmailAccounts } = await supabase.from('gmail_accounts').select('id').eq('user_id', userId).limit(1);
  const { data: moods } = await supabase.from('mood_log').select('id').eq('user_id', userId).limit(1);

  let savedCents = 0;
  for (const bill of settledBills) {
    const b = bill as { paid_date: string; due_date: string; amount: number };
    if (b.paid_date && b.due_date && b.paid_date <= b.due_date) {
      const amount = b.amount / 100;
      let wik = 0;
      if (amount <= 2500) wik = Math.max(40, amount * 0.15);
      else if (amount <= 5000) wik = 375 + (amount - 2500) * 0.10;
      else wik = 625 + (amount - 5000) * 0.05;
      savedCents += Math.round(Math.min(wik, 6775) * 100);
    }
  }

  const checks: Array<{ key: string; condition: boolean }> = [
    { key: 'eerste_betaling', condition: settledBills.length >= 1 },
    { key: 'vijf_betaald', condition: settledBills.length >= 5 },
    { key: 'tien_betaald', condition: settledBills.length >= 10 },
    { key: 'twintig_betaald', condition: settledBills.length >= 20 },
    { key: 'vijftig_betaald', condition: settledBills.length >= 50 },
    { key: 'streak_3', condition: streak >= 3 },
    { key: 'streak_5', condition: streak >= 5 },
    { key: 'streak_10', condition: streak >= 10 },
    { key: 'streak_20', condition: streak >= 20 },
    { key: 'nul_achterstallig', condition: overdueBills.length === 0 && allBills.length > 0 },
    { key: 'alle_betaald', condition: outstandingBills.length === 0 && allBills.length > 0 },
    { key: 'bespaard_100', condition: savedCents >= 10000 },
    { key: 'bespaard_500', condition: savedCents >= 50000 },
    { key: 'scanner', condition: allBills.some((b: { source: string }) => b.source === 'camera_scan') },
    { key: 'gmail_koppeling', condition: (gmailAccounts || []).length > 0 },
    { key: 'gemeente_ingesteld', condition: Boolean(settings?.gemeente) },
    { key: 'donkere_modus', condition: Boolean(settings?.dark_mode) },
    { key: 'meldingen_aan', condition: Boolean(settings?.notify_push_enabled) },
    { key: 'mood_gelogd', condition: (moods || []).length > 0 },
  ];

  for (const check of checks) {
    if (check.condition && !existingKeys.has(check.key)) {
      const { error } = await supabase.from('user_achievements').insert({
        user_id: userId, achievement: check.key, unlocked_at: new Date().toISOString(),
      });
      if (!error) unlocked.push(check.key);
    }
  }

  return unlocked;
}
