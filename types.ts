
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  COMPANY_ADMIN = 'company_admin',
  HR_OFFICER = 'hr_officer',
  PROCUREMENT = 'procurement',
  SUPERVISOR = 'supervisor',
  GUARD = 'guard'
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  TRIALING = 'trialing'
}

export enum ApplicationStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  POOL_APPLICANT = 'pool_applicant',
  INTERVIEW_LOCKED = 'interview_locked',
  PROCUREMENT_PENDING = 'procurement_pending',
  INTERVIEWING = 'interviewing',
  HIRED = 'hired',
  ACTIVE = 'active',
  REJECTED = 'rejected',
  BLACKLISTED = 'blacklisted',
  DISQUALIFIED = 'disqualified',
  AWOL = 'leave_without_permit',
  ON_LEAVE = 'on_leave'
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

export interface AuthSession {
  token: string;
  user: Profile;
  expires_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  email: string;
  company_id?: string; // Optional only for SUPER_ADMIN
  avatar_url?: string;
  current_site_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  password?: string; // For mock login demonstration
}

export interface Subscription {
  id: string;
  company_id: string;
  plan_type: 'basic' | 'standard' | 'enterprise';
  status: SubscriptionStatus;
  current_period_end: string;
  max_guards: number;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  contact_email: string;
  subscription?: Subscription;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Site {
  id: string;
  name: string;
  lat: number;
  lng: number;
  geofence_radius_meters: number;
  company_id: string;
  supervisor_id?: string;
  incident_count?: number; // Denormalized for display
  created_at: string;
  updated_at?: string;
}

export type EducationLevel = 'primary' | 'secondary' | 'advanced' | 'nta4_5' | 'military';

export interface EducationRecord {
  id: string;
  guard_id: string;
  level: EducationLevel;
  year: string;
  certificate_url?: string;
  weapon_proficiency?: 'pass' | 'fail' | '';
  created_at?: string;
  updated_at?: string;
}

export interface Guarantor {
  id: string;
  guard_id: string;
  name: string;
  phone: string;
  relationship: string;
  letter_url: string;
  residence_letter_url: string;
  created_at?: string;
  updated_at?: string;
}

export interface DeploymentContract {
  id: string;
  guard_id: string;
  company_id: string;
  site_id: string;
  salary_amount: number;
  start_date: string;
  end_date?: string;
  contract_url?: string;
  is_active: boolean;
  signed_at?: string;
  created_at: string;
}

export interface EquipmentItem {
  id: string;
  company_id: string;
  sku: string;
  name: string;
  category: 'uniform' | 'footwear' | 'tactical' | 'weapon' | 'communications';
  stock_quantity: number;
  created_at: string;
  updated_at?: string;
}

export interface KitIssuanceItem {
  item_id: string;
  qty: number;
  size?: string;
  notes?: string;
}

export interface KitIssuance {
  id: string;
  guard_id: string;
  issuer_id: string; // References Profile.id
  items_issued: KitIssuanceItem[];
  guard_signature_hash?: string;
  issued_at: string;
}

// Data that can still reside in JSONB for flexible storage,
// or for AI-generated analysis artifacts.
export interface DossierData {
  interviewer_notes?: string;
  rejection_reason?: string;
  ai_analysis?: {
    reliability_score: number;
    reasoning: string;
    risk_flags: string[];
    analyzed_at: string;
  };
}

export interface Guard {
  id: string;
  nida_number: string;
  full_name: string;
  dob: string;
  profile_score: number;
  performance_score?: number;
  application_status: ApplicationStatus;
  current_site_id?: string;
  assigned_supervisor_id?: string; // References Profile.id
  company_id?: string; // Optional for POOL_APPLICANT
  phone?: string;
  
  // Dossier data (only remaining flexible fields as per SQL schema comment)
  dossier_data?: DossierData; 
  
  // Normalized fields (now top-level arrays/properties)
  education_history: EducationRecord[]; 
  guarantors: Guarantor[]; 
  
  // Next of Kin (migrated to top-level columns in SQL)
  next_of_kin_name?: string;
  next_of_kin_phone?: string;
  next_of_kin_relationship?: string;

  // Documents (migrated to top-level columns in SQL)
  nida_front_url?: string;
  birth_cert_url?: string;
  application_letter_url?: string;
  residence_letter_url?: string;
  
  agreed_salary?: number;
  contract_start_date?: string;
  contract_end_date?: string;
  has_signed_contract?: boolean;
  employment_contract_url?: string;
  current_shift?: 'day' | 'night';
  leave_return_date?: string;
  consecutive_absences: number; 
  residence_lat?: number;
  residence_lng?: number;
  is_armed: boolean;
  weapon_qualification?: string;
  created_at: string;
  updated_at?: string;

  // For mock login
  username?: string;
  password?: string;
}

export interface AdministrativeLog {
  id: string;
  company_id: string;
  actor_id: string; // References Profile.id
  action_type: string;
  entity_type: string;
  entity_id: string;
  payload: any;
  ip_address?: string;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  guard_id: string;
  type: 'short' | 'long';
  start_date: string;
  end_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at?: string;
}

export interface Announcement {
  id: string;
  company_id: string; // Tenant-specific
  title: string;
  content: string;
  author_profile_id?: string; // Optional for mock data, references Profile.id
  author_name?: string; // Denormalized for display
  created_at: string;
  updated_at?: string;
}

export interface AttendanceLog {
  id: string;
  guard_id: string;
  site_id: string;
  supervisor_id: string; // References Profile.id
  checked_in_at: string;
  lat: number;
  lng: number;
  distance_meters: number;
  status: 'present' | 'rejected';
}

export interface DisciplinaryCode {
  code: string;
  company_id?: string; // Nullable for global codes
  label: string;
  description?: string;
  points: number;
  created_at?: string;
  updated_at?: string;
}

export interface IncidentReport {
  id: string;
  guard_id: string;
  code: string; // References DisciplinaryCode.code
  notes: string;
  evidence_url: string;
  reported_by: string; // Can be Profile.id or Profile.full_name
  site_id?: string; 
  site_name?: string; // Denormalized for display
  created_at: string;
}
