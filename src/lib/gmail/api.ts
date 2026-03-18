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
 * Excludes promotions, social, updates, forums by default.
 * Supports date filtering via `after` param (YYYY/MM/DD).
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
  });

  if (pageToken) {
    params.set('pageToken', pageToken);
  }

  // Primary inbox only
  const defaultQuery = 'in:inbox -category:promotions -category:social -category:updates -category:forums';
  const finalQuery = query ? `${query} ${defaultQuery}` : defaultQuery;
  params.set('q', finalQuery);

  const response = await fetch(
    `${GMAIL_API_BASE}/messages?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
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
 * Get full message details for a single message.
 * SERVER-ONLY.
 */
export async function getMessageDetail(
  accessToken: string,
  messageId: string
): Promise<GmailMessageDetail> {
  const response = await fetch(
    `${GMAIL_API_BASE}/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error(`Gmail message fetch error: ${response.status}`);
  }

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
    date: getHeader('Date'),
    body: extractBodyText(msg.payload),
    snippet: msg.snippet || '',
  };
}

/**
 * Get multiple message snippets for classification (lightweight).
 * SERVER-ONLY.
 */
export async function getMessageSnippets(
  accessToken: string,
  messageIds: string[]
): Promise<Array<{ id: string; subject: string; from: string; snippet: string }>> {
  const results = await Promise.all(
    messageIds.map(async (id) => {
      try {
        const response = await fetch(
          `${GMAIL_API_BASE}/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
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

function extractBodyText(payload: Record<string, unknown>): string {
  if (!payload) return '';
  const mimeType = payload.mimeType as string;

  if (mimeType === 'text/plain' && payload.body) {
    const body = payload.body as { data?: string };
    if (body.data) return decodeBase64Url(body.data);
  }
  if (mimeType === 'text/html' && payload.body) {
    const body = payload.body as { data?: string };
    if (body.data) return stripHtmlTags(decodeBase64Url(body.data));
  }

  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (parts && parts.length > 0) {
    for (const part of parts) {
      if ((part.mimeType as string) === 'text/plain') {
        const text = extractBodyText(part);
        if (text) return text;
      }
    }
    for (const part of parts) {
      if ((part.mimeType as string) === 'text/html') {
        const text = extractBodyText(part);
        if (text) return text;
      }
    }
    for (const part of parts) {
      const text = extractBodyText(part);
      if (text) return text;
    }
  }
  return '';
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  try { return Buffer.from(base64, 'base64').toString('utf-8'); } catch { return ''; }
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}
