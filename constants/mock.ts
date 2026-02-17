
import {
  Company,
  Profile,
  Site,
  Guard,
  IncidentReport,
  EquipmentItem,
  DisciplinaryCode,
  LeaveRequest,
  AttendanceLog,
  Announcement,
  UserRole,
  ApplicationStatus,
} from '../types';

// --- IDs for linking data ---
const C_ULTIMATE_ID = 'c-101';
const C_AMINI_ID = 'c-102';

const P_SUPER_ADMIN_ID = 'p-sa-01';
const P_ADMIN_ID = 'p-admin-01';
const P_HR_ID = 'p-hr-01';
const P_PROCURE_ID = 'p-procure-01';
const P_SUPERVISOR_ID = 'p-super-01';
const P_SUPERVISOR_2_ID = 'p-super-02';

// IDs for Second Company (AMINI Global) Staff
const P_ADMIN_AG_ID = 'p-admin-ag-01';
const P_HR_AG_ID = 'p-hr-ag-01';
const P_SUP_AG_ID = 'p-sup-ag-01';

const S_HQ_ID = 's-1';
const S_BANK_ID = 's-2';
const S_MALL_ID = 's-3';
const S_PORT_ID = 's-4'; // AMINI Global Site

const G_ACTIVE_ID = 'g-1';
const G_PENDING_ID = 'g-2';
const G_POOL_ID = 'g-3';
const G_LOCKED_ID = 'g-4';
const G_BLACKLIST_ID = 'g-5';
const G_PROCURE_PENDING_ID = 'g-6';
const G_DRAFT_ID = 'g-8';
const G_ON_LEAVE_ID = 'g-9';
const G_AMINI_GUARD_ID = 'g-ag-1'; // AMINI Global Guard

// --- Mock Data Definitions ---

export const MOCK_COMPANIES: Company[] = [
  { id: C_ULTIMATE_ID, name: 'Ultimate Security', slug: 'ultimate-sec', contact_email: 'contact@ultimate.com', is_active: true, created_at: '2023-01-01T10:00:00Z' },
  { id: C_AMINI_ID, name: 'AMINI Global', slug: 'amini-global', contact_email: 'ops@amini.global', is_active: true, created_at: '2023-02-15T12:00:00Z' },
];

export const MOCK_PROFILES: Profile[] = [
  // Super Admin
  { id: P_SUPER_ADMIN_ID, full_name: 'Sys Admin', role: UserRole.SUPER_ADMIN, email: 'admin@amini.com', is_active: true, created_at: '2023-01-01T00:00:00Z', password: 'pass123' },
  
  // Ultimate Security Staff
  { id: P_ADMIN_ID, full_name: 'Jane Manager', role: UserRole.COMPANY_ADMIN, email: 'manager@ultimate.com', company_id: C_ULTIMATE_ID, is_active: true, created_at: '2023-01-10T00:00:00Z', password: 'pass123' },
  { id: P_HR_ID, full_name: 'Peter HR', role: UserRole.HR_OFFICER, email: 'hr@amini.com', company_id: C_ULTIMATE_ID, is_active: true, created_at: '2023-01-11T00:00:00Z', password: 'pass123' },
  { id: P_PROCURE_ID, full_name: 'Susan Supply', role: UserRole.PROCUREMENT, email: 'supply@amini.com', company_id: C_ULTIMATE_ID, is_active: true, created_at: '2023-01-12T00:00:00Z', password: 'pass123' },
  { id: P_SUPERVISOR_ID, full_name: 'Sgt. Major', role: UserRole.SUPERVISOR, email: 'field@amini.com', company_id: C_ULTIMATE_ID, is_active: true, created_at: '2023-01-13T00:00:00Z', password: 'pass123', current_site_id: S_BANK_ID },
  { id: P_SUPERVISOR_2_ID, full_name: 'Lt. Asha', role: UserRole.SUPERVISOR, email: 'asha@ultimate.com', company_id: C_ULTIMATE_ID, is_active: true, created_at: '2023-01-14T00:00:00Z', password: 'pass123' },

  // AMINI Global Staff (For Multi-Tenant Testing)
  { id: P_ADMIN_AG_ID, full_name: 'Global Director', role: UserRole.COMPANY_ADMIN, email: 'director@amini-global.com', company_id: C_AMINI_ID, is_active: true, created_at: '2023-06-01T00:00:00Z', password: 'pass123' },
  { id: P_HR_AG_ID, full_name: 'Global HR', role: UserRole.HR_OFFICER, email: 'hr@amini-global.com', company_id: C_AMINI_ID, is_active: true, created_at: '2023-06-02T00:00:00Z', password: 'pass123' },
  { id: P_SUP_AG_ID, full_name: 'Captain Global', role: UserRole.SUPERVISOR, email: 'ops@amini-global.com', company_id: C_AMINI_ID, is_active: true, created_at: '2023-06-03T00:00:00Z', password: 'pass123', current_site_id: S_PORT_ID },
];

