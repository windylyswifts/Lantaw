import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Safe Initialization: Instead of throwing a fatal error that white-screens the app,
// we log a clear console error. This allows React to mount properly.
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('🚨 CRITICAL: Missing Supabase environment variables. The database will not connect.');
}

// Export the client if variables exist, otherwise export null to prevent crashing
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;