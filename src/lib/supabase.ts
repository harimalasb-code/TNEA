import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// persistSession: false — no auth tokens or session state is written to
// localStorage. Combined with the in-memory AuthContext, a page refresh
// always starts with no user and no session data (requirement #2).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

// Clear any leftover Supabase keys from a previous session that might
// have been written before persistSession was disabled.
for (const key of Object.keys(localStorage)) {
  if (key.startsWith('sb-') || key.includes('supabase')) {
    localStorage.removeItem(key)
  }
}
