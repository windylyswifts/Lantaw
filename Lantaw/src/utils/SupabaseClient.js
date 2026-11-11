import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fail-fast validation: Alerts you immediately if .env is missing or misconfigured
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.');
}

// Export a single instance to be reused across the entire application (Singleton pattern)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);