import type { SupabaseClient } from '@supabase/supabase-js';
import { getValidAccessToken } from './tokens';
import {
  createAppCalendar,
  calendarExists,
  insertEvent,
  patchEvent,
  deleteEvent,
  type GoogleEvent,
} from './google';

export const CALENDAR_SUMMARY = 'PayWatch betalingen';

function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Deep link into the app's payments view for a specific bill. */
export function billDeepLink(appUrl: string, billId: string): string {
  return `${appUrl.replace(/\/$/, '')}/betalingen?bill=${encodeURIComponent(billId)}`;
}

// Localized, privacy-safe event copy. Keys match the app's supported locales;
// anything else falls back to Dutch (the app default). The quoted titles here are
// mirrored in the settings privacy note (settings.agendaPrivacy) per locale.
const EVENT_TITLE: Record<string, string> = {
  nl: 'Betaling via PayWatch',
  en: 'Payment via PayWatch',
  fr: 'Paiement via PayWatch',
  pl: 'Płatność przez PayWatch',
  tr: 'PayWatch ile ödeme',
  ar: 'دفعة عبر PayWatch',
};
const EVENT_DESC_PREFIX: Record<string, string> = {
  nl: 'Bekijk en betaal in PayWatch:',
  en: 'View and pay in PayWatch:',
  fr: 'Consulte et paie dans PayWatch :',
  pl: 'Zobacz i zapłać w PayWatch:',
  tr: "PayWatch'ta görüntüle ve öde:",
  ar: 'اعرض وادفع في PayWatch:',
};

/**
 * Discreet all-day event for a bill. No vendor, no amount — just a neutral title
 * and a deep link, so it is safe on a shared or lock-screen calendar. Details live
 * only behind the link, inside the app. `lang` localizes the visible copy.
 */
export function buildBillEvent(billId: string, dueDate: string, appUrl: string, lang = 'nl'): GoogleEvent {
  const link = billDeepLink(appUrl, billId);
  const title = EVENT_TITLE[lang] || EVENT_TITLE.nl;
  const descPrefix = EVENT_DESC_PREFIX[lang] || EVENT_DESC_PREFIX.nl;
  return {
    summary: title,
    description: `${descPrefix}\n${link}`,
    start: { date: dueDate },
    end: { date: nextDay(dueDate) },
    transparency: 'transparent',
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 24 * 60 }] },
    source: { title: 'PayWatch', url: link },
    extendedProperties: { private: { paywatch_bill_id: billId } },
  };
}

export interface ReconcileResult {
  created: number;
  updated: number;
  deleted: number;
  errors: number;
  reauth?: boolean;
}

interface ConnRow {
  id: string;
  user_id: string;
  calendar_id: string | null;
}

/**
 * Make the user's PayWatch calendar match their active bills:
 *  - active bill with no event  -> create event
 *  - active bill, due_date moved -> patch event
 *  - event for a bill that is now paid/settled/gone -> delete event
 *
 * `supabase` MUST be a service-role client. Each Google call is isolated so one
 * failure does not abort the run. Returns counts; reauth:true means the token is
 * dead and the user must reconnect.
 */
export async function reconcileConnection(
  supabase: SupabaseClient,
  conn: ConnRow,
  appUrl: string,
): Promise<ReconcileResult> {
  const result: ReconcileResult = { created: 0, updated: 0, deleted: 0, errors: 0 };

  const accessToken = await getValidAccessToken(supabase, conn.id);
  if (!accessToken) return { ...result, reauth: true };

  // Ensure a calendar exists (recreate if the user deleted it on their side).
  let calendarId = conn.calendar_id;
  if (!calendarId || !(await calendarExists(accessToken, calendarId))) {
    calendarId = await createAppCalendar(accessToken, CALENDAR_SUMMARY);
    await supabase
      .from('calendar_connections')
      .update({ calendar_id: calendarId, updated_at: new Date().toISOString() })
      .eq('id', conn.id);
    // Old mapping points at a calendar that is gone — clear so events are recreated.
    await supabase.from('calendar_synced_events').delete().eq('connection_id', conn.id);
  }

  // User's preferred language for the (privacy-safe) event copy. Defaults to Dutch.
  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('language')
    .eq('user_id', conn.user_id)
    .maybeSingle();
  const lang = (settingsRow?.language as string | null) || 'nl';

  // Active bills (unpaid + not settled) with a due date.
  const { data: billsData } = await supabase
    .from('bills')
    .select('id, due_date')
    .eq('user_id', conn.user_id)
    .not('status', 'eq', 'settled')
    .is('paid_at', null)
    .is('paid_date', null);
  const activeBills = new Map<string, string>();
  for (const b of (billsData || []) as Array<{ id: string; due_date: string | null }>) {
    if (b.due_date) activeBills.set(b.id, b.due_date);
  }

  // What we have already synced for this connection.
  const { data: syncedData } = await supabase
    .from('calendar_synced_events')
    .select('id, bill_id, google_event_id, due_date')
    .eq('connection_id', conn.id);
  const synced = new Map<string, { rowId: string; eventId: string; due_date: string | null }>();
  for (const s of (syncedData || []) as Array<{
    id: string;
    bill_id: string;
    google_event_id: string;
    due_date: string | null;
  }>) {
    synced.set(s.bill_id, { rowId: s.id, eventId: s.google_event_id, due_date: s.due_date });
  }

  // Create / update.
  for (const [billId, dueDate] of activeBills) {
    const existing = synced.get(billId);
    try {
      if (!existing) {
        const eventId = await insertEvent(accessToken, calendarId, buildBillEvent(billId, dueDate, appUrl, lang));
        await supabase.from('calendar_synced_events').insert({
          user_id: conn.user_id,
          connection_id: conn.id,
          bill_id: billId,
          google_event_id: eventId,
          calendar_id: calendarId,
          due_date: dueDate,
        });
        result.created++;
      } else if (existing.due_date !== dueDate) {
        const { ok } = await patchEvent(accessToken, calendarId, existing.eventId, {
          start: { date: dueDate },
          end: { date: nextDay(dueDate) },
        });
        if (ok) {
          await supabase
            .from('calendar_synced_events')
            .update({ due_date: dueDate, updated_at: new Date().toISOString() })
            .eq('id', existing.rowId);
          result.updated++;
        } else {
          result.errors++;
        }
      }
    } catch (err) {
      console.error('[calendar/sync] upsert error for bill', billId, err);
      result.errors++;
    }
  }

  // Delete events for bills that are no longer active (paid / settled / deleted).
  for (const [billId, info] of synced) {
    if (activeBills.has(billId)) continue;
    try {
      await deleteEvent(accessToken, calendarId, info.eventId);
      await supabase.from('calendar_synced_events').delete().eq('id', info.rowId);
      result.deleted++;
    } catch (err) {
      console.error('[calendar/sync] delete error for bill', billId, err);
      result.errors++;
    }
  }

  await supabase
    .from('calendar_connections')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', conn.id);
  return result;
}

/** Load a user's active connection and reconcile it. Returns null if not connected. */
export async function reconcileUser(
  supabase: SupabaseClient,
  userId: string,
  appUrl: string,
): Promise<ReconcileResult | null> {
  const { data: conn } = await supabase
    .from('calendar_connections')
    .select('id, user_id, calendar_id, sync_enabled, needs_reauth')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle();
  if (!conn || !conn.sync_enabled || conn.needs_reauth) return null;
  return reconcileConnection(supabase, conn as ConnRow, appUrl);
}
