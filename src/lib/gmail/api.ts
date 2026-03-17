const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

interface GmailMessageRef {
  id: string;
  threadId: string;
}

interface GmailListResponse {
  messages: GmailMessageRef[];
  nextPageToken: string | null;
  resultSizeEstimate: number;
}

export interface GmailMessageDetail {
  id: string;
  subject: string;
  from: string;
  date: string;
  body: string;
  snippet: string;
}

/**
 * List message IDs from Gmail inbox.
 * Returns a batch of message IDs + nextPageToken for pagination.
 *
 * @param accessToken - Valid Gmail access token
 * @param maxResults - Max messages to fetch (default 15 per batch, up to 100 for initial scan)
 * @param pageToken - Pagination token from previous call
 * @param query - Optional Gmail search query (e.g. 'newer_than:30d')
 *
 * SERVER-ONLY.
 */
export async function listMessages(
  accessToken: string,
  maxResults: number = 15,
  pageToken?: string | null,
  query?: string | null
): Promise<GmailListResponse> {
  const params = new URLSearchParams({
    maxResults: maxResults.toString(),
    labelIds: 'INBOX',
  });

  if (pageToken) {
    params.set('pageToken', pageToken);
  }

  // Only add query if explicitly provided — no default date filter
  // This ensures we get the most recent emails regardless of date
  if (query) {
    params.set('q', query);
  }

  const response = await fetch(
    `${GMAIL_API_BASE}/messages?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const err = await response.text();
    console.error('Gmail list messages error:', response.status, err);
    throw new Error(`Gmail API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    messages: data.messages || [],
    nextPageToken: data.nextPageToken || null,
    resultSizeEstimate: data.resultSizeEstimate || 0,
  };
}

/**
 * Get full message details (subject, from, body) for a single message.
 *
 * SERVER-ONLY.
 */
export async function getMessageDetail(
  accessToken: string,
  messageId: string
): Promise<GmailMessageDetail> {
  const response = await fetch(
    `${GMAIL_API_BASE}/messages/${messageId}?format=full`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error(`Gmail message fetch error: ${response.status}`);
  }

  const msg = await response.json();

  // Extract headers
  const headers = msg.payload?.headers || [];
  const getHeader = (name: string): string => {
    const h = headers.find((h: { name: string; value: string }) =>
      h.name.toLowerCase() === name.toLowerCase()
    );
    return h?.value || '';
  };

  const subject = getHeader('Subject');
  const from = getHeader('From');
  const date = getHeader('Date');

  // Extract body text
  const body = extractBodyText(msg.payload);

  return {
    id: msg.id,
    subject,
    from,
    date,
    body,
    snippet: msg.snippet || '',
  };
}

/**
 * Get multiple message details in batch (subjects + snippets only, for classification).
 * This is lighter than full message fetch — used for Gemini classification.
 *
 * SERVER-ONLY.
 */
export async function getMessageSnippets(
  accessToken: string,
  messageIds: string[]
): Promise<Array<{ id: string; subject: string; from: string; snippet: string }>> {
  // Use metadata format for lighter payload
  const results = await Promise.all(
    messageIds.map(async (id) => {
      try {
        const response = await fetch(
          `${GMAIL_API_BASE}/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!response.ok) return null;

        const msg = await response.json();
        const headers = msg.payload?.headers || [];
        const getHeader = (name: string): string => {
          const h = headers.find((h: { name: string; value: string }) =>
            h.name.toLowerCase() === name.toLowerCase()
          );
          return h?.value || '';
        };

        return {
          id: msg.id,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          snippet: msg.snippet || '',
        };
      } catch {
        return null;
      }
    })
  );

  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}

/**
 * Recursively extract plain text body from Gmail message payload.
 */
function extractBodyText(payload: Record<string, unknown>): string {
  if (!payload) return '';

  const mimeType = payload.mimeType as string;

  // Direct text body
  if (mimeType === 'text/plain' && payload.body) {
    const body = payload.body as { data?: string };
    if (body.data) {
      return decodeBase64Url(body.data);
    }
  }

  // HTML body (fallback — strip tags)
  if (mimeType === 'text/html' && payload.body) {
    const body = payload.body as { data?: string };
    if (body.data) {
      const html = decodeBase64Url(body.data);
      return stripHtmlTags(html);
    }
  }

  // Multipart — recurse into parts
  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (parts && parts.length > 0) {
    // Prefer text/plain
    for (const part of parts) {
      if ((part.mimeType as string) === 'text/plain') {
        const text = extractBodyText(part);
        if (text) return text;
      }
    }
    // Fallback to text/html
    for (const part of parts) {
      if ((part.mimeType as string) === 'text/html') {
        const text = extractBodyText(part);
        if (text) return text;
      }
    }
    // Recurse into nested multipart
    for (const part of parts) {
      const text = extractBodyText(part);
      if (text) return text;
    }
  }

  return '';
}

/**
 * Decode base64url-encoded string (Gmail API format).
 */
function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  try {
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

/**
 * Strip HTML tags and decode entities for plain text fallback.
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
