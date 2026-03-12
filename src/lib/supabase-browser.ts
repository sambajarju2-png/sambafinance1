import { createClient, type SupabaseClient } from '@supabase/supabase-js'
let _client: SupabaseClient | null = null
export function getSupabaseBrowser(): SupabaseClient {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase environment variables')
  _client = createClient(url, key)
  return _client
}
export const supabase = typeof window !== 'undefined' ? getSupabaseBrowser() : (null as unknown as SupabaseClient)
