import { createClient } from '@supabase/supabase-js';

// Load keys from .env.local
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const readOnlyOverride = import.meta.env.VITE_READ_ONLY;
export const READ_ONLY =
  readOnlyOverride === 'true'
    ? true
    : readOnlyOverride === 'false'
      ? false
      : (import.meta.env.PROD ?? false);

// Safety check to ensure keys exist
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase keys are missing! Check your .env.local file.');
}

// Export the connection to be used throughout the app
export const supabase = createClient(
  supabaseUrl || '', 
  supabaseAnonKey || ''
);

// Dev-only interceptor for Supabase REST requests
if (typeof window !== 'undefined' && import.meta.env.DEV && supabaseUrl) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    const method = (init?.method || (typeof input !== 'string' ? (input as Request).method : 'GET') || 'GET').toUpperCase();
    const isSupabase = url?.startsWith(supabaseUrl);

    if (!isSupabase) {
      return originalFetch(input as any, init as any);
    }

    let table = 'unknown';
    let op = method;
    try {
      const u = new URL(url!);
      const parts = u.pathname.split('/').filter(Boolean);
      const restIdx = parts.findIndex(p => p === 'rest');
      if (restIdx !== -1 && parts[restIdx + 2]) {
        table = parts[restIdx + 2];
      } else if (parts.includes('auth')) {
        table = 'auth';
      }
    } catch {}

    if (method === 'GET') op = 'SELECT';
    if (method === 'POST') op = 'INSERT/UPSERT';
    if (method === 'PATCH') op = 'UPDATE';
    if (method === 'DELETE') op = 'DELETE';

    let payload: any = undefined;
    try {
      if (init?.body && typeof init.body === 'string') {
        payload = JSON.parse(init.body);
      }
    } catch {
      payload = init?.body;
    }

    console.log('🛰️ Supabase Request:', { table, op, url, payload });

    const response = await originalFetch(input as any, init as any);
    try {
      const clone = response.clone();
      const text = await clone.text();
      let parsed: any = undefined;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
      }
      if (!response.ok) {
        console.error('🔥 Supabase Error:', { status: response.status, statusText: response.statusText, table, op, body: parsed });
      } else {
        console.log('✅ Supabase Response:', { status: response.status, table, op });
      }
    } catch {
      // ignore body parsing errors
    }

    return response;
  };
}
