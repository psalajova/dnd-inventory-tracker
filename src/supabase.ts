import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseAnonKey === 'PASTE_YOUR_ANON_KEY_HERE') {
  throw new Error('Copy .env.example to .env.local and add your Supabase anon key.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
