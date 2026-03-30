import { api, getApiBase } from './api';
import { Guard, ApiResponse, EducationRecord, Guarantor, ResubmitRequest } from '../types';

export const guardService = {
  /**
   * Fetches all guards for the current tenant, INCLUDING related data.
   */
  async getGuards(): Promise<ApiResponse<Guard[]>> {
    const result = await api.get<Guard[]>('/guards');
    if (result.error) {
      const local = JSON.parse(localStorage.getItem('guards_local') || '[]');
      if (local.length > 0) return { data: local as Guard[] };
      return { error: result.error };
    }
    return { data: (result.data || []) as Guard[] };
  },

  /**
   * Fetches a single guard by ID with FULL profile details.
   */
  async getGuardById(id: string): Promise<ApiResponse<Guard>> {
    const result = await api.get<Guard>(`/guards/${id}`);
    if (result.error || !result.data) return { error: result.error || 'Not found' };
    return { data: result.data as Guard };
  },

  /**
   * Creates a new guard application record.
   */
  async createGuard(guardData: Partial<Guard>): Promise<ApiResponse<Guard>> {
    // Ensure we're only sending fields that exist in the guards table
    // Strip out nested arrays and computed fields that don't belong in the guards table
    const {
      education_history,
      guarantors,
      // These are computed/derived fields that shouldn't be inserted
      created_at,
      updated_at,
      consecutive_absences, // Has default
      profile_score, // Has default
      performance_score, // Has default
      is_armed, // Has default
      has_signed_contract, // Has default
      // These are top-level arrays in types but not in DB
      ...coreGuardFields
    } = guardData;

    const result = await api.post<Guard>('/guards', coreGuardFields);
    if (result.error || !result.data) {
      const hasToken = !!(localStorage.getItem('amini_auth_token') || localStorage.getItem('token'));
      if (hasToken) {
        // Authenticated HR path: do NOT generate a local fallback ID.
        return { error: result.error || 'Create failed' };
      }
      const infoFields = [
        coreGuardFields['full_name'], coreGuardFields['nida_number'], coreGuardFields['phone'], coreGuardFields['dob'],
        coreGuardFields['gender'], coreGuardFields['next_of_kin_name'], coreGuardFields['next_of_kin_phone'],
        coreGuardFields['next_of_kin_relationship'], coreGuardFields['residence_lat'], coreGuardFields['residence_lng']
      ];
      const docFields = [
        coreGuardFields['application_letter_url'], coreGuardFields['nida_front_url'], coreGuardFields['birth_cert_url'],
        coreGuardFields['residence_letter_url'], coreGuardFields['medical_report_url'], coreGuardFields['police_clearance_url'], coreGuardFields['cv_url'],
        coreGuardFields['passport_photo_url'], coreGuardFields['previous_employer_letter_url'],
        coreGuardFields['employment_contract_url']
      ];
      const totalFields = infoFields.length + docFields.length;
      const providedCount = [...infoFields, ...docFields].reduce<number>((acc, v) => {
        const isProvided = v !== null && v !== undefined && (typeof v === 'number' ? true : String(v).trim() !== '');
        return acc + (isProvided ? 1 : 0);
      }, 0);
      const readinessScore = totalFields > 0 ? Math.round((providedCount / totalFields) * 100) : 0;

      const localGuard = {
        id: `g-${Date.now()}`,
        nida_number: coreGuardFields.nida_number || `LOCAL-${Date.now()}`,
        full_name: coreGuardFields.full_name || 'New Guard',
        dob: coreGuardFields.dob || '2000-01-01',
        profile_score: typeof (guardData as any).profile_score === 'number' ? (guardData as any).profile_score : 0,
        performance_score: typeof (guardData as any).performance_score === 'number' ? (guardData as any).performance_score : 100,
        readiness_score: readinessScore,
        status: (coreGuardFields as any).status || 'draft',
        current_site_id: coreGuardFields.current_site_id,
        assigned_supervisor_id: coreGuardFields.assigned_supervisor_id,
        company_id: coreGuardFields.company_id,
        phone: coreGuardFields.phone,
        dossier_data: coreGuardFields['dossier_data'] || {},
        education_history: [],
        guarantors: [],
        next_of_kin_name: coreGuardFields['next_of_kin_name'],
        next_of_kin_phone: coreGuardFields['next_of_kin_phone'],
        next_of_kin_relationship: coreGuardFields['next_of_kin_relationship'],
        nida_front_url: coreGuardFields['nida_front_url'],
        birth_cert_url: coreGuardFields['birth_cert_url'],
        application_letter_url: coreGuardFields['application_letter_url'],
        residence_letter_url: coreGuardFields['residence_letter_url'],
        medical_report_url: coreGuardFields['medical_report_url'],
        police_clearance_url: coreGuardFields['police_clearance_url'],
        cv_url: coreGuardFields['cv_url'],
        passport_photo_url: coreGuardFields['passport_photo_url'],
        agreed_salary: coreGuardFields['agreed_salary'],
        contract_start_date: coreGuardFields['contract_start_date'],
        contract_end_date: coreGuardFields['contract_end_date'],
        has_signed_contract: coreGuardFields['has_signed_contract'],
        employment_contract_url: coreGuardFields['employment_contract_url'],
        current_shift: coreGuardFields['current_shift'],
        leave_return_date: coreGuardFields['leave_return_date'],
        consecutive_absences: coreGuardFields['consecutive_absences'] ?? 0,
        residence_lat: coreGuardFields['residence_lat'],
        residence_lng: coreGuardFields['residence_lng'],
        is_armed: coreGuardFields['is_armed'] ?? false,
        weapon_qualification: coreGuardFields['weapon_qualification'],
        nssf_number: coreGuardFields['nssf_number'],
        bank_account_number: coreGuardFields['bank_account_number'],
        experience_years: coreGuardFields['experience_years'],
        created_at: new Date().toISOString()
      } as Guard;
      const existing = JSON.parse(localStorage.getItem('guards_local') || '[]');
      localStorage.setItem('guards_local', JSON.stringify([localGuard, ...existing]));
      return { data: localGuard };
    }
    return { data: result.data as Guard };
  },

  /**
   * Updates an existing guard record.
   */
  async updateGuard(id: string, updates: Partial<Guard>): Promise<ApiResponse<Guard>> {
    // Strip out nested arrays and fields that don't belong in the guards table
    const {
      education_history,
      guarantors,
      created_at,
      updated_at,
      id: guardId, // Don't update the ID
      ...coreGuardFields
    } = updates;

    const result = await api.patch<Guard>(`/guards/${id}`, coreGuardFields);
    if (result.error || !result.data) return { error: result.error || 'Update failed' };
    return { data: result.data as Guard };
  },

  /**
   * Transitions a guard through the vetting workflow.
   */
  async updateStatus(id: string, status: 'draft' | 'pending_approval' | 'marketplace' | 'interviewing' | 'active' | 'blacklisted', metadata?: any): Promise<ApiResponse<Guard>> {
    const updatePayload: any = { status };

    if (metadata) {
      updatePayload.dossier_data = metadata;
    }

    const result = await api.patch<Guard>(`/guards/${id}`, updatePayload);
    if (result.error || !result.data) return { error: result.error || 'Update failed' };
    return { data: result.data as Guard };
  },

  /**
   * Deletes a guard record (Admin only).
   */
  async deleteGuard(id: string): Promise<ApiResponse<void>> {
    const result = await api.delete<void>(`/guards/${id}`);
    if (result.error) return { error: result.error };
    return { data: undefined };
  },

  /**
   * Creates education records for a guard.
   */
  async createEducationRecords(guardId: string, records: EducationRecord[]): Promise<ApiResponse<void>> {
    try {
      const payload = Array.isArray(records) ? records.map(r => ({
        institution_name: (r as any).institution_name || null,
        level: r.level,
        graduation_year: r.year ? Number(r.year) : null,
        certificate_url: r.certificate_url || null
      })) : [];
      await api.post(`/guards/${guardId}/education_records`, payload);
      return { data: undefined };
    } catch (e) {
      return { error: String((e as any)?.message || 'Failed to save education records') };
    }
  },

  /**
   * Creates guarantors for a guard.
   */
  async createGuarantors(guardId: string, guarantors: Guarantor[]): Promise<ApiResponse<void>> {
    try {
      const payload = Array.isArray(guarantors) ? guarantors.map(g => ({
        full_name: g.name,
        occupation: (g as any)?.occupation || null,
        phone: g.phone,
        relationship: g.relationship,
        id_copy_url: (g as any)?.id_copy_url || null,
        guarantor_letter_url: g.guarantor_letter_url || null,
        residence_letter_url: (g as any)?.residence_letter_url || null
      })) : [];
      await api.post(`/guards/${guardId}/guarantors`, payload);
      return { data: undefined };
    } catch (e) {
      return { error: String((e as any)?.message || 'Failed to save guarantors') };
    }
  },

  /**
   * Updates education records for a guard (deletes existing and creates new).
   */
  async updateEducationRecords(guardId: string, records: EducationRecord[]): Promise<ApiResponse<void>> {
    return this.createEducationRecords(guardId, records);
  },

  /**
   * Updates guarantors for a guard (deletes existing and creates new).
   */
  async updateGuarantors(guardId: string, guarantors: Guarantor[]): Promise<ApiResponse<void>> {
    return this.createGuarantors(guardId, guarantors);
  },

  async updateResubmitRequest(_id: string, _status: 'approved' | 'rejected'): Promise<ApiResponse<ResubmitRequest>> {
    return { error: 'Not implemented' };
  }
};
