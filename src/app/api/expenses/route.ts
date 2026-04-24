import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { normalizeToMonthly } from '@/lib/toeslagen';

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('user_expenses')
    .select('*')
    .eq('user_id', userId)
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    name,
    category = 'overig',
    amount,
    interval = 'monthly',
    payment_day,
    iban,
    reference,
  } = body;

  if (!name || !amount) {
    return NextResponse.json({ error: 'Naam en bedrag zijn verplicht' }, { status: 400 });
  }

  const monthly_amount = normalizeToMonthly(amount, interval);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('user_expenses')
    .insert({
      user_id: userId,
      name,
      category,
      amount,
      interval,
      monthly_amount,
      payment_day: payment_day || null,
      iban: iban || null,
      reference: reference || null,
    })
    .select()
    .single();

  if (error) {
    console.error('[expenses] Insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
