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

class ApiClient {
  private getHeaders(): HeadersInit {
    const token = (typeof window !== 'undefined' ? (localStorage.getItem('amini_auth_token') || localStorage.getItem('token')) : null) || '';
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    if (response.status === 401 && typeof window !== 'undefined') {
      try { localStorage.removeItem('amini_auth_token'); } catch {}
    }
    let result: any = null;
    try {
      result = await response.json();
    } catch {
      return { error: 'Invalid server response' };
    }
    if (!response.ok) {
      const msg = result?.detail || result?.message || result?.error || 'Request failed';
      return { error: msg };
    }
    return { data: result };
  }

  async get<T>(path: string, options?: { signal?: AbortSignal }): Promise<ApiResponse<T>> {
    try {
      const url = buildUrl(path);
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: options?.signal,
      });
      return this.handleResponse<T>(response);
    } catch (error: any) {
      if (error?.name === 'AbortError') return { error: 'Request canceled' };
      return { error: 'Network failure. Please check your connection.' };
    }
  }

  async post<T>(path: string, body: any, options?: { signal?: AbortSignal }): Promise<ApiResponse<T>> {
    try {
      const url = buildUrl(path);
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: options?.signal,
      });
      return this.handleResponse<T>(response);
    } catch (error: any) {
      if (error?.name === 'AbortError') return { error: 'Request canceled' };
      return { error: 'Network failure. Please check your connection.' };
    }
  }

  async patch<T>(path: string, body: any, options?: { signal?: AbortSignal }): Promise<ApiResponse<T>> {
    try {
      const url = buildUrl(path);
      const response = await fetch(url, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: options?.signal,
      });
      return this.handleResponse<T>(response);
    } catch (error: any) {
      if (error?.name === 'AbortError') return { error: 'Request canceled' };
      return { error: 'Network failure. Please check your connection.' };
    }
  }

  async delete<T>(path: string, options?: { signal?: AbortSignal }): Promise<ApiResponse<T>> {
    try {
      const url = buildUrl(path);
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(),
        signal: options?.signal,
      });
      return this.handleResponse<T>(response);
    } catch (error: any) {
      if (error?.name === 'AbortError') return { error: 'Request canceled' };
      return { error: 'Network failure. Please check your connection.' };
    }
  }
}

export const api = new ApiClient();
