import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const ADMIN_EMAILS = ['sambajarju2@gmail.com'];

/**
 * POST /api/admin/test-data
 * Admin-only: insert test notifications and/or dummy bank transactions
 * Body: { type: 'notifications' | 'bank' | 'both' }
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const supabase = await createServerSupabaseClient();

  // Check admin
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.email || !ADMIN_EMAILS.includes(user.user.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403, headers: NO_CACHE });
  }

  const { type = 'both' } = await req.json().catch(() => ({ type: 'both' }));
  const results: Record<string, string> = {};

  // ── INSERT TEST NOTIFICATIONS ──
  if (type === 'notifications' || type === 'both') {
    const notifications = [
      {
        user_id: userId,
        type: 'overdue',
        title: 'Rekening verlopen',
        body: 'Je rekening van KPN (€400,00) is verlopen. Betaal snel om extra kosten te voorkomen.',
        data: { bill_id: 'demo', vendor: 'KPN', amount: 40000 },
        is_read: false,
      },
      {
        user_id: userId,
        type: 'upcoming',
        title: 'Rekening bijna verlopen',
        body: 'Je rekening van Eneco (€236,00) vervalt over 2 dagen.',
        data: { bill_id: 'demo', vendor: 'Eneco', amount: 23600, days: 2 },
        is_read: false,
      },
      {
        user_id: userId,
        type: 'achievement',
        title: 'Badge ontgrendeld!',
        body: 'Je hebt de badge "Eerste Scan" verdiend. Bekijk je prestaties.',
        data: { badge: 'first_scan' },
        is_read: false,
      },
      {
        user_id: userId,
        type: 'upcoming',
        title: 'Escalatierisico',
        body: 'Je rekening van Hiltermann Lease (€194,74) staat op "actie vereist". Voorkom een aanmaning.',
        data: { bill_id: 'demo', vendor: 'Hiltermann Lease', amount: 19474, stage: 'herinnering' },
        is_read: false,
      },
    ];

    const { error } = await supabase.from('notifications').insert(notifications);
    results.notifications = error ? `Error: ${error.message}` : `${notifications.length} notifications inserted`;
  }

  // ── INSERT DUMMY BANK TRANSACTIONS ──
  if (type === 'bank' || type === 'both') {
    // Create/find demo bank connection (connection_id is NOT NULL)
    const demoConnId = '00000000-0000-0000-0000-000000000001';
    await supabase.from('bank_connections').upsert({
      id: demoConnId,
      user_id: userId,
      institution_id: 'DEMO_BANK',
      institution_name: 'Demo ABN AMRO',
      requisition_id: 'demo-req-001',
      status: 'linked',
    }, { onConflict: 'id' });

    // Get user's actual bills for realistic matching
    const { data: bills } = await supabase
      .from('bills')
      .select('id, vendor, amount, iban, due_date, category')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(6);

    const today = new Date();
    const transactions = [
      // Matching transactions (same vendor/amount as real bills)
      ...(bills || []).slice(0, 4).map((bill, i) => ({
        user_id: userId,
        connection_id: demoConnId,
        account_id: 'demo-account',
        transaction_id: `demo-tx-${Date.now()}-${i}`,
        booking_date: new Date(today.getTime() - (i + 1) * 86400000).toISOString().split('T')[0],
        value_date: new Date(today.getTime() - (i + 1) * 86400000).toISOString().split('T')[0],
        amount: -bill.amount,
        currency: 'EUR',
        creditor_name: bill.vendor,
        debtor_name: null,
        creditor_iban: bill.iban || null,
        debtor_iban: 'NL91ABNA0417164300',
        remittance_info: `Betaling ${bill.vendor}`,
        bank_category: null,
        pw_category: bill.category,
        matched_bill_id: bill.id,
        is_recurring: false,
        match_status: 'pending',
        raw_data: { source: 'demo' },
      })),
      // Unmatched transactions (no bill match)
      {
        user_id: userId,
        connection_id: demoConnId,
        account_id: 'demo-account',
        transaction_id: `demo-tx-${Date.now()}-unmatched-1`,
        booking_date: new Date(today.getTime() - 2 * 86400000).toISOString().split('T')[0],
        value_date: new Date(today.getTime() - 2 * 86400000).toISOString().split('T')[0],
        amount: -4599,
        currency: 'EUR',
        creditor_name: 'Albert Heijn',
        debtor_name: null,
        creditor_iban: null,
        debtor_iban: 'NL91ABNA0417164300',
        remittance_info: 'Boodschappen AH Coolsingel',
        bank_category: 'groceries',
        pw_category: null,
        matched_bill_id: null,
        is_recurring: false,
        match_status: 'unmatched',
        raw_data: { source: 'demo' },
      },
      {
        user_id: userId,
        connection_id: demoConnId,
        account_id: 'demo-account',
        transaction_id: `demo-tx-${Date.now()}-unmatched-2`,
        booking_date: new Date(today.getTime() - 5 * 86400000).toISOString().split('T')[0],
        value_date: new Date(today.getTime() - 5 * 86400000).toISOString().split('T')[0],
        amount: -1250,
        currency: 'EUR',
        creditor_name: 'Shell Tankstation',
        debtor_name: null,
        creditor_iban: null,
        debtor_iban: 'NL91ABNA0417164300',
        remittance_info: 'Tankbeurt Shell A13',
        bank_category: 'transport',
        pw_category: null,
        matched_bill_id: null,
        is_recurring: false,
        match_status: 'unmatched',
        raw_data: { source: 'demo' },
      },
    ];

    const { error } = await supabase.from('bank_transactions').insert(transactions);
    results.bank = error ? `Error: ${error.message}` : `${transactions.length} transactions inserted`;
  }

  return NextResponse.json({ success: true, results }, { headers: NO_CACHE });
}

/**
 * DELETE /api/admin/test-data
 * Clean up demo data
 */
export async function DELETE() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const supabase = await createServerSupabaseClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user?.email || !ADMIN_EMAILS.includes(user.user.email)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403, headers: NO_CACHE });
  }

  await supabase.from('bank_transactions').delete().eq('user_id', userId).like('transaction_id', 'demo-tx-%');
  await supabase.from('notifications').delete().eq('user_id', userId).like('title', '%demo%');

  return NextResponse.json({ success: true, message: 'Demo data cleaned up' }, { headers: NO_CACHE });
}
