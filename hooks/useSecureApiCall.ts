import { useCallback } from 'react';
import { api } from '../services/api';

export type SecureErrorCode = 'TOKEN_MISSING' | 'UNAUTHORIZED' | 'NETWORK_ERROR' | 'SERVER_ERROR' | 'UNKNOWN';

export interface SecureError {
  code: SecureErrorCode;
  message: string;
  detail?: any;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function useSecureApiCall() {
  const hasToken = () => {
    if (typeof window === 'undefined') return false;
    return !!(localStorage.getItem('amini_auth_token') || localStorage.getItem('token'));
  };

  const call = useCallback(async <T>(method: 'GET'|'POST'|'PATCH'|'DELETE', path: string, body?: any): Promise<{ data?: T; error?: SecureError }> => {
    if (!hasToken()) {
      return { error: { code: 'TOKEN_MISSING', message: 'Session not found. Please log in again.' } };
    }
    const max = 3;
    for (let i = 0; i < max; i++) {
      const backoff = Math.pow(2, i) * 200;
      try {
        let res;
        if (method === 'GET') res = await api.get<T>(path);
        else if (method === 'POST') res = await api.post<T>(path, body);
        else if (method === 'PATCH') res = await api.patch<T>(path, body);
        else res = await api.delete<T>(path);
        if (res.data !== undefined) return { data: res.data };
        if (res.error) {
          // Do not logout; map to friendly error
          const msg = String(res.error || '');
          if (/unauthorized/i.test(msg)) {
            // Avoid breaking the session; surface soft error
            return { error: { code: 'UNAUTHORIZED', message: 'Session expired. Please re-authenticate.', detail: msg } };
          }
          if (/network/i.test(msg)) {
            // transient; retry up to max
            if (i < max - 1) { await sleep(backoff); continue; }
            return { error: { code: 'NETWORK_ERROR', message: 'Network issue. Please retry.', detail: msg } };
          }
          // server or validation errors
          return { error: { code: 'SERVER_ERROR', message: msg, detail: msg } };
        }
      } catch (e: any) {
        const isNet = String(e?.message || '').toLowerCase().includes('network');
        if (isNet && i < max - 1) { await sleep(backoff); continue; }
        return { error: { code: isNet ? 'NETWORK_ERROR' : 'UNKNOWN', message: isNet ? 'Network issue. Please retry.' : 'Unexpected error', detail: e?.message || e } };
      }
    }
    return { error: { code: 'UNKNOWN', message: 'Unexpected error' } };
  }, []);

  return { call };
}

