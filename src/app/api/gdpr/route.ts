import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId, NO_CACHE } from '@/lib/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';

const VALID_TYPES = [
  'inzage',               // Right of access
  'verwijdering',         // Right to erasure
  'rectificatie',         // Right to rectification
  'beperking',            // Right to restriction
  'overdracht',           // Right to data portability
  'bezwaar',              // Right to object
  'toestemming_intrekken' // Withdraw consent
] as const;

async function exitOrgRelationship(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  orgId: string,
  now: string
) {
  await supabase.from('user_organizations')
    .update({ status: 'exited', exited_at: now, exit_reason: 'gdpr_withdraw', updated_at: now })
    .eq('user_id', userId).eq('organization_id', orgId)
    .in('status', ['active', 'onboarded', 'invited', 'paused']);
  await supabase.from('b2b_consents')
    .update({ granted: false, revoked_at: now })
    .eq('user_id', userId).eq('organization_id', orgId);
  await supabase.from('b2b_audit_log').insert({
    organization_id: orgId, actor_id: userId, actor_type: 'user',
    action: 'relationship.user_exited', target_type: 'user', target_id: userId,
    metadata: { reason: 'gdpr_withdraw' },
  });
}

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
  (gmailRes.data || []).forEach((g: any) => connections.push({ type: 'gmail', label: `Gmail: ${g.email || 'account'}`, id: g.id }));
  (outlookRes.data || []).forEach((o: any) => connections.push({ type: 'outlook', label: `Outlook: ${o.email || 'account'}`, id: o.id }));
  (bankRes.data || []).forEach((b: any) => connections.push({ type: 'bank', label: `Bank: ${b.bank_name || 'rekening'}`, id: b.id }));
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

  const { type, details, connections: selectedConnections } = await req.json();
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

  // Get user email for confirmation
  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const userEmail = authUser?.user?.email;

  // Send confirmation email
  if (userEmail) {
    const typeLabels: Record<string, string> = {
      inzage: 'Recht op inzage', overdracht: 'Recht op overdracht',
      toestemming_intrekken: 'Toestemming intrekken', rectificatie: 'Recht op correctie',
      beperking: 'Recht op beperking', bezwaar: 'Recht op bezwaar', verwijdering: 'Recht op verwijdering',
    };
    const refCode = requestId.slice(0, 8).toUpperCase();
    await sendEmail({
      to: userEmail,
      subject: `Privacyverzoek ontvangen — ${typeLabels[type] || type} (ref: ${refCode})`,
      html: `<div style="font-family:-apple-system,sans-serif;max-width:540px;margin:0 auto;padding:32px">
        <p style="font-size:12px;font-weight:800;color:#0A2540">PayWatch</p>
        <p style="font-size:14px;color:#0A2540;margin-top:16px">Hoi,</p>
        <p style="font-size:14px;color:#0A2540;line-height:1.7">We hebben je privacyverzoek ontvangen en geregistreerd.</p>
        <div style="background:#F4F7FB;border-radius:12px;padding:16px 20px;margin:16px 0">
          <p style="margin:0;font-size:13px;color:#64748B">Type verzoek</p>
          <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#0A2540">${typeLabels[type] || type}</p>
          <p style="margin:12px 0 0;font-size:13px;color:#64748B">Referentienummer</p>
          <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#2563EB">${refCode}</p>
          <p style="margin:12px 0 0;font-size:13px;color:#64748B">Datum</p>
          <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#0A2540">${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <p style="font-size:14px;color:#0A2540;line-height:1.7">${['rectificatie', 'beperking', 'bezwaar'].includes(type)
          ? 'We behandelen je verzoek binnen 30 dagen. Je ontvangt een e-mail zodra het is afgerond.'
          : 'Je verzoek is automatisch verwerkt. Controleer de app voor het resultaat.'}</p>
        <p style="font-size:13px;color:#64748B;margin-top:24px">Met vriendelijke groet,<br><strong style="color:#0A2540">PayWatch Privacy Team</strong></p>
        <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0">
        <p style="font-size:11px;color:#94A3B8">PayWatch · Rotterdam · KVK 83474889</p>
      </div>`,
    }).catch(err => console.error('[GDPR] Email error:', err));
  }

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
        const results: string[] = [];
        const gdprNow = new Date().toISOString();
        const selectedList: Array<{ type?: string; id?: string }> = Array.isArray(selectedConnections) ? selectedConnections : [];

        if (selectedList.length > 0) {
          // Per-connection: disconnect exactly what the user selected.
          for (const c of selectedList) {
            const cid: string | undefined = c?.id || undefined;
            if (c?.type === 'gmail' && cid) {
              await supabase.from('gmail_accounts').delete().eq('user_id', userId).eq('id', cid);
              results.push('Gmail ontkoppeld');
            } else if (c?.type === 'outlook' && cid) {
              await supabase.from('outlook_accounts').delete().eq('user_id', userId).eq('id', cid);
              results.push('Outlook ontkoppeld');
            } else if (c?.type === 'bank' && cid) {
              await supabase.from('bank_transactions').delete().eq('user_id', userId).eq('connection_id', cid);
              await supabase.from('bank_connections').delete().eq('user_id', userId).eq('id', cid);
              results.push('Bankverbinding verwijderd + transacties gewist');
            } else if (c?.type === 'b2b' && cid) {
              await exitOrgRelationship(supabase, userId, cid, gdprNow); // cid = organization_id
              results.push('Organisatie losgekoppeld');
            }
          }
        } else {
          // No selection provided — disconnect everything (legacy "withdraw all").
          const { data: gmailAccounts } = await supabase.from('gmail_accounts').select('id').eq('user_id', userId);
          if (gmailAccounts && gmailAccounts.length > 0) {
            await supabase.from('gmail_accounts').delete().eq('user_id', userId);
            results.push('Gmail ontkoppeld');
          }
          const { data: outlookAccounts } = await supabase.from('outlook_accounts').select('id').eq('user_id', userId);
          if (outlookAccounts && outlookAccounts.length > 0) {
            await supabase.from('outlook_accounts').delete().eq('user_id', userId);
            results.push('Outlook ontkoppeld');
          }
          const { data: bankConns } = await supabase.from('bank_connections').select('id').eq('user_id', userId);
          if (bankConns && bankConns.length > 0) {
            await supabase.from('bank_transactions').delete().eq('user_id', userId);
            await supabase.from('bank_connections').delete().eq('user_id', userId);
            results.push('Bankverbinding(en) verwijderd + transacties gewist');
          }
          const { data: activeOrgs } = await supabase.from('user_organizations')
            .select('organization_id').eq('user_id', userId)
            .in('status', ['active', 'onboarded', 'invited', 'paused']);
          for (const o of (activeOrgs || [])) {
            await exitOrgRelationship(supabase, userId, (o as { organization_id: string }).organization_id, gdprNow);
          }
          if ((activeOrgs || []).length > 0) results.push('B2B toestemmingen ingetrokken');
        }

        autoResponse = { fulfilled: true, disconnected: results, message: results.length > 0 ? 'De geselecteerde koppelingen zijn losgekoppeld.' : 'Geen koppelingen om los te koppelen.' };
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
