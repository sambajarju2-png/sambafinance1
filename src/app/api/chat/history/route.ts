import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const supabase = await createServerSupabaseClient();

  // Load last 30 messages
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(30);

  // Load bills for chip generation
  const { data: bills } = await supabase
    .from('bills')
    .select('status, escalation_stage, due_date')
    .eq('user_id', userId)
    .limit(50);

  const { data: plans } = await supabase
    .from('payment_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active');

  const { data: settings } = await supabase
    .from('user_settings')
    .select('language')
    .eq('user_id', userId)
    .single();

  const lang = settings?.language || 'nl';
  const allBills = bills || [];
  const outstanding = allBills.filter((b: { status: string }) => b.status !== 'settled');
  const now = new Date();
  const urgent = outstanding.filter((b: { due_date?: string }) => {
    if (!b.due_date) return false;
    const diff = (new Date(b.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7 && diff >= 0;
  });
  const escalated = outstanding.filter((b: { escalation_stage?: string }) =>
    ['herinnering', 'aanmaning', 'incasso', 'deurwaarder'].includes(b.escalation_stage || '')
  );

  const nl = lang === 'nl';
  const chips: string[] = [];
  chips.push(nl ? 'Foto scannen' : 'Scan photo');
  if (escalated.length > 0) chips.push(nl ? 'Wat moet ik eerst doen?' : 'What should I do first?');
  if (urgent.length > 0) chips.push(nl ? 'Plan mijn week' : 'Plan my week');
  if (allBills.length === 0) {
    chips.push(nl ? 'Rekening toevoegen' : 'Add a bill');
    chips.push(nl ? 'Hoe werkt PayWatch?' : 'How does PayWatch work?');
  }
  if ((plans || []).length > 0) chips.push(nl ? 'Hoe gaat mijn regeling?' : "How's my payment plan?");
  const settled = allBills.filter((b: { status: string }) => b.status === 'settled');
  if (settled.length > 0) chips.push(nl ? 'Hoeveel bespaar ik?' : 'How much am I saving?');
  chips.push(nl ? 'Hulp bij schulden' : 'Help with debt');

  return NextResponse.json({
    messages: messages || [],
    chips: chips.slice(0, 4),
  }, { headers: NO_CACHE });
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const supabase = await createServerSupabaseClient();
  await supabase.from('chat_messages').delete().eq('user_id', userId);

  return NextResponse.json({ success: true }, { headers: NO_CACHE });
}