export const MOCK_SITES: Site[] = [
  { id: S_HQ_ID, name: 'CRDB HQ Tower', lat: -6.80, lng: 39.28, geofence_radius_meters: 150, company_id: C_ULTIMATE_ID, created_at: '2023-03-01T00:00:00Z' },
  { id: S_BANK_ID, name: 'NMB Bank Branch', lat: -6.81, lng: 39.27, geofence_radius_meters: 100, company_id: C_ULTIMATE_ID, supervisor_id: P_SUPERVISOR_ID, created_at: '2023-03-02T00:00:00Z' },
  { id: S_MALL_ID, name: 'Mlimani City Mall', lat: -6.77, lng: 39.22, geofence_radius_meters: 300, company_id: C_ULTIMATE_ID, created_at: '2023-03-03T00:00:00Z' },
  { id: S_PORT_ID, name: 'Dar Port Terminal', lat: -6.83, lng: 39.29, geofence_radius_meters: 500, company_id: C_AMINI_ID, supervisor_id: P_SUP_AG_ID, created_at: '2023-06-10T00:00:00Z' },
];

export const MOCK_GUARDS: Guard[] = [
  // Ultimate Security Guards
  { 
    id: G_ACTIVE_ID, 
    nida_number: '19900101-11111-00001-01', 
    full_name: 'Active Guard (Ultimate)', 
    dob: '1990-01-01', 
    profile_score: 95, 
    performance_score: 98, 
    application_status: ApplicationStatus.ACTIVE_GUARD, 
    current_site_id: S_BANK_ID, 
    company_id: C_ULTIMATE_ID, 
    assigned_supervisor_id: P_SUPERVISOR_ID, 
    phone: '0711111111', 
    is_armed: true, 
    consecutive_absences: 0, 
    created_at: '2023-04-01T00:00:00Z', 
    username: 'guard@ultimate.com', 
    password: 'pass123',
    education_history: [],
    guarantors: [],
    dossier_data: {}
  },
  { 
    id: G_POOL_ID, 
    nida_number: '19920315-33333-00003-03', 
    full_name: 'Pool Applicant', 
    dob: '1992-03-15', 
    profile_score: 85, 
    performance_score: 100, 
    application_status: ApplicationStatus.MARKET_POOL, 
    phone: '0733333333', 
    is_armed: false, 
    consecutive_absences: 0, 
    created_at: '2023-04-03T00:00:00Z',
    education_history: [],
    guarantors: [],
    dossier_data: {}
  },
  { 
    id: G_LOCKED_ID, 
    nida_number: '19881120-44444-00004-04', 
    full_name: 'Locked Applicant (Ultimate)', 
    dob: '1988-11-20', 
    profile_score: 78, 
    performance_score: 100, 
    application_status: ApplicationStatus.INTERVIEWING, 
    company_id: C_ULTIMATE_ID, 
    phone: '0744444444', 
    is_armed: true, 
    consecutive_absences: 0, 
    created_at: '2023-04-04T00:00:00Z',
    education_history: [],
    guarantors: [],
    dossier_data: { interviewer_notes: 'Interview scheduled.' }
  },
  { 
    id: G_BLACKLIST_ID, 
    nida_number: '19850505-55555-00005-05', 
    full_name: 'Blacklisted Person', 
    dob: '1985-05-05', 
    profile_score: 30, 
    performance_score: 0, 
    application_status: ApplicationStatus.BLACKLISTED, 
    phone: '0755555555', 
    is_armed: false, 
    consecutive_absences: 5, 
    created_at: '2023-04-05T00:00:00Z',
    education_history: [],
    guarantors: [],
    dossier_data: { rejection_reason: 'Gross misconduct.' }
  },
  { 
    id: G_PROCURE_PENDING_ID, 
    nida_number: '19950810-66666-00006-06', 
    full_name: 'Procurement Pending (Ultimate)', 
    dob: '1995-08-10', 
    profile_score: 92, 
    performance_score: 100, 
    application_status: ApplicationStatus.PROCUREMENT_PENDING, 
    company_id: C_ULTIMATE_ID, 
    phone: '0766666666', 
    is_armed: true, 
    consecutive_absences: 0, 
    created_at: '2023-04-06T00:00:00Z',
    education_history: [],
    guarantors: [],
    dossier_data: {}
  },
  { 
    id: G_DRAFT_ID, 
    nida_number: '20000101-88888-00008-08', 
    full_name: 'Draft Application', 
    dob: '2000-01-01', 
    profile_score: 40, 
    performance_score: 100, 
    application_status: ApplicationStatus.DRAFT, 
    phone: '0788888888', 
    is_armed: false, 
    consecutive_absences: 0, 
    created_at: '2023-04-08T00:00:00Z',
    education_history: [],
    guarantors: [],
    dossier_data: {}
  },
  { 
    id: G_ON_LEAVE_ID, 
    nida_number: '19930211-99999-00009-09', 
    full_name: 'Guard On Leave (Ultimate)', 
    dob: '1993-02-11', 
    profile_score: 88, 
    performance_score: 92, 
    application_status: ApplicationStatus.ON_LEAVE, 
    current_site_id: S_HQ_ID, 
    company_id: C_ULTIMATE_ID, 
    phone: '0799999999', 
    is_armed: false, 
    consecutive_absences: 0, 
    created_at: '2023-04-09T00:00:00Z',
    education_history: [],
    guarantors: [],
    dossier_data: {}
  },
  
  // AMINI Global Guard
  { 
    id: G_AMINI_GUARD_ID, 
    nida_number: '19990101-99999-00009-01', 
    full_name: 'Port Sentry (Global)', 
    dob: '1999-01-01', 
    profile_score: 96, 
    performance_score: 99, 
    application_status: ApplicationStatus.ACTIVE_GUARD, 
    current_site_id: S_PORT_ID, 
    company_id: C_AMINI_ID, 
    assigned_supervisor_id: P_SUP_AG_ID, 
    phone: '0755123456', 
    is_armed: true, 
    consecutive_absences: 0, 
    created_at: '2023-06-15T00:00:00Z', 
    username: 'guard@amini-global.com', 
    password: 'pass123',
    education_history: [],
    guarantors: [],
    dossier_data: {}
  },
];

