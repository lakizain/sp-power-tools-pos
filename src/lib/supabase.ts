import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''

let supabaseInstance: SupabaseClient<Database> | null = null

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
  } catch (e) {
    console.error('[supabase] Failed to create client:', e)
  }
} else {
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. ' +
    'Please set them in Vercel Project Settings → Environment Variables and redeploy.'
  )
}

export const supabase = supabaseInstance as SupabaseClient<Database>

export let supabaseAdmin: SupabaseClient<Database> | null = null

if (supabaseUrl && supabaseServiceRoleKey) {
  try {
    supabaseAdmin = createClient<Database>(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  } catch (e) {
    console.error('[supabase] Failed to create admin client:', e)
  }
}
