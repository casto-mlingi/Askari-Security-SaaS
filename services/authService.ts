import { api } from './api';
import { AuthSession, ApiResponse, UserRole } from '../types';

export const authService = {
  /**
   * Performs the login operation. 
   * In a real implementation, this would communicate with Google Cloud Identity or a custom Auth endpoint.
   */
  async login(email: string, pass: string): Promise<ApiResponse<AuthSession>> {
    // This is the structure for the real API call
    // return api.post<AuthSession>('/auth/login', { email, pass });

    // For the purpose of this Block transition, we mimic the latency
    await new Promise(resolve => setTimeout(resolve, 800));

    // Hardcoded logic for demo purposes (to be replaced by real endpoint)
    if (email && pass === 'pass123') {
      const mockSession: AuthSession = {
        token: 'ey-mock-token-' + Date.now(),
        user: {
          id: 'u-prod-' + Math.random().toString(36).substr(2, 9),
          full_name: 'Production Administrator',
          role: UserRole.COMPANY_ADMIN,
          email: email,
          company_id: 'c-askari-master',
          is_active: true,
          created_at: new Date().toISOString()
        },
        expires_at: new Date(Date.now() + 86400000).toISOString() // 24h
      };

      localStorage.setItem('askari_auth_token', mockSession.token);
      localStorage.setItem('askari_user', JSON.stringify(mockSession.user));

      return { data: mockSession };
    }

    return { error: 'Authentication failed. Please check your credentials.' };
  },

  async logout(): Promise<void> {
    // return api.post('/auth/logout', {});
    localStorage.removeItem('askari_auth_token');
    localStorage.removeItem('askari_user');
  },

  getCurrentUser(): any {
    const user = localStorage.getItem('askari_user');
    return user ? JSON.parse(user) : null;
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('askari_auth_token');
  }
};