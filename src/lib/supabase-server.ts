import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client using service role key
// This bypasses RLS — ONLY use in API routes, NEVER in client components
// Will be replaced with per-user auth context when NextAuth is added

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  // In build/static generation, env vars may not be available — that's OK
  // They'll be available at runtime on Vercel
  console.warn('Supabase env vars not set — API routes will fail at runtime')
}

export function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL')
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Demo user ID — will be replaced by real auth
// This is the user we created in Supabase Auth for development
export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'
