import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { calculateToeslagen, estimateJaarinkomen } from '@/lib/toeslagen';

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('user_finances').select('*').eq('user_id', userId).single();

  return NextResponse.json(data || null);
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const supabase = await createServerSupabaseClient();

  const {
    netto_inkomen = 0, partner_inkomen = 0, duo_inkomen = 0,
    uitkering_inkomen = 0, toeslagen_inkomen = 0, overig_inkomen = 0,
    salary_day_from, salary_day_to, has_partner = false,
    num_children = 0, children_ages = [], monthly_rent = 0,
    has_kinderopvang = false, vermogen = 0,
    toeslagen_actueel,
  } = body;

  // Auto-detect huur from vaste lasten if not manually set
  let effectiveRent = monthly_rent;
  if (effectiveRent === 0) {
    const { data: huurExpense } = await supabase
      .from('user_expenses').select('monthly_amount')
      .eq('user_id', userId).eq('category', 'huur').eq('is_active', true)
      .limit(1).single();
    if (huurExpense?.monthly_amount) effectiveRent = huurExpense.monthly_amount;
  }

  const jaarinkomen = estimateJaarinkomen(netto_inkomen + duo_inkomen + uitkering_inkomen + overig_inkomen);
  const partnerJaar = estimateJaarinkomen(partner_inkomen);

  const toeslagenResult = calculateToeslagen({
    jaarinkomen, has_partner, partner_jaarinkomen: partnerJaar,
    vermogen, monthly_rent: effectiveRent, num_children,
    children_ages, has_kinderopvang,
  });

  // Preserve existing toeslagen_actueel if not provided in this request
  // (income-form saves don't send toeslagen_actueel — upsert must not clear it)
  let effectiveToeslag = toeslagen_actueel;
  if (!effectiveToeslag || typeof effectiveToeslag !== 'object') {
    const { data: existing } = await supabase
      .from('user_finances').select('toeslagen_actueel').eq('user_id', userId).single();
    if (existing?.toeslagen_actueel) effectiveToeslag = existing.toeslagen_actueel;
  }

  const record = {
    user_id: userId, netto_inkomen, partner_inkomen, duo_inkomen,
    uitkering_inkomen, toeslagen_inkomen, overig_inkomen,
    salary_day_from: salary_day_from || null,
    salary_day_to: salary_day_to || null,
    has_partner, num_children, children_ages,
    monthly_rent: effectiveRent, has_kinderopvang, vermogen,
    toeslagen_eligible: toeslagenResult,
    ...(effectiveToeslag && typeof effectiveToeslag === 'object' ? { toeslagen_actueel: effectiveToeslag } : {}),
  };

  const { data, error } = await supabase
    .from('user_finances').upsert(record, { onConflict: 'user_id' })
    .select().single();

  if (error) {
    console.error('[finances] Upsert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
