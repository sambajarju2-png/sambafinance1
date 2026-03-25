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

    url = `${GRAPH_API_BASE}/me/messages?${params.toString()}`
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

export function toUnifiedEmail(msg: OutlookMessage): UnifiedEmail {
  return {
    messageId: msg.id,
    subject: msg.subject || '',
    from: msg.from?.emailAddress?.name || '',
    fromEmail: msg.from?.emailAddress?.address || '',
    receivedDate: msg.receivedDateTime,
    bodyHtml: msg.body?.contentType === 'html' ? msg.body.content : '',
    bodyText: msg.body?.contentType === 'text' ? msg.body.content : '',
    hasAttachments: msg.hasAttachments,
    source: 'outlook_scan',
  }
}
