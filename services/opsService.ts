import { api } from './api';
import { AttendanceLog, IncidentReport, KitIssuance, ApiResponse, LeaveRequest } from '../types';

export const opsService = {
  /**
   * Records a tactical check-in (Attendance).
   */
  async logAttendance(data: Partial<AttendanceLog>): Promise<ApiResponse<AttendanceLog>> {
    return api.post<AttendanceLog>('/ops/attendance', data);
  },

  /**
   * Files a new forensic incident report.
   */
  async reportIncident(data: Partial<IncidentReport>): Promise<ApiResponse<IncidentReport>> {
    return api.post<IncidentReport>('/ops/incidents', data);
  },

  /**
   * Commits an equipment issuance record.
   */
  async issueKit(data: Partial<KitIssuance>): Promise<ApiResponse<KitIssuance>> {
    return api.post<KitIssuance>('/ops/kit-issuance', data);
  },

  /**
   * Submits a leave request for a guard.
   */
  async requestLeave(data: Partial<LeaveRequest>): Promise<ApiResponse<LeaveRequest>> {
    return api.post<LeaveRequest>('/ops/leave-requests', data);
  },

  /**
   * Updates leave request status (Approved/Rejected).
   */
  async updateLeaveStatus(id: string, status: 'approved' | 'rejected'): Promise<ApiResponse<LeaveRequest>> {
    return api.patch<LeaveRequest>(`/ops/leave-requests/${id}`, { status });
  }
};