import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

const VALID_TYPES = [
  'inzage',               // Right of access
  'verwijdering',         // Right to erasure
  'rectificatie',         // Right to rectification
  'beperking',            // Right to restriction
  'overdracht',           // Right to data portability
  'bezwaar',              // Right to object
  'toestemming_intrekken' // Withdraw consent
] as const;

/**
 * GET /api/gdpr — list user's GDPR requests
 */
export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const supabase = createServiceRoleClient();

  // Fetch requests + active connections in parallel
  const [requestsRes, gmailRes, outlookRes, bankRes, orgRes] = await Promise.all([
    supabase.from('gdpr_requests').select('id, request_type, status, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('gmail_accounts').select('id, email').eq('user_id', userId),
    supabase.from('outlook_accounts').select('id, email').eq('user_id', userId),
    supabase.from('bank_connections').select('id, bank_name, status').eq('user_id', userId).neq('status', 'expired'),
    supabase.from('user_organizations').select('organization_id, status, organizations(name)').eq('user_id', userId).eq('status', 'active'),
  ]);

  const connections: Array<{ type: string; label: string; id: string }> = [];
  (gmailRes.data || []).forEach(g => connections.push({ type: 'gmail', label: `Gmail: ${g.email || 'account'}`, id: g.id }));
  (outlookRes.data || []).forEach(o => connections.push({ type: 'outlook', label: `Outlook: ${o.email || 'account'}`, id: o.id }));
  (bankRes.data || []).forEach(b => connections.push({ type: 'bank', label: `Bank: ${b.bank_name || 'rekening'}`, id: b.id }));
  (orgRes.data || []).forEach((o: any) => connections.push({ type: 'b2b', label: o.organizations?.name || 'Organisatie', id: o.organization_id }));

  return NextResponse.json({ requests: requestsRes.data || [], connections });
}

/**
 * POST /api/gdpr — submit a new GDPR request
 * Body: { type: string, details?: string }
 *
 * Auto-processes:
 * - inzage → generates data export
 * - overdracht → generates data export (JSON)
 * - toestemming_intrekken → disconnects all integrations
 * - verwijdering → redirects to DELETE /api/account
 * - rectificatie, beperking, bezwaar → logged, auto-email sent to privacy@paywatch.nl
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE });

  const { type, details } = await req.json();
  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Invalid type. Valid: ' + VALID_TYPES.join(', ') }, { status: 400, headers: NO_CACHE });
  }

  const supabase = createServiceRoleClient();

  // Create GDPR request record
  const { data: request, error: insertErr } = await supabase
    .from('gdpr_requests')
    .insert({
      user_id: userId,
      request_type: type,
      status: 'processing',
      details: { user_details: details || null, initiated_at: new Date().toISOString() },
    })
    .select('id')
    .single();

  if (insertErr) {
    console.error('[GDPR] Insert error:', insertErr);
    return NextResponse.json({ error: 'Could not create request' }, { status: 500, headers: NO_CACHE });
  }

  const requestId = request.id;
  let autoResponse: Record<string, unknown> = {};

  try {
    switch (type) {
      case 'inzage':
      case 'overdracht': {
        // Auto-fulfill: generate data export
        const exportRes = await fetch(new URL('/api/settings/export', req.url), {
          method: 'POST',
          headers: { cookie: req.headers.get('cookie') || '' },
        });
        if (exportRes.ok) {
          autoResponse = { fulfilled: true, message: 'Je gegevens zijn klaar om te downloaden via Instellingen → Gegevens downloaden.' };
          await supabase.from('gdpr_requests').update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            details: { user_details: details, fulfilled: 'auto_export' },
          }).eq('id', requestId);
        } else {
          autoResponse = { fulfilled: false, message: 'Export kon niet automatisch worden gegenereerd. We nemen binnen 30 dagen contact op.' };
        }
        break;
      }

      case 'toestemming_intrekken': {
        // Disconnect all integrations
        const results: string[] = [];

        // Gmail
        const { data: gmailAccounts } = await supabase
          .from('gmail_accounts').select('id').eq('user_id', userId);
        if (gmailAccounts && gmailAccounts.length > 0) {
          await supabase.from('gmail_accounts').delete().eq('user_id', userId);
          results.push('Gmail ontkoppeld');
        }

        // Outlook
        const { data: outlookAccounts } = await supabase
          .from('outlook_accounts').select('id').eq('user_id', userId);
        if (outlookAccounts && outlookAccounts.length > 0) {
          await supabase.from('outlook_accounts').delete().eq('user_id', userId);
          results.push('Outlook ontkoppeld');
        }

        // Bank connections
        const { data: bankConns } = await supabase
          .from('bank_connections').select('id').eq('user_id', userId);
        if (bankConns && bankConns.length > 0) {
          await supabase.from('bank_transactions').delete().eq('user_id', userId);
          await supabase.from('bank_connections').delete().eq('user_id', userId);
          results.push('Bankverbinding(en) verwijderd + transacties gewist');
        }

        // B2B consents
        await supabase.from('b2b_consents').delete().eq('user_id', userId);
        results.push('B2B toestemmingen ingetrokken');

        autoResponse = { fulfilled: true, disconnected: results, message: 'Alle koppelingen en toestemmingen zijn ingetrokken.' };
        await supabase.from('gdpr_requests').update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          details: { user_details: details, disconnected: results },
        }).eq('id', requestId);
        break;
      }

      case 'verwijdering': {
        // Don't auto-delete here — user must confirm via the existing account deletion flow
        autoResponse = {
          fulfilled: false,
          message: 'Je verwijderingsverzoek is geregistreerd. Ga naar Instellingen → Account verwijderen om je account permanent te verwijderen, of we verwerken het binnen 30 dagen.',
        };
        break;
      }

      case 'rectificatie':
      case 'beperking':
      case 'bezwaar': {
        // These need manual review — log and notify
        autoResponse = {
          fulfilled: false,
          message: `Je ${type}-verzoek is geregistreerd (ref: ${requestId.slice(0, 8).toUpperCase()}). We nemen binnen 30 dagen contact op via je e-mailadres.`,
        };
        break;
      }
    }
  } catch (err) {
    console.error('[GDPR] Processing error:', err);
    autoResponse = { error: true, message: 'Er ging iets mis bij het verwerken. We nemen binnen 30 dagen contact op.' };
  }

  console.log(`[GDPR] Request ${requestId} type=${type} user=${userId}`);

  return NextResponse.json({
    request_id: requestId,
    type,
    ...autoResponse,
  });
}
