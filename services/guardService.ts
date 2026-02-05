import { supabase } from './supabaseClient';
import { Guard, ApiResponse, ApplicationStatus, EducationRecord, Guarantor } from '../types';

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
      console.error('Error fetching guards:', error);
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
      application_status, // Has default
      // These are top-level arrays in types but not in DB
      ...coreGuardFields
    } = guardData;

    const { data, error } = await supabase
      .from('guards')
      .insert([coreGuardFields])
      .select()
      .single();

    if (error) return { error: error.message };

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
  }
};