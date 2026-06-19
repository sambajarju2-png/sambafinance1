import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const supabase = await createServerSupabaseClient();

  // Get the cleared timestamp
  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('chat_cleared_at, language')
    .eq('user_id', userId)
    .single();

  const clearedAt = userSettings?.chat_cleared_at || null;
  const showAll = new URL(req.url).searchParams.get('all') === 'true';

  // Load messages — either current conversation or full history
  let query = supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(showAll ? 200 : 30);

  if (clearedAt && !showAll) {
    query = query.gt('created_at', clearedAt);
  }

  const { data: messages } = await query;

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

  const lang = userSettings?.language || 'nl';
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

  const t = (m: Record<string, string>) => m[lang] || m.nl;
  const chips: string[] = [];
  chips.push(t({ nl: 'Foto scannen', en: 'Scan photo', pl: 'Zeskanuj zdjęcie', tr: 'Fotoğraf tara', fr: 'Scanner une photo', ar: 'مسح صورة' }));
  if (escalated.length > 0) chips.push(t({ nl: 'Wat moet ik eerst doen?', en: 'What should I do first?', pl: 'Co powinienem zrobić najpierw?', tr: 'Önce ne yapmalıyım?', fr: 'Que dois-je faire en premier ?', ar: 'ماذا أفعل أولاً؟' }));
  if (urgent.length > 0) chips.push(t({ nl: 'Plan mijn week', en: 'Plan my week', pl: 'Zaplanuj mój tydzień', tr: 'Haftamı planla', fr: 'Planifier ma semaine', ar: 'خطط لأسبوعي' }));
  if (allBills.length === 0) {
    chips.push(t({ nl: 'Rekening toevoegen', en: 'Add a bill', pl: 'Dodaj rachunek', tr: 'Fatura ekle', fr: 'Ajouter une facture', ar: 'أضف فاتورة' }));
    chips.push(t({ nl: 'Hoe werkt PayWatch?', en: 'How does PayWatch work?', pl: 'Jak działa PayWatch?', tr: 'PayWatch nasıl çalışır?', fr: 'Comment fonctionne PayWatch ?', ar: 'كيف يعمل PayWatch؟' }));
  }
  if ((plans || []).length > 0) chips.push(t({ nl: 'Hoe gaat mijn regeling?', en: "How's my payment plan?", pl: 'Jak idzie mój plan spłat?', tr: 'Ödeme planım nasıl gidiyor?', fr: 'Où en est mon plan de paiement ?', ar: 'كيف تسير خطة السداد الخاصة بي؟' }));
  const settled = allBills.filter((b: { status: string }) => b.status === 'settled');
  if (settled.length > 0) chips.push(t({ nl: 'Hoeveel bespaar ik?', en: 'How much am I saving?', pl: 'Ile oszczędzam?', tr: 'Ne kadar tasarruf ediyorum?', fr: "Combien j'économise ?", ar: 'كم أوفر؟' }));
  chips.push(t({ nl: 'Hulp bij schulden', en: 'Help with debt', pl: 'Pomoc w zadłużeniu', tr: 'Borç konusunda yardım', fr: 'Aide pour les dettes', ar: 'مساعدة في الديون' }));

  return NextResponse.json({
    messages: messages || [],
    chips: chips.slice(0, 4),
  }, { headers: NO_CACHE });
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const supabase = await createServerSupabaseClient();
  // Don't delete messages — just set cleared timestamp so history is preserved
  await supabase.from('user_settings').update({ chat_cleared_at: new Date().toISOString() }).eq('user_id', userId);

  return NextResponse.json({ success: true }, { headers: NO_CACHE });
}
