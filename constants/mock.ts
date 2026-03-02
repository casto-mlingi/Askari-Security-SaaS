
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

export const MOCK_COMPANIES: Company[] = [];
export const MOCK_PROFILES: Profile[] = [];
export const MOCK_SITES: Site[] = [];
export const MOCK_GUARDS: Guard[] = [];
export const MOCK_DISCIPLINARY_CODES: DisciplinaryCode[] = [];
export const MOCK_INCIDENTS: IncidentReport[] = [];
export const MOCK_EQUIPMENT: EquipmentItem[] = [];
export const MOCK_LEAVE_REQUESTS: LeaveRequest[] = [];
export const MOCK_ATTENDANCE: AttendanceLog[] = [];
export const MOCK_ANNOUNCEMENTS: Announcement[] = [];

