import { ApiResponse } from '../types';

const API_URL: string = (import.meta as any)?.env?.VITE_API_URL || 'https://api.amini.co.tz';
const API_BASE_URL: string = `${String(API_URL).replace(/\/+$/, '')}/api`;

export const getApiBase = () => API_BASE_URL;

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (/^[\w.-]+:\d+/.test(path)) {
    const fixed = path.replace(/^\/+/, '');
    return `http://${fixed}`;
  }
  const base = API_BASE_URL.replace(/\/+$/, '');
  let p = String(path || '');
  if (!p.startsWith('/')) p = '/' + p;
  if (base.endsWith('/api') && p.startsWith('/api/')) {
    p = p.slice(4);
  } else if (base.endsWith('/api') && p === '/api') {
    p = '';
  }
  return `${base}${p}`;
}

class TokenManager {
  private token: string | null;
  private refreshing: Promise<string | null> | null = null;
  constructor() {
    this.token = (typeof window !== 'undefined'
      ? (localStorage.getItem('amini_auth_token') || localStorage.getItem('token'))
      : null) || null;
  }
  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = (localStorage.getItem('amini_auth_token') || localStorage.getItem('token')) || null;
    }
    return this.token;
  }
  setToken(t: string | null) {
    this.token = t;
    if (typeof window !== 'undefined') {
      if (t) {
        localStorage.setItem('amini_auth_token', t);
        localStorage.setItem('token', t);
      } else {
        localStorage.removeItem('amini_auth_token');
        localStorage.removeItem('token');
      }
    }
  }
  getAuthHeader(): Record<string, string> {
    const t = this.getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  }
  logout() {
    this.setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('amini_auth_token');
      localStorage.removeItem('token');
      sessionStorage.clear();
      window.location.href = '/login';
    }
  }

  async refresh(): Promise<string | null> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      const attempts = 3;
      for (let i = 0; i < attempts; i++) {
        const backoff = Math.pow(2, i) * 200;
        try {
          const res = await fetch(buildUrl('/auth/refresh'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...this.getAuthHeader() }
          });
          if (res.ok) {
            const json: any = await res.json().catch(() => ({}));
            const t = json?.token || null;
            if (t) { this.setToken(t); return t; }
          } else if (res.status >= 400 && res.status < 500) {
            // Verified refresh failure - break immediately and logout
            this.logout();
            return null;
          }
        } catch { }
        await new Promise(r => setTimeout(r, backoff));
      }
      // If we reach here, we failed 3 network retries
      this.logout();
      return null;
    })();
    try {
      return await this.refreshing;
    } finally {
      this.refreshing = null;
    }
  }
}

const tokenManager = new TokenManager();

class ApiClient {
  private getHeaders(): HeadersInit {
    const token = tokenManager.getToken() || '';
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  }

  private async handleResponse<T>(response: Response, ctx?: { method: string; path: string; body?: any; retried?: boolean }): Promise<ApiResponse<T>> {
    let result: any = null;
    try {
      result = await response.json();
    } catch {
      return { error: 'Invalid server response' };
    }
    if (!response.ok) {
      if (response.status === 401 && ctx && !ctx.retried) {
        const newTok = await tokenManager.refresh();
        if (newTok) {
          try {
            const url = buildUrl(ctx.path);
            const res2 = await fetch(url, {
              method: ctx.method,
              headers: { 'Content-Type': 'application/json', ...tokenManager.getAuthHeader() },
              body: ctx.body != null ? JSON.stringify(ctx.body) : undefined
            });
            return this.handleResponse<T>(res2, { ...ctx, retried: true });
          } catch { }
        }
      }
      const msg = result?.detail || result?.message || result?.error || 'Request failed';
      return { error: msg };
    }
    return { data: result };
  }

  private async request<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: any, options?: { signal?: AbortSignal }): Promise<ApiResponse<T>> {
    try {
      const url = buildUrl(path);
      const response = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: body != null ? JSON.stringify(body) : undefined,
        signal: options?.signal,
      });
      return this.handleResponse<T>(response, { method, path, body, retried: false });
    } catch (error: any) {
      if (error?.name === 'AbortError') return { error: 'Request canceled' };
      return { error: 'Network failure. Please check your connection.' };
    }
  }

  async get<T>(path: string, options?: { signal?: AbortSignal }): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, undefined, options);
  }

  async post<T>(path: string, body: any, options?: { signal?: AbortSignal }): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body, options);
  }

  async patch<T>(path: string, body: any, options?: { signal?: AbortSignal }): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, body, options);
  }

  async delete<T>(path: string, options?: { signal?: AbortSignal }): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, undefined, options);
  }
}

export const api = new ApiClient();
