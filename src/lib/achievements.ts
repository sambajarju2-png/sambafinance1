import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * 20 achievements with Dutch names, descriptions, and how-to-earn text.
 */
export const ACHIEVEMENTS = [
  // Payment milestones
  { key: 'eerste_betaling', name: 'Eerste Stap', description: 'Je eerste rekening betaald', howTo: 'Markeer je eerste rekening als betaald.', icon: '🎯', category: 'betalingen' },
  { key: 'vijf_betaald', name: 'Op Dreef', description: '5 rekeningen betaald', howTo: 'Betaal in totaal 5 rekeningen.', icon: '🔥', category: 'betalingen' },
  { key: 'tien_betaald', name: 'Doorzetter', description: '10 rekeningen betaald', howTo: 'Betaal in totaal 10 rekeningen.', icon: '💪', category: 'betalingen' },
  { key: 'twintig_betaald', name: 'Meester Betaler', description: '20 rekeningen betaald', howTo: 'Betaal in totaal 20 rekeningen.', icon: '👑', category: 'betalingen' },
  { key: 'vijftig_betaald', name: 'Legende', description: '50 rekeningen betaald', howTo: 'Betaal in totaal 50 rekeningen. Respect!', icon: '🏅', category: 'betalingen' },

  // Streak milestones
  { key: 'streak_3', name: 'Drietal', description: '3 rekeningen op tijd achter elkaar', howTo: 'Betaal 3 rekeningen op tijd achter elkaar (3 dagen grace).', icon: '⚡', category: 'streak' },
  { key: 'streak_5', name: 'Vijfklapper', description: '5 rekeningen op tijd achter elkaar', howTo: 'Betaal 5 rekeningen op tijd achter elkaar.', icon: '🌟', category: 'streak' },
  { key: 'streak_10', name: 'Kampioen', description: '10 rekeningen op tijd achter elkaar', howTo: 'Betaal 10 rekeningen op tijd achter elkaar. Wat een discipline!', icon: '🏆', category: 'streak' },
  { key: 'streak_20', name: 'Onstopbaar', description: '20 rekeningen op tijd achter elkaar', howTo: 'Betaal 20 rekeningen op tijd achter elkaar. Je bent een machine!', icon: '🚀', category: 'streak' },

  // Financial health
  { key: 'nul_achterstallig', name: 'Schoon Bord', description: 'Geen achterstallige rekeningen', howTo: 'Zorg dat je geen achterstallige rekeningen hebt.', icon: '✨', category: 'gezondheid' },
  { key: 'alle_betaald', name: 'Schuldenvrij', description: 'Alle rekeningen betaald', howTo: 'Betaal al je openstaande rekeningen.', icon: '🎉', category: 'gezondheid' },
  { key: 'bespaard_100', name: 'Spaarpot', description: '€100 aan incassokosten bespaard', howTo: 'Bespaar €100 door rekeningen op tijd te betalen.', icon: '🐷', category: 'gezondheid' },
  { key: 'bespaard_500', name: 'Geldwijs', description: '€500 aan incassokosten bespaard', howTo: 'Bespaar €500 door rekeningen op tijd te betalen.', icon: '💎', category: 'gezondheid' },

  // App usage
  { key: 'scanner', name: 'Scanner', description: 'Eerste rekening gescand via foto', howTo: 'Scan een papieren rekening met je camera.', icon: '📸', category: 'gebruik' },
  { key: 'gmail_koppeling', name: 'Verbonden', description: 'Gmail account gekoppeld', howTo: 'Koppel je Gmail account in Instellingen.', icon: '📧', category: 'gebruik' },
  { key: 'brief_geschreven', name: 'Woordvoerder', description: 'Eerste conceptbrief geschreven', howTo: 'Schrijf een conceptbrief via een rekening → Acties → Schrijf concept.', icon: '📝', category: 'gebruik' },
  { key: 'gemeente_ingesteld', name: 'Lokale Held', description: 'Je gemeente ingesteld', howTo: 'Stel je gemeente in via Instellingen → Profiel.', icon: '📍', category: 'gebruik' },
  { key: 'donkere_modus', name: 'Nachtbraker', description: 'Donkere modus ingeschakeld', howTo: 'Schakel donkere modus in via Instellingen → Profiel.', icon: '🌙', category: 'gebruik' },
  { key: 'meldingen_aan', name: 'Op De Hoogte', description: 'Pushmeldingen ingeschakeld', howTo: 'Schakel pushmeldingen in via Instellingen → Meldingen.', icon: '🔔', category: 'gebruik' },
  { key: 'mood_gelogd', name: 'Gevoelsmens', description: 'Eerste stemming gelogd', howTo: 'Log je stemming op het dashboard.', icon: '😊', category: 'gebruik' },
] as const;

export type AchievementKey = typeof ACHIEVEMENTS[number]['key'];

/**
 * Check all achievement conditions and unlock new ones.
 * Returns list of newly unlocked achievement keys.
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
    .select('status, source, paid_date, due_date, amount')
    .eq('user_id', userId);

  const allBills = bills || [];
  const settledBills = allBills.filter((b: { status: string }) => b.status === 'settled');
  const outstandingBills = allBills.filter((b: { status: string }) => b.status !== 'settled');
  const today = new Date().toISOString().split('T')[0];
  const overdueBills = outstandingBills.filter((b: { due_date: string }) => b.due_date < today);

  // Get user settings
  const { data: settings } = await supabase
    .from('user_settings')
    .select('streak_current, gemeente, dark_mode, notify_push_enabled')
    .eq('user_id', userId)
    .single();

  const streak = settings?.streak_current || 0;

  // Get gmail accounts
  const { data: gmailAccounts } = await supabase
    .from('gmail_accounts')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  // Get mood logs
  const { data: moods } = await supabase
    .from('mood_log')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  // Calculate savings (WIK costs avoided)
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

  // Check conditions
  const checks: Array<{ key: string; condition: boolean }> = [
    // Payment
    { key: 'eerste_betaling', condition: settledBills.length >= 1 },
    { key: 'vijf_betaald', condition: settledBills.length >= 5 },
    { key: 'tien_betaald', condition: settledBills.length >= 10 },
    { key: 'twintig_betaald', condition: settledBills.length >= 20 },
    { key: 'vijftig_betaald', condition: settledBills.length >= 50 },
    // Streak
    { key: 'streak_3', condition: streak >= 3 },
    { key: 'streak_5', condition: streak >= 5 },
    { key: 'streak_10', condition: streak >= 10 },
    { key: 'streak_20', condition: streak >= 20 },
    // Health
    { key: 'nul_achterstallig', condition: overdueBills.length === 0 && allBills.length > 0 },
    { key: 'alle_betaald', condition: outstandingBills.length === 0 && allBills.length > 0 },
    { key: 'bespaard_100', condition: savedCents >= 10000 },
    { key: 'bespaard_500', condition: savedCents >= 50000 },
    // Usage
    { key: 'scanner', condition: allBills.some((b: { source: string }) => b.source === 'camera_scan') },
    { key: 'gmail_koppeling', condition: (gmailAccounts || []).length > 0 },
    { key: 'gemeente_ingesteld', condition: Boolean(settings?.gemeente) },
    { key: 'donkere_modus', condition: Boolean(settings?.dark_mode) },
    { key: 'meldingen_aan', condition: Boolean(settings?.notify_push_enabled) },
    { key: 'mood_gelogd', condition: (moods || []).length > 0 },
  ];

  // brief_geschreven is checked separately (not easy to detect from here)

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
