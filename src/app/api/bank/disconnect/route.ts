import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { deleteRequisition } from '@/lib/gocardless'

export async function POST(req: NextRequest) {
  try {
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
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          setAll(_cookies) {}
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

    // Verify this connection belongs to the user
    const { data: connection } = await supabase
      .from('bank_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('user_id', user.id)
      .single()

    if (!connection) {
      return NextResponse.json({ error: 'Bankverbinding niet gevonden' }, { status: 404 })
    }

    // Delete requisition from GoCardless (best effort)
    try {
      await deleteRequisition(connection.requisition_id)
    } catch (err) {
      console.error('[Bank] Failed to delete requisition from GoCardless:', err)
      // Continue anyway — we still want to remove from our DB
    }

    // Delete transactions first (FK constraint)
    await supabase
      .from('bank_transactions')
      .delete()
      .eq('connection_id', connection_id)

    // Delete the connection
    await supabase
      .from('bank_connections')
      .delete()
      .eq('id', connection_id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Bank] Disconnect error:', error)
    return NextResponse.json({ error: 'Kon bankverbinding niet verwijderen' }, { status: 500 })
  }
}
