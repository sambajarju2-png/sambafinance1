/**
 * Thin wrapper over the Google Calendar REST API (v3).
 *
 * We use the `calendar.app.created` OAuth scope, which lets the app create
 * secondary calendars and manage events ONLY on calendars it created. It cannot
 * see or touch the user's other calendars or events. All event payloads here are
 * deliberately discreet (no vendor, no amount) for a debt-context app.
 *
 * SERVER-ONLY. Every call takes a short-lived access token (see calendar/tokens).
 */

const BASE = 'https://www.googleapis.com/calendar/v3';

export interface GoogleEvent {
  id?: string;
  summary?: string;
  description?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  reminders?: { useDefault: boolean; overrides?: Array<{ method: string; minutes: number }> };
  transparency?: 'opaque' | 'transparent';
  source?: { title?: string; url?: string };
  extendedProperties?: { private?: Record<string, string> };
}

async function call(
  accessToken: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: Record<string, unknown> = {};
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
  }
  return { ok: res.ok, status: res.status, data };
}

/** Create a dedicated secondary calendar; returns its calendar id. */
export async function createAppCalendar(
  accessToken: string,
  summary: string,
  timeZone = 'Europe/Amsterdam',
): Promise<string> {
  const { ok, status, data } = await call(accessToken, 'POST', '/calendars', { summary, timeZone });
  if (!ok || !data.id) {
    throw new Error(`createAppCalendar failed (${status}): ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data.id as string;
}

/** Delete a calendar the app created (also removes all of its events). Tolerant of already-gone. */
export async function deleteCalendar(accessToken: string, calendarId: string): Promise<void> {
  const { ok, status } = await call(accessToken, 'DELETE', `/calendars/${encodeURIComponent(calendarId)}`);
  if (!ok && status !== 404 && status !== 410) {
    throw new Error(`deleteCalendar failed (${status})`);
  }
}

/** Insert an event; returns the created event id. */
export async function insertEvent(
  accessToken: string,
  calendarId: string,
  event: GoogleEvent,
): Promise<string> {
  const { ok, status, data } = await call(
    accessToken,
    'POST',
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    event,
  );
  if (!ok || !data.id) {
    throw new Error(`insertEvent failed (${status}): ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data.id as string;
}

/** Patch an existing event (partial update). */
export async function patchEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  patch: Partial<GoogleEvent>,
): Promise<{ ok: boolean; status: number }> {
  const { ok, status } = await call(
    accessToken,
    'PATCH',
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    patch,
  );
  return { ok, status };
}

/** Delete an event. Tolerant of 404/410 (already gone). Returns true if gone after the call. */
export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<boolean> {
  const { ok, status } = await call(
    accessToken,
    'DELETE',
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
  );
  return ok || status === 404 || status === 410;
}

/** Best-effort check that a calendar still exists and is reachable. */
export async function calendarExists(accessToken: string, calendarId: string): Promise<boolean> {
  const { ok } = await call(accessToken, 'GET', `/calendars/${encodeURIComponent(calendarId)}`);
  return ok;
}
