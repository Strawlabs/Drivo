import { createClient } from '@supabase/supabase-js'

/*
  SUPABASE CONNECTION
  ──────────────────
  These two values come from your Supabase project dashboard.
  We store them in a .env file (never commit .env to git).

  HOW TO GET THEM:
  1. Go to https://supabase.com → your project → Settings → API
  2. Copy "Project URL" → VITE_SUPABASE_URL
  3. Copy "anon public" key → VITE_SUPABASE_ANON_KEY

  WHY VITE_ PREFIX?
  Vite only exposes env variables to the browser if they start with VITE_.
  This prevents accidentally leaking server-only secrets.
*/
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
