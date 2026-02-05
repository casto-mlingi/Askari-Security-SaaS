/// <reference types="vite/client" />

declare module 'vite/client' {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
    readonly VITE_TEST_AI?: string
    // Add other environment variables here as needed
  }
}

declare global {
  interface Window {
    _aminiDiagnosticsRun?: boolean;
    _lastAICall?: number;
  }
}