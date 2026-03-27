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
  hasAttachments: boolean;
  rawPayload: Record<string, unknown> | null;
}

export interface GmailAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
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
    hasAttachments: hasPdfAttachment(msg.payload),
    rawPayload: msg.payload || null,
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

/**
 * Find PDF attachments in a message payload.
 * Returns attachment metadata (attachmentId, filename, etc).
 * SERVER-ONLY.
 */
export function findPdfAttachments(payload: Record<string, unknown>): GmailAttachment[] {
  const attachments: GmailAttachment[] = [];
  collectPdfParts(payload, attachments);
  return attachments;
}

/**
 * Fetch raw attachment data (base64url-encoded) from Gmail.
 * Returns a Buffer with the raw PDF bytes.
 * SERVER-ONLY.
 */
export async function fetchAttachmentData(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<Buffer | null> {
  try {
    const response = await fetch(
      `${GMAIL_API_BASE}/messages/${messageId}/attachments/${attachmentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      console.error(`Gmail attachment fetch error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.data) return null;

    // Gmail returns base64url encoding — convert to standard base64
    const base64 = data.data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64');
  } catch (err) {
    console.error('Gmail attachment fetch error:', err);
    return null;
  }
}

/* ─── Internal helpers ─── */

function hasPdfAttachment(payload: Record<string, unknown>): boolean {
  const parts = payload?.parts as Array<Record<string, unknown>> | undefined;
  if (!parts) return false;
  return parts.some((part) => {
    const mime = part.mimeType as string;
    const filename = part.filename as string;
    if (mime === 'application/pdf') return true;
    if (filename && filename.toLowerCase().endsWith('.pdf')) return true;
    // Check nested parts (multipart/mixed → multipart/alternative + attachment)
    const subParts = part.parts as Array<Record<string, unknown>> | undefined;
    if (subParts) return subParts.some((sp) => (sp.mimeType as string) === 'application/pdf' || ((sp.filename as string) || '').toLowerCase().endsWith('.pdf'));
    return false;
  });
}

function collectPdfParts(payload: Record<string, unknown>, result: GmailAttachment[]) {
  const parts = payload?.parts as Array<Record<string, unknown>> | undefined;
  if (!parts) return;

  for (const part of parts) {
    const mime = part.mimeType as string;
    const filename = (part.filename as string) || '';
    const body = part.body as { attachmentId?: string; size?: number } | undefined;

    if ((mime === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) && body?.attachmentId) {
      result.push({
        attachmentId: body.attachmentId,
        filename,
        mimeType: mime,
        size: body.size || 0,
      });
    }

    // Recurse into nested parts
    const subParts = part.parts as Array<Record<string, unknown>> | undefined;
    if (subParts) {
      collectPdfParts(part as Record<string, unknown>, result);
    }
  }
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