export const MOCK_DISCIPLINARY_CODES: DisciplinaryCode[] = [
  { code: 'AWOL', label: 'Absence Without Leave', points: 25 },
  { code: 'LATE', label: 'Late for Duty', points: 5 },
  { code: 'UNIFORM', label: 'Improper Uniform', points: 5 },
  { code: 'SLEEP', label: 'Sleeping on Duty', points: 40 },
  { code: 'THEFT', label: 'Theft or Misconduct', points: 100 },
  { code: 'OTHER_REPORT', label: 'Other Self-Reported Issue', points: 0},
];

export const MOCK_INCIDENTS: IncidentReport[] = [
  { id: 'inc-1', guard_id: G_BLACKLIST_ID, code: 'SLEEP', notes: 'Found asleep in the guard tower.', evidence_url: 'https://via.placeholder.com/400x300.png?text=Evidence+Photo', reported_by: P_SUPERVISOR_ID, site_id: S_BANK_ID, site_name: 'NMB Bank Branch', created_at: '2023-04-04T22:00:00Z' },
  { id: 'inc-2', guard_id: G_BLACKLIST_ID, code: 'AWOL', notes: 'Did not report for shift, phone off.', evidence_url: 'https://via.placeholder.com/400x300.png?text=Evidence+Photo', reported_by: P_SUPERVISOR_ID, site_id: S_BANK_ID, site_name: 'NMB Bank Branch', created_at: '2023-04-05T08:00:00Z' },
  { id: 'inc-3', guard_id: G_ACTIVE_ID, code: 'LATE', notes: 'Arrived 15 minutes late for shift.', evidence_url: 'https://via.placeholder.com/400x300.png?text=Evidence+Photo', reported_by: P_SUPERVISOR_ID, site_id: S_BANK_ID, site_name: 'NMB Bank Branch', created_at: '2023-05-01T08:15:00Z' },
];

