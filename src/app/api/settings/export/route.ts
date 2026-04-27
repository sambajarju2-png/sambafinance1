import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { verifyCsrf } from '@/lib/csrf';
import { log } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    await verifyCsrf();

    const cookieHeader = req.headers.get('cookie');
    const userClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            if (!cookieHeader) return [];
            return cookieHeader.split(';').map(c => {
              const [name, ...rest] = c.trim().split('=');
              return { name, value: rest.join('=') };
            });
          },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all user data across tables — scoped to user.id
    const [
      settings, finances, expenses, bills, bankConnections, transactions,
      gmailAccounts, outlookAccounts, pushTokens, communityPosts,
      paymentPlans, installments, buddies, moodLog, achievements,
    ] = await Promise.all([
      supabase.from('user_settings').select('*').eq('user_id', user.id),
      supabase.from('user_finances').select('*').eq('user_id', user.id),
      supabase.from('user_expenses').select('*').eq('user_id', user.id),
      supabase.from('bills').select('id, vendor, amount, category, status, due_date, escalation_stage, created_at').eq('user_id', user.id),
      supabase.from('bank_connections').select('id, institution_name, status, created_at, access_valid_until').eq('user_id', user.id),
      supabase.from('bank_transactions').select('id, booking_date, amount, currency, creditor_name, debtor_name, pw_category, remittance_info, category_source').eq('user_id', user.id).order('booking_date', { ascending: false }),
      // Exclude tokens from export — they're credentials, not user data
      supabase.from('gmail_accounts').select('id, email, created_at').eq('user_id', user.id),
      supabase.from('outlook_accounts').select('id, email, created_at').eq('user_id', user.id),
      supabase.from('native_push_tokens').select('id, platform, created_at').eq('user_id', user.id),
      supabase.from('community_posts').select('id, content, category, is_anonymous, created_at').eq('user_id', user.id),
      supabase.from('payment_plans').select('*').eq('user_id', user.id),
      supabase.from('plan_installments').select('*').eq('user_id', user.id),
      supabase.from('user_buddies').select('id, role, status, created_at').eq('user_id', user.id),
      supabase.from('mood_log').select('*').eq('user_id', user.id),
      supabase.from('user_achievements').select('achievement_id, unlocked_at').eq('user_id', user.id),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      paywatch_version: '1.0',
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
      settings: settings.data,
      finances: finances.data,
      expenses: expenses.data,
      bills: bills.data,
      bank_connections: bankConnections.data,
      bank_transactions: transactions.data,
      connected_accounts: {
        gmail: gmailAccounts.data,
        outlook: outlookAccounts.data,
      },
      community_posts: communityPosts.data,
      payment_plans: paymentPlans.data,
      plan_installments: installments.data,
      buddies: buddies.data,
      mood_log: moodLog.data,
      achievements: achievements.data,
      devices: pushTokens.data,
    };

    log.info('GDPR data export', { userId: user.id });

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="paywatch-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    log.error('GDPR export error', { error: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'Export mislukt' }, { status: 500 });
  }
}
