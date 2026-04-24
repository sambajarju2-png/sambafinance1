import { NextResponse } from 'next/server'
import { createSign } from 'crypto'

export async function GET() {
  const checks: Record<string, unknown> = {}

  // Check 1: env vars
  const appId = process.env.ENABLEBANKING_APP_ID
  const keyB64 = process.env.ENABLEBANKING_PRIVATE_KEY_BASE64
  checks.app_id_set = !!appId
  checks.app_id_value = appId ? appId.substring(0, 8) + '...' : 'MISSING'
  checks.key_b64_set = !!keyB64
  checks.key_b64_length = keyB64?.length || 0

  // Check 2: decode key
  let privateKey = ''
  try {
    if (keyB64) {
      privateKey = Buffer.from(keyB64, 'base64').toString('utf-8')
      checks.key_decoded = true
      checks.key_starts_with = privateKey.substring(0, 30)
      checks.key_length = privateKey.length
    } else {
      checks.key_decoded = false
      checks.key_error = 'No base64 key in env'
    }
  } catch (e: unknown) {
    checks.key_decoded = false
    checks.key_error = e instanceof Error ? e.message : String(e)
  }

  // Check 3: generate JWT
  let jwt = ''
  try {
    function base64url(data: string): string {
      return Buffer.from(data).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
    }
    const now = Math.floor(Date.now() / 1000)
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: appId }))
    const payload = base64url(JSON.stringify({ iss: appId, aud: 'api.enablebanking.com', iat: now, exp: now + 3600 }))
    const sign = createSign('RSA-SHA256')
    sign.update(`${header}.${payload}`)
    const signature = sign.sign(privateKey, 'base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
    jwt = `${header}.${payload}.${signature}`
    checks.jwt_generated = true
    checks.jwt_length = jwt.length
  } catch (e: unknown) {
    checks.jwt_generated = false
    checks.jwt_error = e instanceof Error ? e.message : String(e)
  }

  // Check 4: call Enable Banking API
  if (jwt) {
    try {
      const res = await fetch('https://api.enablebanking.com/aspsps?country=NL', {
        headers: { 'Authorization': `Bearer ${jwt}` }
      })
      const text = await res.text()
      checks.api_status = res.status
      checks.api_response_length = text.length
      if (res.status === 200) {
        const data = JSON.parse(text)
        checks.api_banks_count = data.aspsps?.length || 0
        checks.api_first_bank = data.aspsps?.[0]?.name || 'none'
      } else {
        checks.api_error = text.substring(0, 300)
      }
    } catch (e: unknown) {
      checks.api_call_failed = true
      checks.api_error = e instanceof Error ? e.message : String(e)
    }
  }

  return NextResponse.json(checks, { status: 200 })
}
