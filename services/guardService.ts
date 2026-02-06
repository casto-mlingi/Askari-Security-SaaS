import { supabase } from './supabaseClient';
import { Guard, ApiResponse, ApplicationStatus, EducationRecord, Guarantor, ResubmitRequest } from '../types';

export const guardService = {
  /**
   * Fetches all guards for the current tenant, INCLUDING related data.
   */
  async getGuards(): Promise<ApiResponse<Guard[]>> {
    const { data, error } = await supabase
      .from('guards')
      .select(`
        *,
        guarantors(*),
        education_history:education_records(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      const local = JSON.parse(localStorage.getItem('guards_local') || '[]');
      if (local.length > 0) return { data: local as Guard[] };
      return { error: error.message };
    }

    // Cast raw Supabase data to your Guard type
    return { data: data as unknown as Guard[] };
  },

  /**
   * Fetches a single guard by ID with FULL profile details.
   */
  async getGuardById(id: string): Promise<ApiResponse<Guard>> {
    const { data, error } = await supabase
      .from('guards')
      .select(`
        *,
        guarantors(*),
        education_history:education_records(*)
      `)
      .eq('id', id)
      .single();

    if (error) return { error: error.message };
    
    return { data: data as unknown as Guard };
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

    // Default application status: move new submissions directly to pool applicants
    if (!('application_status' in coreGuardFields) || !coreGuardFields.application_status) {
      coreGuardFields.application_status = ApplicationStatus.POOL_APPLICANT;
    }

    const { data, error } = await supabase
      .from('guards')
      .insert([coreGuardFields])
      .select()
      .single();

    if (error) {
      const localGuard = {
        id: `g-${Date.now()}`,
        nida_number: coreGuardFields.nida_number || `LOCAL-${Date.now()}`,
        full_name: coreGuardFields.full_name || 'New Guard',
        dob: coreGuardFields.dob || '2000-01-01',
        profile_score: typeof (guardData as any).profile_score === 'number' ? (guardData as any).profile_score : 0,
        performance_score: typeof (guardData as any).performance_score === 'number' ? (guardData as any).performance_score : 100,
        application_status: coreGuardFields.application_status as ApplicationStatus,
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

    return { data: data as unknown as Guard };
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

    const { data, error } = await supabase
      .from('guards')
      .update(coreGuardFields)
      .eq('id', id)
      .select()
      .single();

    if (error) return { error: error.message };

    return { data: data as unknown as Guard };
  },

  /**
   * Transitions a guard through the vetting workflow.
   */
  async updateStatus(id: string, status: ApplicationStatus, metadata?: any): Promise<ApiResponse<Guard>> {
    
    const updatePayload: any = { application_status: status };

    if (metadata) {
      updatePayload.dossier_data = metadata;
    }

    const { data, error } = await supabase
      .from('guards')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) return { error: error.message };

    return { data: data as unknown as Guard };
  },

  /**
   * Deletes a guard record (Admin only).
   */
  async deleteGuard(id: string): Promise<ApiResponse<void>> {
    const { error } = await supabase
      .from('guards')
      .delete()
      .eq('id', id);

    if (error) return { error: error.message };

    return { data: undefined };
  },

  /**
   * Creates education records for a guard.
   */
  async createEducationRecords(guardId: string, records: EducationRecord[]): Promise<ApiResponse<void>> {
    if (records.length === 0) return { data: undefined };

    const payload = records.map(record => ({
      guard_id: guardId,
      level: record.level,
      year: record.year,
      certificate_url: record.certificate_url,
      weapon_proficiency: record.weapon_proficiency || null
    }));

    const { error } = await supabase
      .from('education_records')
      .insert(payload);

    if (error) return { error: error.message };
    return { data: undefined };
  },

  /**
   * Creates guarantors for a guard.
   */
  async createGuarantors(guardId: string, guarantors: Guarantor[]): Promise<ApiResponse<void>> {
    if (guarantors.length === 0) return { data: undefined };

    const payload = guarantors.map(guarantor => ({
      guard_id: guardId,
      name: guarantor.name,
      phone: guarantor.phone,
      relationship: guarantor.relationship,
      letter_url: guarantor.letter_url,
      residence_letter_url: guarantor.residence_letter_url
    }));

    const { error } = await supabase
      .from('guarantors')
      .insert(payload);

    if (error) return { error: error.message };
    return { data: undefined };
  },

  /**
   * Updates education records for a guard (deletes existing and creates new).
   */
  async updateEducationRecords(guardId: string, records: EducationRecord[]): Promise<ApiResponse<void>> {
    // First delete existing records
    const { error: deleteError } = await supabase
      .from('education_records')
      .delete()
      .eq('guard_id', guardId);

    if (deleteError) return { error: deleteError.message };

    // Then create new records
    return this.createEducationRecords(guardId, records);
  },

  /**
   * Updates guarantors for a guard (deletes existing and creates new).
   */
  async updateGuarantors(guardId: string, guarantors: Guarantor[]): Promise<ApiResponse<void>> {
    // First delete existing records
    const { error: deleteError } = await supabase
      .from('guarantors')
      .delete()
      .eq('guard_id', guardId);

    if (deleteError) return { error: deleteError.message };

    // Then create new records
    return this.createGuarantors(guardId, guarantors);
  },

  async updateResubmitRequest(id: string, status: 'approved' | 'rejected'): Promise<ApiResponse<ResubmitRequest>> {
    const { data: req, error: fetchError } = await supabase
      .from('resubmit_requests')
      .select('id, guard_id, company_id, reason, status, created_at, updated_at')
      .eq('id', id)
      .single();
    if (fetchError) return { error: fetchError.message };

    const { data: updated, error: updateErr } = await supabase
      .from('resubmit_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (updateErr) return { error: updateErr.message };

    if (status === 'approved') {
      const { error: guardUpdateErr } = await supabase
        .from('guards')
        .update({ application_status: ApplicationStatus.DRAFT })
        .eq('id', req.guard_id);
      if (guardUpdateErr) return { error: guardUpdateErr.message };
    }

    return { data: updated as unknown as ResubmitRequest };
  }
};
