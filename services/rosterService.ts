import { api } from './api';
import { ApiResponse, Roster } from '../types';

export const rosterService = {
  async get(params: { site_id?: string; start?: string; end?: string }): Promise<ApiResponse<Roster[]>> {
    const qs: string[] = [];
    if (params.site_id) qs.push(`site_id=${encodeURIComponent(params.site_id)}`);
    if (params.start) qs.push(`start=${encodeURIComponent(params.start)}`);
    if (params.end) qs.push(`end=${encodeURIComponent(params.end)}`);
    const path = '/rosters' + (qs.length ? `?${qs.join('&')}` : '');
    return api.get<Roster[]>(path);
  },
  async assign(data: Partial<Roster> & { guard_id: string; shift_date: string; shift_type: 'day'|'night'|'swing'; status?: 'scheduled'|'present'|'absent'|'on_leave' }): Promise<ApiResponse<Roster>> {
    return api.post<Roster>('/rosters', data);
  }
};
