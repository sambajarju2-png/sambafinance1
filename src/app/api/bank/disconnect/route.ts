import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { deleteSession } from '@/lib/enablebanking'
import { verifyCsrf } from '@/lib/csrf'
import { log } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    await verifyCsrf()
    const { connection_id } = await req.json()
    if (!connection_id) {
      return NextResponse.json({ error: 'connection_id is verplicht' }, { status: 400 })
    }

    const cookieHeader = req.headers.get('cookie')
    const userClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            if (!cookieHeader) return []
            return cookieHeader.split(';').map(c => {
              const [name, ...rest] = c.trim().split('=')
              return { name, value: rest.join('=') }
            })
          },
          setAll() {}
        }
      }
    )

    const { data: { user } } = await userClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: conn } = await supabase
      .from('bank_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('user_id', user.id)
      .single()

    if (!conn) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    // Revoke Enable Banking session
    if (conn.agreement_id) {
      try { await deleteSession(conn.agreement_id) } catch { /* best effort */ }
    }

    await supabase.from('bank_transactions').delete().eq('connection_id', connection_id).eq('user_id', user.id)
    await supabase.from('bank_connections').delete().eq('id', connection_id).eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Bank] Disconnect error:', error)
    return NextResponse.json({ error: 'Kon niet ontkoppelen' }, { status: 500 })
  }
}