export const MOCK_EQUIPMENT: EquipmentItem[] = [
  { id: 'eq-1', company_id: C_ULTIMATE_ID, sku: 'U-001', name: 'Duty Shirt', category: 'uniform', stock_quantity: 100, created_at: '2023-01-20T00:00:00Z' },
  { id: 'eq-2', company_id: C_ULTIMATE_ID, sku: 'U-002', name: 'Duty Trousers', category: 'uniform', stock_quantity: 100, created_at: '2023-01-20T00:00:00Z' },
  { id: 'eq-3', company_id: C_ULTIMATE_ID, sku: 'F-001', name: 'Combat Boots', category: 'footwear', stock_quantity: 80, created_at: '2023-01-20T00:00:00Z' },
  { id: 'eq-4', company_id: C_ULTIMATE_ID, sku: 'T-001', name: 'Baton', category: 'tactical', stock_quantity: 120, created_at: '2023-01-20T00:00:00Z' },
  { id: 'eq-5', company_id: C_ULTIMATE_ID, sku: 'C-001', name: 'Radio', category: 'communications', stock_quantity: 4, created_at: '2023-01-20T00:00:00Z' },
  // AMINI Global Equipment
  { id: 'eq-ag-1', company_id: C_AMINI_ID, sku: 'AG-U-001', name: 'Global Uniform Set', category: 'uniform', stock_quantity: 50, created_at: '2023-06-05T00:00:00Z' },
];

export const MOCK_LEAVE_REQUESTS: LeaveRequest[] = [
  { id: 'lr-1', guard_id: G_ON_LEAVE_ID, type: 'short', start_date: '2023-05-10', end_date: '2023-05-12', reason: 'Family emergency.', status: 'approved', created_at: '2023-05-09T00:00:00Z' },
  { id: 'lr-2', guard_id: G_ACTIVE_ID, type: 'long', start_date: '2023-06-01', end_date: '2023-06-15', reason: 'Annual leave request.', status: 'pending', created_at: '2023-05-25T00:00:00Z' },
];

export const MOCK_ATTENDANCE: AttendanceLog[] = [
  { id: 'al-1', guard_id: G_ACTIVE_ID, site_id: S_BANK_ID, supervisor_id: P_SUPERVISOR_ID, checked_in_at: '2023-05-01T08:00:00Z', lat: -6.81001, lng: 39.27001, distance_meters: 1.5, status: 'present' },
  { id: 'al-2', guard_id: G_ACTIVE_ID, site_id: S_BANK_ID, supervisor_id: P_SUPERVISOR_ID, checked_in_at: '2023-05-01T17:00:00Z', lat: -6.80998, lng: 39.26998, distance_meters: 2.1, status: 'present' },
  { id: 'al-3', guard_id: G_ACTIVE_ID, site_id: S_BANK_ID, supervisor_id: P_SUPERVISOR_ID, checked_in_at: '2023-05-02T08:05:00Z', lat: -6.8105, lng: 39.2705, distance_meters: 70, status: 'present' },
  { id: 'al-4', guard_id: G_ACTIVE_ID, site_id: S_BANK_ID, supervisor_id: P_SUPERVISOR_ID, checked_in_at: '2023-05-03T07:50:00Z', lat: -6.8120, lng: 39.2720, distance_meters: 250, status: 'rejected' },
];

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  { id: 'ann-1', company_id: C_ULTIMATE_ID, title: 'New Protocol Update', content: 'All guards must review the updated incident reporting protocols by end of week.', author_profile_id: P_ADMIN_ID, author_name: 'Jane Manager', created_at: '2023-05-01T10:00:00Z' },
  { id: 'ann-2', company_id: C_ULTIMATE_ID, title: 'Monthly Performance Review', content: 'Supervisors will be conducting individual performance reviews throughout May.', author_profile_id: P_HR_ID, author_name: 'Peter HR', created_at: '2023-04-28T15:00:00Z' },
  // Global System Announcement (Example, company_id match checked in App.tsx)
  { id: 'ann-3', company_id: C_AMINI_ID, title: 'Global Security Alert', content: 'Increased vigilance advised due to regional instability.', author_profile_id: P_SUPER_ADMIN_ID, author_name: 'Sys Admin', created_at: '2023-05-05T09:00:00Z' },
];
