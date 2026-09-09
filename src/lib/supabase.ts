import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Database } from './database.types'

const supabaseUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceRoleKey: string | undefined = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

export const isSupabaseConfigured: boolean = !!(supabaseUrl && supabaseAnonKey)

export function getMissingSupabaseEnvMessage(): string | null {
  const missing: string[] = []
  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL')
  if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY')
  if (missing.length === 0) return null
  return `Missing environment variables: ${missing.join(', ')}. ` +
    `Please add them in Vercel → Project Settings → Environment Variables, then Redeploy.`
}

let supabaseInstance: SupabaseClient<Database> | null = null
let supabaseInitError: Error | null = null

function initSupabase(): SupabaseClient<Database> {
  if (supabaseInstance) return supabaseInstance
  if (supabaseInitError) throw supabaseInitError

  if (!supabaseUrl || !supabaseAnonKey) {
    const msg = getMissingSupabaseEnvMessage() || 'Supabase environment variables are missing.'
    supabaseInitError = new Error(msg)
    console.warn('[supabase] ' + msg)
    throw supabaseInitError
  }

  try {
    supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
    return supabaseInstance
  } catch (e) {
    supabaseInitError = e instanceof Error ? e : new Error(String(e))
    console.error('[supabase] Failed to create client:', supabaseInitError)
    throw supabaseInitError
  }
}

export function getSupabaseOrNull(): SupabaseClient<Database> | null {
  try {
    return initSupabase()
  } catch {
    return null
  }
}

export const supabase = new Proxy<SupabaseClient<Database>>({} as any, {
  get(_target, prop) {
    const client = initSupabase()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  }
})

let supabaseAdminInstance: SupabaseClient<Database> | null = null
let supabaseAdminResolved = false

function initSupabaseAdmin(): SupabaseClient<Database> | null {
  if (supabaseAdminResolved) return supabaseAdminInstance
  supabaseAdminResolved = true
  if (!supabaseUrl || !supabaseServiceRoleKey) return null
  try {
    supabaseAdminInstance = createClient<Database>(
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
    supabaseAdminInstance = null
  }
  return supabaseAdminInstance
}

export function getSupabaseAdmin(): SupabaseClient<Database> | null {
  return initSupabaseAdmin()
}

export const supabaseAdmin = new Proxy<SupabaseClient<Database>>({} as SupabaseClient<Database>, {
  get(_target, prop, receiver) {
    const client = initSupabaseAdmin()
    if (!client) {
      if (prop === Symbol.toPrimitive) return () => 'null'
      if (prop === 'then') return undefined
      if (prop === 'toString') return () => 'null'
      return undefined
    }
    const value = (client as any)[prop]
    if (typeof value === 'function') return value.bind(client)
    return value
  },
  getPrototypeOf() {
    return Object.getPrototypeOf(initSupabaseAdmin() || {})
  },
  ownKeys() {
    const c = initSupabaseAdmin()
    return c ? Object.keys(c) : []
  },
  getOwnPropertyDescriptor(_target, prop) {
    const c = initSupabaseAdmin()
    if (!c) return undefined
    return Object.getOwnPropertyDescriptor(c, prop)
  }
})
