import { ApiResponse } from '../types';

/**
 * Base URL for the Askari Backend.
 * In production, this would be an environment variable (e.g., process.env.API_URL).
 */
const API_BASE_URL = 'https://api.askari-security.cloud/v1';

class ApiClient {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('askari_auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    if (response.status === 401) {
      // Handle unauthorized session
      localStorage.removeItem('askari_auth_token');
      // In a real app, you might trigger a redirect or a context update
    }

    const result = await response.json();
    
    if (!response.ok) {
      return { error: result.message || 'An unexpected error occurred during the request.' };
    }

    return { data: result };
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      return { error: 'Network failure. Please check your connection.' };
    }
  }

  async post<T>(path: string, body: any): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      return { error: 'Network failure. Please check your connection.' };
    }
  }

  async patch<T>(path: string, body: any): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      return { error: 'Network failure. Please check your connection.' };
    }
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      return { error: 'Network failure. Please check your connection.' };
    }
  }
}

export const api = new ApiClient();