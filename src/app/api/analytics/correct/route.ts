import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
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

    const body = await req.json();
    const { transaction_id, category, sub_category, apply_to_all } = body;

    if (!transaction_id || !category) {
      return NextResponse.json({ error: 'transaction_id en category zijn verplicht' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Get the transaction to find creditor_name
    const { data: tx } = await supabase
      .from('bank_transactions')
      .select('id, creditor_name, debtor_name, user_id')
      .eq('id', transaction_id)
      .eq('user_id', user.id)
      .single();

    if (!tx) {
      return NextResponse.json({ error: 'Transactie niet gevonden' }, { status: 404 });
    }

    const creditorName = tx.creditor_name || tx.debtor_name;

    // 2. Update the specific transaction
    await supabase
      .from('bank_transactions')
      .update({
        pw_category: category,
        pw_sub_category: sub_category || null,
        category_source: 'user',
        category_confidence: 1.0,
      })
      .eq('id', transaction_id);

    // 3. Create/update user-specific rule in category_rules
    if (creditorName && creditorName.length > 2) {
      await supabase
        .from('category_rules')
        .upsert({
          user_id: user.id,
          pattern: creditorName.toLowerCase(),
          match_field: 'creditor_name',
          match_type: 'contains',
          category,
          sub_category: sub_category || null,
          priority: 100, // user rules override everything
          is_active: true,
        }, {
          onConflict: 'user_id,pattern,match_field',
        });
    }

    // 4. Optionally apply to all matching past transactions
    let updated_count = 0;
    if (apply_to_all && creditorName) {
      const { data: updated } = await supabase
        .from('bank_transactions')
        .update({
          pw_category: category,
          pw_sub_category: sub_category || null,
          category_source: 'user',
          category_confidence: 1.0,
        })
        .eq('user_id', user.id)
        .ilike('creditor_name', `%${creditorName}%`)
        .neq('category_source', 'user')
        .select('id');

      updated_count = updated?.length || 0;
    }

    // 5. Refresh analytics to reflect the change
    try {
      await supabase.rpc('refresh_user_analytics', { p_user_id: user.id });
    } catch {
      // non-blocking
    }

    return NextResponse.json({
      success: true,
      updated_count: apply_to_all ? updated_count : 1,
    });
  } catch (error) {
    console.error('[Analytics] Correction error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
