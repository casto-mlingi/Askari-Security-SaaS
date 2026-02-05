import { createClient } from '@supabase/supabase-js';

// Load keys from .env.local
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Safety check to ensure keys exist
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase keys are missing! Check your .env.local file.');
}

// Export the connection to be used throughout the app
export const supabase = createClient(
  supabaseUrl || '', 
  supabaseAnonKey || ''
);