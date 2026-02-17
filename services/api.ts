import { ApiResponse } from '../types';

/**
 * Base URL for the AMINI Backend.
 * In production, this would be an environment variable (e.g., process.env.API_URL).
 */
const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || 'http://localhost:3001/api';

class ApiClient {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('amini_auth_token') || localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    if (response.status === 401) {
      localStorage.removeItem('amini_auth_token');
    }
    let result: any = null;
    try {
      result = await response.json();
    } catch {
      return { error: 'Invalid server response' };
    }
    if (!response.ok) {
      const msg = result?.message || result?.error || 'Request failed';
      return { error: msg };
    }
    return { data: result };
  }

  async get<T>(path: string, options?: { signal?: AbortSignal }): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
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
      const response = await fetch(`${API_BASE_URL}${path}`, {
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
      const response = await fetch(`${API_BASE_URL}${path}`, {
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
      const response = await fetch(`${API_BASE_URL}${path}`, {
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
