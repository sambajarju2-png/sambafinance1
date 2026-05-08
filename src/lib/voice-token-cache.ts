/**
 * Voice token pre-warm cache.
 *
 * Signed URLs from ElevenLabs expire in ~60s. We cache the full token
 * response for 55s so that when the user taps "Call", startSession fires
 * instantly instead of waiting 600ms–1.5s for the ElevenLabs API round-trip.
 *
 * The cache is module-level (in-memory). It resets on page reload.
 */

interface VoiceTokenResponse {
  signedUrl: string | null;
  conversationToken: string | null;
  agentId: string;
  remainingSeconds: number | null;
  plan: string;
  overrides: Record<string, unknown>;
}

interface CacheEntry {
  data: VoiceTokenResponse;
  fetchedAt: number; // ms timestamp
}

const TTL_MS = 55_000; // 55 seconds — safe margin before 60s expiry

let cache: CacheEntry | null = null;
let inFlight: Promise<VoiceTokenResponse | null> | null = null;

/** Returns a fresh cached token, or null if expired/missing. */
export function getCachedVoiceToken(): VoiceTokenResponse | null {
  if (!cache) return null;
  if (Date.now() - cache.fetchedAt > TTL_MS) {
    cache = null;
    return null;
  }
  return cache.data;
}

/** Fetches and caches the voice token. Safe to call multiple times — dedupes in-flight requests. */
export async function prewarmVoiceToken(): Promise<VoiceTokenResponse | null> {
  // Return cached if still valid
  const cached = getCachedVoiceToken();
  if (cached) return cached;

  // Dedupe concurrent calls (e.g. two components mounting at the same time)
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch('/api/voice/token', { credentials: 'include' });
      if (!res.ok) return null; // limit reached or error — don't cache

      const data: VoiceTokenResponse = await res.json();
      if (data.signedUrl || data.conversationToken) {
        cache = { data, fetchedAt: Date.now() };
      }
      return data;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Clears the cache (call after a successful call to force a fresh token next time). */
export function clearVoiceTokenCache() {
  cache = null;
  inFlight = null;
}
