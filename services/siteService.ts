import { api } from './api';
import { Site, ApiResponse } from '../types';

export const siteService = {
  /**
   * Fetches all operational sites for the current company.
   */
  async getSites(): Promise<ApiResponse<Site[]>> {
    return api.get<Site[]>('/sites');
  },

  /**
   * Registers a new duty station.
   */
  async createSite(data: Partial<Site>): Promise<ApiResponse<Site>> {
    return api.post<Site>('/sites', data);
  },

  /**
   * Updates site parameters (e.g., Geofence radius).
   */
  async updateSite(id: string, data: Partial<Site>): Promise<ApiResponse<Site>> {
    return api.patch<Site>(`/sites/${id}`, data);
  },

  /**
   * Assigns or shifts a supervisor to a site.
   */
  async assignSupervisor(siteId: string, supervisorId: string): Promise<ApiResponse<Site>> {
    return api.post<Site>(`/sites/${siteId}/assign-supervisor`, { supervisor_id: supervisorId });
  }
};