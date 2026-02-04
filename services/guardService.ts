import { api } from './api';
import { Guard, ApiResponse, ApplicationStatus } from '../types';

export const guardService = {
  /**
   * Fetches all guards for the current tenant.
   */
  async getGuards(): Promise<ApiResponse<Guard[]>> {
    return api.get<Guard[]>('/guards');
  },

  /**
   * Fetches a single guard by ID.
   */
  async getGuardById(id: string): Promise<ApiResponse<Guard>> {
    return api.get<Guard>(`/guards/${id}`);
  },

  /**
   * Creates a new guard application record.
   */
  async createGuard(data: Partial<Guard>): Promise<ApiResponse<Guard>> {
    return api.post<Guard>('/guards', data);
  },

  /**
   * Updates an existing guard record.
   */
  async updateGuard(id: string, data: Partial<Guard>): Promise<ApiResponse<Guard>> {
    return api.patch<Guard>(`/guards/${id}`, data);
  },

  /**
   * Transitions a guard through the vetting workflow.
   */
  async updateStatus(id: string, status: ApplicationStatus, metadata?: any): Promise<ApiResponse<Guard>> {
    return api.post<Guard>(`/guards/${id}/status`, { status, ...metadata });
  },

  /**
   * Deletes a guard record (Admin only).
   */
  async deleteGuard(id: string): Promise<ApiResponse<void>> {
    return api.delete<void>(`/guards/${id}`);
  }
};