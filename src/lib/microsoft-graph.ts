/**
 * Microsoft Graph API Helper
 * 
 * Handles Outlook/Hotmail OAuth2 flow and email fetching via Microsoft Graph API.
 * Mirrors the Gmail helper pattern but uses Microsoft's endpoints.
 * 
 * File: src/lib/microsoft-graph.ts
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0'

// Scopes: Mail.Read is delegated (NOT restricted like Gmail's gmail.readonly)
// offline_access is needed to get a refresh_token
const OUTLOOK_SCOPES = [
  'https://graph.microsoft.com/Mail.Read',
  'https://graph.microsoft.com/User.Read',
  'offline_access',
  'openid',
  'email',
].join(' ')

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MicrosoftTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope: string
}

export interface OutlookMessage {
  id: string
  subject: string
  from: {
    emailAddress: {
      name: string
      address: string
    }
  }
  receivedDateTime: string
  body: {
    contentType: string
    content: string
  }
  hasAttachments: boolean
  isRead: boolean
}

export interface OutlookAttachment {
  id: string
  name: string
  contentType: string
  size: number
  contentBytes: string
}

interface GraphListResponse<T> {
  value: T[]
  '@odata.nextLink'?: string
  '@odata.count'?: number
}

// ─── OAuth URL Generation ─────────────────────────────────────────────────────

export function getMicrosoftAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
    scope: OUTLOOK_SCOPES,
    state,
    response_mode: 'query',
    prompt: 'consent',
  })

  return `${MICROSOFT_AUTH_URL}?${params.toString()}`
}

// ─── Token Exchange ───────────────────────────────────────────────────────────

export async function exchangeCodeForTokens(code: string): Promise<MicrosoftTokens> {
  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    code,
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
    grant_type: 'authorization_code',
    scope: OUTLOOK_SCOPES,
  })

  const response = await fetch(MICROSOFT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[Outlook] Token exchange failed:', error)
    throw new Error(`Microsoft token exchange failed: ${response.status}`)
  }

  const tokens: MicrosoftTokens = await response.json()
  
  if (!tokens.refresh_token) {
    console.error('[Outlook] No refresh_token received — prompt=consent may be missing')
    throw new Error('No refresh token received from Microsoft')
  }

  return tokens
}

// ─── Token Refresh ────────────────────────────────────────────────────────────

export async function refreshAccessToken(refreshToken: string): Promise<MicrosoftTokens> {
  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: OUTLOOK_SCOPES,
  })

  const response = await fetch(MICROSOFT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[Outlook] Token refresh failed:', error)
    throw new Error(`Microsoft token refresh failed: ${response.status}`)
  }

  return response.json()
}

// ─── Get User Profile ─────────────────────────────────────────────────────────

export async function getUserEmail(accessToken: string): Promise<string> {
  const response = await fetch(`${GRAPH_API_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch user profile: ${response.status}`)
  }

  const profile = await response.json()
  return profile.mail || profile.userPrincipalName
}

// ─── Fetch Emails ─────────────────────────────────────────────────────────────

export async function fetchEmails(
  accessToken: string,
  options: {
    sinceDate?: string
    top?: number
    skip?: number
    nextLink?: string
  } = {}
): Promise<{ messages: OutlookMessage[]; nextLink?: string }> {
  const { sinceDate, top = 100, skip = 0, nextLink } = options

  let url: string

  if (nextLink) {
    url = nextLink
  } else {
    const params = new URLSearchParams({
      $top: top.toString(),
      $skip: skip.toString(),
      $orderby: 'receivedDateTime desc',
      $select: 'id,subject,from,receivedDateTime,body,hasAttachments,isRead',
    })

    if (sinceDate) {
      params.set('$filter', `receivedDateTime ge ${sinceDate}`)
    }

    url = `${GRAPH_API_BASE}/me/mailFolders/inbox/messages?${params.toString()}`
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[Outlook] Fetch emails failed:', error)
    throw new Error(`Failed to fetch emails: ${response.status}`)
  }

  const data: GraphListResponse<OutlookMessage> = await response.json()

  return {
    messages: data.value,
    nextLink: data['@odata.nextLink'],
  }
}

// ─── Fetch Attachments ────────────────────────────────────────────────────────

export async function fetchAttachments(
  accessToken: string,
  messageId: string,
  maxSizeBytes: number = 3 * 1024 * 1024
): Promise<OutlookAttachment[]> {
  const response = await fetch(
    `${GRAPH_API_BASE}/me/messages/${messageId}/attachments?$select=id,name,contentType,size,contentBytes`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!response.ok) {
    console.error(`[Outlook] Fetch attachments failed for message ${messageId}`)
    return []
  }

  const data: GraphListResponse<OutlookAttachment> = await response.json()

  return data.value.filter(
    (att) =>
      att.contentBytes &&
      att.size <= maxSizeBytes &&
      (att.contentType === 'application/pdf' ||
        att.contentType?.startsWith('image/'))
  )
}

// ─── HTML → Plain Text Stripper ───────────────────────────────────────────────
// Strips HTML tags, decodes entities, preserves line breaks.
// This is critical for AI extraction — Sonnet can't parse amounts from raw HTML
// like <span style="font-family:Arial">€&nbsp;220,00</span>.

function stripHtml(html: string): string {
  return html
    // Remove style/script blocks entirely
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Convert block elements to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/td>/gi, '\t')
    // Strip all remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities (most common ones in Dutch bill emails)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&euro;/gi, '€')
    .replace(/&#8364;/gi, '€')
    .replace(/&laquo;/gi, '«')
    .replace(/&raquo;/gi, '»')
    .replace(/&#\d+;/gi, '') // remove remaining numeric entities
    .replace(/&\w+;/gi, '')  // remove remaining named entities
    // Collapse excessive whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ─── Unified Email Format ─────────────────────────────────────────────────────

export interface UnifiedEmail {
  messageId: string
  subject: string
  from: string
  fromEmail: string
  receivedDate: string
  bodyHtml: string
  bodyText: string
  hasAttachments: boolean
  source: 'gmail_scan' | 'outlook_scan'
}

/**
 * Convert an Outlook message to our unified email format.
 *
 * FIX (Session 5): When contentType is 'html' (most Outlook emails),
 * we now strip HTML tags to produce bodyText. Previously bodyText was
 * empty for HTML emails, causing Sonnet to receive raw HTML and fail
 * to parse amounts like "€ 220,00" buried in <span> tags.
 */
export function toUnifiedEmail(msg: OutlookMessage): UnifiedEmail {
  const isHtml = msg.body?.contentType === 'html'
  const rawContent = msg.body?.content || ''

  return {
    messageId: msg.id,
    subject: msg.subject || '',
    from: msg.from?.emailAddress?.name || '',
    fromEmail: msg.from?.emailAddress?.address || '',
    receivedDate: msg.receivedDateTime,
    bodyHtml: isHtml ? rawContent : '',
    bodyText: isHtml ? stripHtml(rawContent) : rawContent,
    hasAttachments: msg.hasAttachments,
    source: 'outlook_scan',
  }
}
