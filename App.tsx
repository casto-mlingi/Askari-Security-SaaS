import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { guardService } from './services/guardService';
// import { generateAIResponse } from './services/ai'; // Uncomment if using AI
import Layout from './components/Layout';
import Auth from './components/Auth';
import IntakeManager from './components/IntakeManager';
import VettingWorkflow from './components/VettingWorkflow';
import ProcurementDashboard from './components/ProcurementDashboard';
import StockInPage from './components/StockInPage';
import BlacklistManager from './components/BlacklistManager';
import OperationsEngine from './components/OperationsEngine';
import SiteManager from './components/SiteManager';
import TacticalMonitor from './components/TacticalMonitor';
import DisciplinaryManager from './components/DisciplinaryManager';
import PersonnelRegistry from './components/PersonnelRegistry';
import CompanyRegistry from './components/CompanyRegistry';
import ArchitectureOverview from './components/ArchitectureOverview';
import ERDView from './components/ERDView';
import CodeBlock from './components/CodeBlock';
import InterviewReport from './components/InterviewReport';
import ApplicantDashboard from './components/ApplicantDashboard';
import GuardOperations from './components/GuardOperations';
import GuardProfile from './components/GuardProfile';
import PerformanceLineChart from './components/PerformanceLineChart';
import NoticeBoard from './components/NoticeBoard';
import WaitForApproval from './components/WaitForApproval';
import ForensicDisclosure from './components/ForensicDisclosure';
import PublicApplication from './components/PublicApplication';
import SetPassword from './components/SetPassword';
import RosterManager from './components/RosterManager';
import { NotificationManager } from './components/Notification';
import { AMINI_SQL_SCHEMA } from './constants/sql';
import { api } from './services/api';

import { Guard, Profile, UserRole, Company, Site, IncidentReport, DisciplinaryCode, LeaveRequest, Announcement, DisciplinaryRecord } from './types';

const App: React.FC = () => {

  // --- Global State ---
  const [user, setUser] = useState<Profile | Guard | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedGuardForAudit, setSelectedGuardForAudit] = useState<Guard | null>(null);
  const [showGuardApplication, setShowGuardApplication] = useState(false);
  const [loading, setLoading] = useState(true); // Added global loading state
  const [session, setSession] = useState<any>(null);
  const [isInviteFlow, setIsInviteFlow] = useState(false);

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (hash && (hash.includes('type=invite') || hash.includes('type=recovery'))) {
      setIsInviteFlow(true);
    }
    const token = localStorage.getItem('amini_auth_token');
    setSession(token ? { access_token: token } : null);
  }, []);

  // --- Data State ---
  const [companies, setCompanies] = useState<Company[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [disciplinaryRecords, setDisciplinaryRecords] = useState<DisciplinaryRecord[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [disciplinaryCodes, setDisciplinaryCodes] = useState<DisciplinaryCode[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [resubmitRequests, setResubmitRequests] = useState<any[]>([]);
  const [dbCompanyId, setDbCompanyId] = useState<string | undefined>(undefined);
  const [blacklistedGuards, setBlacklistedGuards] = useState<Guard[]>([]);
  const [redAlerts, setRedAlerts] = useState<Array<{ guard_id: string; full_name: string; company_name: string | null; incident_description?: string | null }>>([]);

  // --- 1. STRICT DATA FETCHING ---
  const isFetchingRef = useRef(false);
  const fetchRealData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    let isMounted = true;
    try {
      const [guardsRes, sitesRes, profilesRes, companiesRes, recordsRes] = await Promise.all([
        guardService.getGuards(),
        api.get<Site[]>('/sites'),
        api.get<Profile[]>('/profiles'),
        api.get<Company[]>('/companies'),
        api.get<DisciplinaryRecord[]>('/disciplinary/records')
      ]);
      if (isMounted) {
        if (guardsRes.data) setGuards(guardsRes.data);
        if (sitesRes.data) setSites(sitesRes.data as Site[]);
        if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
        if (companiesRes.data) setCompanies(companiesRes.data as Company[]);
        if (recordsRes.data) {
          const rawRecords = recordsRes.data as DisciplinaryRecord[];
          setDisciplinaryRecords(rawRecords);
          const mappedIncidents: IncidentReport[] = rawRecords.map(r => {
            const pts = r.penalty_points || 0;
            let sev: 'low' | 'medium' | 'high' | 'critical' = 'low';
            if (pts >= 20) sev = 'critical';
            else if (pts >= 15) sev = 'high';
            else if (pts >= 10) sev = 'medium';
            else if (pts >= 5) sev = 'low';

            return {
              id: r.id,
              guard_id: r.guard_id,
              site_id: undefined,
              code: r.incident_code || 'OTHER_REPORT',
              notes: r.formal_report || '',
              evidence_url: r.evidence_url || '',
              points_deducted: pts,
              severity: sev,
              reported_by: 'System',
              created_at: r.created_at
            };
          });
          setIncidents(mappedIncidents);
        }
        setLoading(false);
      }
    } catch (error) {
      console.error("❌ Error fetching data:", error);
      if (isMounted) setLoading(false);
    } finally {
      isFetchingRef.current = false;
    }
    return () => { isMounted = false; };
  }, []);
  useEffect(() => {
    const token = localStorage.getItem('amini_auth_token');
    if (!token) {
      setLoading(false);
      return;
    }
    fetchRealData();
  }, [user?.id]);

  useEffect(() => {
    const refreshOnBlacklist = async () => {
      if (activeTab !== 'blacklisted') return;
      try {
        const res = await api.get<Guard[]>('/guards/blacklisted');
        if (res?.data) {
          setBlacklistedGuards(res.data as Guard[]);
        } else {
          setBlacklistedGuards([]);
        }
      } catch (err) {
        console.error('Failed to load blacklisted guards:', err);
        setBlacklistedGuards([]);
      }
    };
    refreshOnBlacklist();
  }, [activeTab]);

  // --- Derived State Helpers ---
  const isGuard = user && !('role' in user);
  const isApplicant = !!user && ('role' in user) && (user as any).role === 'applicant';
  const userRole: UserRole | string | null = (user && ('role' in user)) ? (user as any).role : null;
  const roleText = (user && ('role' in user)) ? String((user as any).role || '').toLowerCase() : '';
  const isSystemHR = roleText === 'system_hr';
  const userCompanyId = isGuard ? (user as Guard).company_id : (user as Profile)?.company_id;
  const currentUserName = user?.full_name || 'N/A';

  useEffect(() => {
    const isSuperAdmin = userRole === UserRole.SUPER_ADMIN;
    if (activeTab === 'wait-approval' && !(isSystemHR || isSuperAdmin)) {
      setActiveTab('overview');
    }
  }, [activeTab, isSystemHR, userRole]);

  // --- Sync User Company with DB ---
  useEffect(() => {
    const resolveCompanyUuid = async () => {
      if (!userCompanyId || userRole === UserRole.SUPER_ADMIN) {
        setDbCompanyId(undefined);
        return;
      }
      const currentCompany = companies.find(c => c.id === userCompanyId);
      const desiredSlug = currentCompany?.slug;
      const desiredName = currentCompany?.name;
      const desiredEmail = currentCompany?.contact_email || 'ops@company.local';

      if (!desiredSlug || !desiredName) {
        setDbCompanyId(undefined);
        return;
      }

      const match = companies.find(c => c.slug === desiredSlug || c.name === desiredName);
      if (match) {
        setDbCompanyId(match.id);
        return;
      }

      // Auto-create company if missing (Mock Logic Support)
      try {
        const result = await api.post('/companies', {
          name: desiredName,
          slug: desiredSlug,
          contact_email: desiredEmail,
          is_active: true
        });
        const data = result.data as Company;
        if (data?.id) {
          setDbCompanyId(data.id);
          setCompanies(prev => [data, ...prev]);
        }
      } catch {
        setDbCompanyId(undefined);
      }
    };
    resolveCompanyUuid();
  }, [userCompanyId, userRole, companies]);

  useEffect(() => {
    const fetchDisciplinaryRecords = async () => {
      if (!userCompanyId) return;
      try {
        const res = await api.get('/disciplinary/records?company_id=' + userCompanyId);
        if (res && res.data) {
          setDisciplinaryRecords(res.data as DisciplinaryRecord[]);
        }
      } catch (e) { }
    };
    fetchDisciplinaryRecords();
  }, [userCompanyId]);

  // Red Alerts for Super Admin: load on login
  useEffect(() => {
    const loadRedAlerts = async () => {
      if (userRole !== UserRole.SUPER_ADMIN) return;
      try {
        const r = await api.get('/admin/alerts/high-incidents');
        const arr = (r?.data || []) as any[];
        setRedAlerts(arr);
        if (arr.length > 0) {
          (window as any).showNotification?.('error', `🚨 Red Alerts: ${arr.length} high-risk guard(s)`);
        }
      } catch { }
    };
    loadRedAlerts();
  }, [user?.id, userRole]);
  // (Removed diagnostics and temporary company override)

  // --- Filter Data based on Multi-Tenancy ---
  const filteredGuards = useMemo(() => {
    if (isApplicant) return [];
    if (roleText === 'system_hr') {
      const list = (guards || []).filter(g => {
        const s = String((g as any)?.status || '').toLowerCase();
        const hasNoCompany = !g?.company_id || g?.company_id === '';
        return hasNoCompany && s === 'pending_approval';
      });
      return list;
    }
    if (userRole === UserRole.SUPER_ADMIN) return (guards || []);
    if (isGuard) return [user as Guard];
    // Company HR visibility: only guards hired by their company
    return guards
      .filter(Boolean)
      .filter(g => g?.company_id === userCompanyId);
  }, [guards, userRole, userCompanyId, isGuard, user, roleText]);

  const filteredSites = useMemo(() => {
    if (isApplicant) return [];
    if (userRole === UserRole.SUPER_ADMIN) return (sites || []);
    return sites
      .filter(Boolean)
      .filter(s => s?.company_id === userCompanyId);
  }, [sites, userRole, userCompanyId]);

  const filteredIncidents = useMemo(() => {
    if (isApplicant) return [];
    if (userRole === UserRole.SUPER_ADMIN) return (incidents || []);
    const companyGuardIds = (guards || [])
      .filter(g => g && g.company_id === userCompanyId)
      .map(g => g.id);
    const mapRecordToIncident = (r: DisciplinaryRecord): IncidentReport => ({
      id: r.id,
      guard_id: r.guard_id,
      title: r.incident_code,
      code: r.incident_code,
      notes: r.formal_report,
      evidence_url: '',
      reported_by: 'HR System',
      created_at: r.created_at
    });
    const combined = [
      ...incidents,
      ...disciplinaryRecords.map(mapRecordToIncident)
    ];
    return combined
      .filter(Boolean)
      .filter(i => companyGuardIds.includes(i?.guard_id));
  }, [incidents, disciplinaryRecords, userRole, userCompanyId, guards]);

  const unreadAlertsCount = useMemo(() => {
    const highOrCritical = (i: IncidentReport) => {
      const sev = String(i.severity || '').toLowerCase();
      return sev === 'high' || sev === 'critical';
    };
    if (isApplicant) return 0;
    if (isGuard && user) {
      return (incidents || []).filter(i => i?.guard_id === (user as Guard)?.id).length;
    }
    if (userRole === UserRole.HR_OFFICER || userRole === UserRole.SUPERVISOR) {
      return filteredIncidents.filter(highOrCritical).length;
    }
    return filteredIncidents.length;
  }, [incidents, filteredIncidents, isGuard, isApplicant, user, guards, userRole]);

  const filteredAnnouncements = useMemo(() => {
    if (userRole === UserRole.SUPER_ADMIN) return (announcements || []);
    return announcements
      .filter(Boolean)
      .filter(a => a?.company_id === userCompanyId);
  }, [announcements, userRole, userCompanyId]);

  const computeReadiness = useCallback((g: Guard) => {
    let score = 0;
    const personalOk = !!g.full_name && !!g.phone && !!g.nida_number;
    if (personalOk) score += 25;
    const educationOk = Array.isArray(g.education_history) && g.education_history.length > 0;
    if (educationOk) score += 25;
    const guarantorsOk = Array.isArray(g.guarantors) && g.guarantors.length >= 2;
    if (guarantorsOk) score += 25;
    const documentsOk = !!(g.nida_front_url || g.birth_cert_url || g.cv_url || g.passport_photo_url);
    if (documentsOk) score += 25;
    return score;
  }, []);

  const filteredLeaveRequests = useMemo(() => {
    if (userRole === UserRole.SUPER_ADMIN) return (leaveRequests || []);
    const companyGuardIds = guards
      .filter(Boolean)
      .filter(g => g?.company_id === userCompanyId)
      .map(g => g?.id)
      .filter(Boolean);
    return leaveRequests
      .filter(Boolean)
      .filter(r => companyGuardIds.includes(r?.guard_id));
  }, [leaveRequests, userRole, userCompanyId, guards]);

  const filteredDisciplinaryCodes = useMemo(() => {
    if (userRole === UserRole.SUPER_ADMIN) return disciplinaryCodes;
    return disciplinaryCodes.filter(c => !c.company_id || c.company_id === userCompanyId);
  }, [disciplinaryCodes, userCompanyId, userRole]);

  const [selectedGuardForIntake, setSelectedGuardForIntake] = useState<Guard | null>(null);

  // --- Actions ---

  const handleLogin = (loggedInUser: Profile | Guard) => {
    const pendingAccount = localStorage.getItem('pending_guard_account');
    let finalUser = loggedInUser;
    let needsIntake = false;

    if (finalUser && !('role' in finalUser)) {
      const g = finalUser as Guard;
      if (String((g as any)?.status || '').toLowerCase() === 'blacklisted') {
        (window as any).showNotification?.('error', 'Your account has been blacklisted. Please contact the deployment office.');
        try { localStorage.removeItem('amini_auth_token'); } catch { }
        return;
      }
    }

    const aminiPending = localStorage.getItem('amini_pending_guard');
    if (aminiPending && loggedInUser && !('role' in loggedInUser)) {
      try {
        const ap = JSON.parse(aminiPending);
        const guard = loggedInUser as Guard;
        const matchByNida = !!guard.nida_number && !!ap.nida_number && guard.nida_number.replace(/\D/g, '') === String(ap.nida_number).replace(/\D/g, '');
        const matchByName = !!guard.full_name && !!ap.full_name && guard.full_name.trim().toLowerCase() === String(ap.full_name).trim().toLowerCase();
        if (matchByNida || matchByName) {
          needsIntake = true;
        }
      } catch { }
    }

    if (pendingAccount && loggedInUser && !('role' in loggedInUser)) {
      try {
        const accountData = JSON.parse(pendingAccount);
        const pendingGuard = accountData.guard;
        // Guard records don't have email - compare by ID only
        const isPendingAccount = pendingGuard.id === loggedInUser.id;

        if (isPendingAccount) {
          const existingGuard = guards.find(g => g.id === pendingGuard.id);
          if (!existingGuard) {
            setGuards(prev => [...prev, pendingGuard]);
          }
          finalUser = pendingGuard;
          needsIntake = accountData.needs_intake || false;
        }
      } catch (e) {
        console.error('Error parsing pending account data:', e);
      }
    }

    setUser(finalUser);

    if (finalUser && !('role' in finalUser)) {
      const g = finalUser as Guard;
      const saraEmail = String((g as any)?.email || '').toLowerCase();
      if (saraEmail === 'sara@amini.co.tz') {
        setActiveTab('profile-update');
        return;
      }
      if (needsIntake) {
        setActiveTab('profile-update');
        return;
      }
      const s = String((g as any)?.status || '').toLowerCase();
      if (s === 'draft') {
        setActiveTab('profile-update');
      } else if (s === 'active') {
        setActiveTab('overview');
      } else {
        setActiveTab('application-status');
      }
    } else {
      const roleText = String((finalUser as any)?.role || '').toLowerCase();
      const saraEmail = String((finalUser as any)?.email || '').toLowerCase();
      if (saraEmail === 'sara@amini.co.tz') {
        setActiveTab('profile-update');
        return;
      }
      if (roleText === 'applicant') {
        setActiveTab('profile-update');
      } else {
        setActiveTab('vetting');
        try {
          if (typeof window !== 'undefined') {
            window.location.hash = '#vetting';
          }
        } catch { }
      }
    }
  };

  useEffect(() => {
    if (!user) return;
    const isActiveGuard = isGuard && (String(((user as any)?.status) || '').toLowerCase() === 'active');
    const roleText = (user && ('role' in user)) ? String((user as any)?.role || '').toLowerCase() : '';
    const isApplicantRole = roleText === 'applicant';
    const allowedApplicantTabs = new Set(['application-status', 'profile-update', 'notice-board']);
    const isGuardDashboardTab = new Set(['overview', 'operations', 'support']).has(activeTab);
    if (isApplicantRole && isGuardDashboardTab) {
      setActiveTab('application-status');
      return;
    }
    if (isGuard && !isActiveGuard && isGuardDashboardTab) {
      setActiveTab('application-status');
    }
  }, [user, isGuard, activeTab]);

  const handleLogout = async () => {
    try {
      localStorage.removeItem('amini_auth_token');
    } catch { }
    setUser(null);
    setActiveTab('overview');
  };

  const handlePublicApply = (newGuard: Guard) => {
    const existing = guards.find(g => g.nida_number === newGuard.nida_number);
    if (existing && String((existing as any)?.status || '').toLowerCase() === 'blacklisted') {
      alert(`Access Denied: Blacklisted.`);
      return;
    }
    setGuards(prev => [...prev, newGuard]);
    handleLogin(newGuard);
  };

  const handleIntakeComplete = async (newGuard: Guard, isApplicantFlow = false) => {
    if (isApplicantFlow) {
      try {
        const targetId = newGuard?.id || (user as Profile)?.id;
        const result = await api.patch(`/guards/${targetId}`, {
          status: 'submitted_application',
          company_id: null
        });
        const data = result.data as Guard | undefined;
        if (data && data.id) {
          setGuards(prev => prev.map(g => (g?.id === data.id) ? { ...g, ...data } : g));
          localStorage.removeItem('pending_guard_account');
          console.log('🚀 DB Save Success:', data);
          (window as any).showNotification?.('success', 'Hongera! Usajili wako umepokelewa na System HR. Utapata taarifa hapa hapa kwenye Dashboard yako pindi utakapohakikiwa na kuwekwa kwenye Marketplace kwa ajili ya kuajiriwa na kampuni za ulinzi. Kaa tayari!');
          setTimeout(() => setActiveTab('application-status'), 100);
        } else {
          (window as any).showNotification?.('error', 'Failed to update status. Please retry.');
          return;
        }
      } catch (e) {
        (window as any).showNotification?.('error', 'Network error: unable to submit.');
        return;
      }
    } else {
      try {
        const payload = {
          ...newGuard,
          company_id: userCompanyId,
          status: 'interviewing',
          dossier_data: { ...(newGuard as any)?.dossier_data, interview_source: 'company_hr' }
        } as Partial<Guard>;
        const result = await api.post('/guards', payload);
        const data = result.data as Guard | undefined;
        if (data) {
          setGuards(prev => [...prev, data]);
          (window as any).showNotification?.('success', 'Applicant registered and interview locked.');
        } else {
          setGuards(prev => [...prev, { ...payload, id: `g-${Date.now()}` } as Guard]);
          (window as any).showNotification?.('warning', 'Offline: personnel saved locally.');
        }
      } catch (e) {
        setGuards(prev => [...prev, { ...newGuard, company_id: userCompanyId, id: `g-${Date.now()}` } as Guard]);
        (window as any).showNotification?.('warning', 'Error: applicant saved locally (interview lock).');
      }
    }
  };

  const handleLockGuard = async (guardId: string, companyId: string, notes: string, schedule?: { date: string; location: string }) => {
    try {
      const g = guards.find(x => x.id === guardId);
      const sc = Number((g as any)?.performance_score ?? 100);
      if (!Number.isNaN(sc) && sc < 5) {
        (window as any).showNotification?.('error', 'Blocked: Guard is blacklisted (score < 5).');
        return;
      }
    } catch { }
    try {
      const result = await api.patch(`/guards/${guardId}`, {
        status: 'interviewing',
        company_id: companyId,
        dossier_data: { interviewer_notes: notes, interview_schedule: schedule || null, interview_source: isSystemHR ? 'sys_hr' : 'company_hr', interview_locked_at: new Date().toISOString() }
      });
      const data = result.data as any;
      if (!data) {
        setGuards(prev => prev.map(g => {
          if (g.id === guardId) {
            return {
              ...g,
              status: 'interviewing',
              company_id: companyId,
              dossier_data: { ...g.dossier_data, interviewer_notes: notes, interview_schedule: schedule || null, interview_source: isSystemHR ? 'sys_hr' : 'company_hr' }
            };
          }
          return g;
        }));
        (window as any).showNotification?.('warning', 'Offline: lock saved locally.');
      } else {
        setGuards(prev => prev.map(g => g.id === guardId ? { ...g, ...data } : g));
        (window as any).showNotification?.('success', 'Applicant locked for interview.');
      }
    } catch (e) {
      setGuards(prev => prev.map(g => {
        if (g.id === guardId) {
          return {
            ...g,
            status: 'interviewing',
            company_id: companyId,
            dossier_data: { ...g.dossier_data, interviewer_notes: notes, interview_schedule: schedule || null, interview_source: isSystemHR ? 'sys_hr' : 'company_hr', interview_locked_at: new Date().toISOString() }
          };
        }
        return g;
      }));
      (window as any).showNotification?.('warning', 'Error: lock saved locally.');
    }
  };

  const handleFinalizeVetting = async (guardId: string, result: 'pass' | 'fail' | 'blacklisted', terms?: any, reason?: string) => {
    try {
      try {
        const g = guards.find(x => x.id === guardId);
        const sc = Number((g as any)?.performance_score ?? 100);
        if (!Number.isNaN(sc) && sc < 5) {
          (window as any).showNotification?.('error', 'Blocked: Guard is blacklisted (score < 5).');
          return;
        }
      } catch { }
      if (result === 'pass' && terms) {
        const supervisorId = terms.supervisorId || null;
        const siteId = terms.siteId || null;
        if (!siteId || !supervisorId) {
          (window as any).showNotification?.('error', 'Active requires Site and Supervisor');
          return;
        }
        const computedCompanyId = dbCompanyId || userCompanyId || null;
        const updatePayload: any = {
          status: 'active',
          agreed_salary: Number(terms.salary),
          contract_start_date: terms.startDate || null,
          contract_end_date: terms.endDate || null,
          employment_contract_url: terms.contractUrl || null,
          current_site_id: siteId,
          assigned_supervisor_id: supervisorId,
          deployment_date: terms.startDate || new Date().toISOString()
        };
        if (computedCompanyId) {
          updatePayload.company_id = computedCompanyId;
        }
        const result = await api.patch(`/guards/${guardId}`, updatePayload);
        if ((result as any)?.error) {
          (window as any).showNotification?.('error', String((result as any).error || 'Hire failed'));
          return;
        }
        const data = result.data as any;
        if (!data) {
          (window as any).showNotification?.('error', 'Hire failed: No response from server');
          return;
        } else {
          setGuards(prev => prev.map(g => g.id === guardId ? { ...g, ...data } : g));
        }
        try {
          await api.post('/interview-logs', {
            guard_id: guardId,
            company_id: (user as Profile)?.company_id || null,
            outcome: 'passed',
            interview_date: terms.interviewDate || null,
            comments: { interview_notes: terms.interviewNotes || null },
            score: null,
            deployment_contract_url: terms.contractUrl || null,
            created_at: new Date().toISOString()
          });
        } catch { }
        (window as any).showNotification?.('success', 'Guard hired and activated.');
        try {
          setSelectedGuardForAudit(null);
        } catch { }
      } else if (result === 'blacklisted') {
        const updatePayload = {
          status: 'blacklisted',
          dossier_data: { rejection_reason: reason }
        };
        const result = await api.patch(`/guards/${guardId}`, updatePayload);
        const data = result.data as any;
        if (!data) {
          setGuards(prev => prev.map(g => g.id === guardId ? { ...g, ...updatePayload } : g));
          (window as any).showNotification?.('warning', 'Offline: blacklisted saved locally.');
        } else {
          setGuards(prev => prev.map(g => g.id === guardId ? { ...g, ...data } : g));
          (window as any).showNotification?.('success', 'Applicant blacklisted.');
        }
      } else {
        const wantReinstate = String(reason || '').toLowerCase().includes('reinstate');
        const updatePayload = wantReinstate ? {
          status: 'marketplace',
          company_id: null,
          dossier_data: { admin_note: reason }
        } : {
          status: 'submitted_application',
          company_id: null,
          dossier_data: { rejection_reason: reason }
        };
        const result = await api.patch(`/guards/${guardId}`, updatePayload);
        const data = result.data as any;
        if (!data) {
          setGuards(prev => prev.map(g => g.id === guardId ? { ...g, ...updatePayload } : g));
          (window as any).showNotification?.('warning', wantReinstate ? 'Offline: reinstatement saved locally.' : 'Offline: returned to applicant.');
        } else {
          setGuards(prev => prev.map(g => g.id === guardId ? { ...g, ...data } : g));
          (window as any).showNotification?.('success', wantReinstate ? 'Guard reinstated to Marketplace.' : 'Applicant returned to previous stage.');
        }
      }
    } catch (e) {
      console.error('Error finalizing vetting:', e);
    }
  };

  const handleApproveToMarketplace = (guardId: string) => {
    setGuards(prev => prev.map(g => g.id === guardId ? { ...g, status: 'marketplace', company_id: null } : g));
  };
  const handleRequestEditFromHR = (guardId: string, note: string) => {
    setGuards(prev => prev.map(g => {
      if (g.id !== guardId) return g;
      const notes = [...(g.dossier_data?.hr_private_notes || []), { id: `hrn-${Date.now()}`, author_id: (user as Profile)?.id, note, created_at: new Date().toISOString() }];
      return { ...g, status: 'draft', dossier_data: { ...(g.dossier_data || {}), allow_edit: true, hr_private_notes: notes } };
    }));
  };

  const handleIssueKit = (guardId: string, items: any, sig: string) => {
    setGuards(prev => prev.map(g => g.id === guardId ? { ...g, ...(g as any), status: 'active', performance_score: 100 } : g));
  };

  const handleReportIncident = async (guardId: string, report: Partial<IncidentReport>) => {
    try {
      await api.post('/ops/incidents', {
        guard_id: guardId,
        title: report.title,
        notes: report.notes,
        severity: report.severity,
        evidence_image_url: report.evidence_image_url,
        site_id: report.site_id,
        created_at: new Date().toISOString()
      });
      // Re-fetch all real DB data so performance_score updates dynamically from the backend PostgreSQL Trigger
      fetchRealData();
    } catch (e) {
      console.error('Failed to report incident', e);
    }

    if (report.severity === 'high' || report.severity === 'critical') {
      (window as any).showNotification?.('error', 'High severity incident reported.');
    }
  };

  const handleClockIn = async (guardId: string, siteId?: string) => {
    const site = sites.find(s => s.id === (siteId || guards.find(g => g.id === guardId)?.current_site_id));
    if (!site) return;
    const log = {
      id: `al-${Date.now()}`,
      guard_id: guardId,
      site_id: site.id,
      checked_in_at: new Date().toISOString(),
      status: 'present' as const
    };
    setAttendanceLogs(prev => [log, ...prev]);
    try {
      await api.post('/ops/attendance', log);
    } catch (e) { }
  };

  const handleReinstate = (guardId: string) => {
    setGuards(prev => prev.map(g => g.id === guardId ? { ...g, status: 'marketplace', company_id: undefined, performance_score: 100 } : g));
  };

  const handleShiftPersonnel = (personId: string, targetSiteId: string, type: 'guard' | 'supervisor') => {
    if (type === 'guard') {
      setGuards(prev => prev.map(g => g.id === personId ? { ...g, current_site_id: targetSiteId || undefined } : g));
    } else {
      setSites(prev => {
        const cleanedSites = prev.map(site => site.supervisor_id === personId ? { ...site, supervisor_id: undefined } : site);
        if (targetSiteId) {
          return cleanedSites.map(site => site.id === targetSiteId ? { ...site, supervisor_id: personId } : site);
        }
        return cleanedSites;
      });
      setProfiles(prev => prev.map(p => p.id === personId ? { ...p, current_site_id: targetSiteId || undefined } : p));
    }
  };

  const handleLeaveRequest = (type: 'short' | 'long', start: string, end: string, reason: string) => {
    if (!isGuard) return;
    const newReq: LeaveRequest = {
      id: `lr-${Date.now()}`,
      guard_id: (user as Guard).id,
      type,
      start_date: start,
      end_date: end,
      reason,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    setLeaveRequests(prev => [newReq, ...prev]);
  };

  const handleUpdateLeave = (id: string, status: 'approved' | 'rejected') => {
    setLeaveRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const handleAddPolicy = async (policy: DisciplinaryCode) => {
    const payload = { ...policy, company_id: userCompanyId };
    setDisciplinaryCodes(prev => [...prev, payload]);
    try {
      await api.post('/disciplinary-codes', payload);
    } catch (e) { }
  };

  const handleUpdatePolicy = async (code: string, updates: Partial<DisciplinaryCode>) => {
    setDisciplinaryCodes(prev => prev.map(c =>
      (c.code === code) ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
    ));
    try {
      await api.patch('/disciplinary-codes/' + code, { ...updates, updated_at: new Date().toISOString() });
    } catch (e) { }
  };

  const handleDeletePolicy = async (code: string) => {
    setDisciplinaryCodes(prev => prev.filter(c => c.code !== code));
    try {
      await api.delete('/disciplinary-codes/' + code);
    } catch (e) { }
  };

  const handleGuardReportProblem = (desc: string, evidence?: string) => {
    if (!isGuard) return;
    const [title, severity, notes] = String(desc).split(':::');
    const payload: Partial<IncidentReport> = {
      title: title || 'Incident',
      severity: (severity as any) || 'low',
      code: 'OTHER_REPORT',
      notes: notes || desc,
      evidence_url: evidence,
      evidence_image_url: evidence,
      reported_by: (user as Guard).full_name,
      site_id: (user as Guard).current_site_id,
      site_name: sites.find(s => s.id === (user as Guard).current_site_id)?.name
    };
    handleReportIncident((user as Guard).id, payload);
  };

  const handleAddCompany = (company: any) => {
    const newCompany: Company = { ...company, id: `c-${Date.now()}`, is_active: true, created_at: new Date().toISOString() };
    setCompanies(prev => [...prev, newCompany]);
  };

  const handleUpdateCompany = (id: string, updates: any) => {
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const handleAddStaff = (staff: any) => {
    const newStaff: Profile = { ...staff, id: `p-${Date.now()}`, is_active: true, created_at: new Date().toISOString() };
    setProfiles(prev => [...prev, newStaff]);
  };

  const handleToggleCompanyActive = (id: string) => {
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, is_active: !c.is_active } : c));
  };

  // --- Render ---

  if (session && isInviteFlow) {
    return (
      <NotificationManager>
        <div className="min-h-screen bg-background overflow-y-auto" style={{ scrollBehavior: 'smooth' }}>
          <SetPassword />
        </div>
      </NotificationManager>
    );
  }

  if (!user) {
    if (showGuardApplication && window.innerWidth >= 1024) {
      return (
        <NotificationManager>
          <div className="min-h-screen bg-background overflow-y-auto" style={{ scrollBehavior: 'smooth' }}>
            <PublicApplication
              onBack={() => setShowGuardApplication(false)}
              onSubmit={(guard) => {
                setShowGuardApplication(false);
                handlePublicApply(guard);
              }}
            />
          </div>
        </NotificationManager>
      );
    }
    return <Auth
      onLogin={handleLogin}
      onPublicSubmit={handlePublicApply}
      guards={guards}
      profiles={profiles}
      onShowGuardApplication={() => setShowGuardApplication(true)}
    />;
  }

  const guardSite = isGuard ? sites.find(s => s.id === (user as Guard).current_site_id) : undefined;
  const guardSupervisor = isGuard ? profiles.find(p => p.id === (guardSite?.supervisor_id)) : undefined;

  return (
    <NotificationManager>
      <Layout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={userRole}
        onLogout={handleLogout}
        companyName={isGuard ? undefined : companies.find(c => c.id === userCompanyId)?.name}
        currentUser={user}
        unreadAlertsCount={unreadAlertsCount}
        noticesPublicCount={filteredAnnouncements.length}
      >
        {!isGuard && !isApplicant && (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-16 animate-in fade-in duration-700">
                <div className="bg-slate-900 rounded-[2.5rem] p-12 text-white shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/20 rounded-full blur-3xl -mr-40 -mt-40 pointer-events-none" />
                  <div className="relative z-10">
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight leading-none mb-8">
                      Dashboard <br />
                      <span className="text-primary text-2xl sm:text-3xl md:text-4xl">Overview</span>
                    </h1>
                    <div className="grid grid-cols-2 gap-4 sm:gap-6">
                      <div className="bg-white/10 rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
                        <p className="text-xs sm:text-sm font-bold text-white/60 uppercase">Active Guards</p>
                        <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mt-2">{filteredGuards.filter(g => String((g as any)?.status || '').toLowerCase() === 'active').length}</p>
                      </div>
                      <div className="bg-white/10 rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
                        <p className="text-xs sm:text-sm font-bold text-white/60 uppercase">Total Sites</p>
                        <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mt-2">{filteredSites.length}</p>
                      </div>
                      <div className="bg-white/10 rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
                        <p className="text-xs sm:text-sm font-bold text-white/60 uppercase">Incidents</p>
                        <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mt-2">{filteredIncidents.length}</p>
                      </div>
                      <div className="bg-white/10 rounded-2xl p-4 sm:p-6 backdrop-blur-sm">
                        <p className="text-xs sm:text-sm font-bold text-white/60 uppercase">Pending Leave</p>
                        <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mt-2">{filteredLeaveRequests.filter(r => r.status === 'pending').length}</p>
                      </div>
                    </div>
                    {userRole === UserRole.SUPER_ADMIN && redAlerts.length > 0 && (
                      <div className="mt-6 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-red-500 text-xl">🚨</span>
                          <p className="text-[10px] font-black uppercase tracking-widest text-red-100">Red Alert — High-Risk Guards (Last 30 Days)</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {redAlerts.map(a => (
                            <div key={a.guard_id} className="border-2 border-red-500 animate-pulse rounded-2xl bg-white text-slate-900 p-5 shadow-xl flex items-start justify-between gap-4">
                              <div>
                                <h4 className="font-black uppercase tracking-tight leading-none">{a.full_name}</h4>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">{a.company_name || 'Unassigned'}</p>
                                <p className="mt-2 text-xs text-slate-700">{a.incident_description || 'Most recent incident'}</p>
                              </div>
                              <div className="flex flex-col gap-2">
                                <button
                                  onClick={() => {
                                    const guard = guards.find(x => x.id === a.guard_id);
                                    if (guard) setSelectedGuardForAudit(guard);
                                  }}
                                  className="px-3 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg"
                                >
                                  Review Details
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.patch('/guards/' + a.guard_id, { status: 'blacklisted' });
                                      setGuards(prev => prev.map(g => g.id === a.guard_id ? { ...g, status: 'blacklisted', current_site_id: null, assigned_supervisor_id: null } : g));
                                      setRedAlerts(prev => prev.filter(x => x.guard_id !== a.guard_id));
                                      (window as any).showNotification?.('error', 'Guard immediately blacklisted.');
                                    } catch {
                                      setGuards(prev => prev.map(g => g.id === a.guard_id ? { ...g, status: 'blacklisted', current_site_id: null, assigned_supervisor_id: null } : g));
                                      (window as any).showNotification?.('warning', 'Offline: blacklisted saved locally.');
                                    }
                                  }}
                                  className="px-3 py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg"
                                >
                                  Immediate Blacklist
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-8 bg-white rounded-[2rem] p-6 text-slate-900">
                      <h3 className="text-sm font-black uppercase tracking-widest mb-4">Fleet-Wide Metrics</h3>
                      <PerformanceLineChart
                        guards={filteredGuards}
                        incidents={filteredIncidents}
                        attendanceLogs={attendanceLogs}
                        userRole={userRole}
                        companyId={userCompanyId}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'intake' && (userRole === UserRole.HR_OFFICER || userRole === UserRole.COMPANY_ADMIN) && (
              <IntakeManager guards={guards} userRole={userRole} onComplete={handleIntakeComplete} />
            )}

            {activeTab === 'wait-approval' && (isSystemHR) && (
              <WaitForApproval
                guards={filteredGuards}
                currentUser={user as Profile}
                onOpenDossier={async (g) => {
                  try {
                    const res = await api.get(`/guards/${g.id}`);
                    const fresh = (res && res.data) ? (res.data as Guard) : g;
                    setSelectedGuardForAudit(fresh);
                  } catch {
                    setSelectedGuardForAudit(g);
                  }
                }}
                onApproved={handleApproveToMarketplace}
                onRequestedEdit={handleRequestEditFromHR}
                computeReadiness={computeReadiness}
              />
            )}

            {activeTab === 'vetting' && (isSystemHR || userRole === UserRole.SUPER_ADMIN || userRole === UserRole.HR_OFFICER || userRole === UserRole.COMPANY_ADMIN) && (
              <VettingWorkflow
                guards={filteredGuards}
                sites={filteredSites}
                profiles={profiles}
                companies={companies}
                incidents={filteredIncidents}
                disciplinaryCodes={filteredDisciplinaryCodes}
                onLock={handleLockGuard}
                onFinalize={handleFinalizeVetting}
                currentUser={user as Profile}
                resubmitRequests={resubmitRequests as any}
                onResubmitDecision={async (requestId, guardId, decision) => {
                  try {
                    const { data, error } = await guardService.updateResubmitRequest(requestId, decision);
                    if (error) {
                      setResubmitRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: decision } : r));
                      if (decision === 'approved') {
                        setGuards(prev => prev.map(g => g.id === guardId ? { ...g, status: 'draft' } : g));
                      }
                      (window as any).showNotification?.('warning', 'Offline: decision saved locally.');
                    } else {
                      setResubmitRequests(prev => prev.map(r => r.id === requestId ? { ...r, ...data } : r));
                      if (decision === 'approved') {
                        setGuards(prev => prev.map(g => g.id === guardId ? { ...g, status: 'draft' } : g));
                      }
                      (window as any).showNotification?.('success', `Request ${decision}.`);
                    }
                  } catch (e) {
                    setResubmitRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: decision } : r));
                    if (decision === 'approved') {
                      setGuards(prev => prev.map(g => g.id === guardId ? { ...g, status: 'draft' } : g));
                    }
                    (window as any).showNotification?.('warning', 'Error: decision saved locally.');
                  }
                }}
              />
            )}

            {activeTab === 'interview-report' && (userRole === UserRole.HR_OFFICER || userRole === UserRole.COMPANY_ADMIN || userRole === UserRole.SUPER_ADMIN) && (
              <InterviewReport guards={filteredGuards} companyId={userCompanyId} />
            )}

            {activeTab === 'procurement' && (userRole === UserRole.PROCUREMENT || userRole === UserRole.COMPANY_ADMIN) && (
              <ProcurementDashboard
                guards={filteredGuards}
                companyId={dbCompanyId}
                equipment={equipment.filter(e => !e.company_id || e.company_id === dbCompanyId)}
                onIssueKit={handleIssueKit}
              />
            )}
            {activeTab === 'stock-in' && (userRole === UserRole.PROCUREMENT || userRole === UserRole.COMPANY_ADMIN) && (
              <StockInPage companyId={userCompanyId as string} />
            )}

            {activeTab === 'operations' && (userRole === UserRole.SUPERVISOR || userRole === UserRole.COMPANY_ADMIN) && (
              <OperationsEngine
                guards={filteredGuards}
                sites={filteredSites}
                incidents={filteredIncidents}
                onReportIncident={handleReportIncident}
                onClockIn={handleClockIn}
                disciplinaryCodes={filteredDisciplinaryCodes}
                userName={currentUserName}
                currentUser={user as Profile}
                companies={companies}
                profiles={profiles}
              />
            )}

            {activeTab === 'roster' && (userRole === UserRole.SUPERVISOR || userRole === UserRole.HR_OFFICER || userRole === UserRole.COMPANY_ADMIN || userRole === UserRole.SUPER_ADMIN) && (
              <RosterManager
                guards={filteredGuards}
                sites={filteredSites}
                currentUser={user as Profile}
                userRole={userRole}
              />
            )}

            {activeTab === 'tactical-monitor' && (userRole === UserRole.SUPERVISOR || userRole === UserRole.COMPANY_ADMIN) && (
              <TacticalMonitor
                sites={filteredSites}
                guards={filteredGuards}
                attendanceLogs={attendanceLogs}
              />
            )}

            {activeTab === 'disciplinary' && userRole && (userRole === UserRole.HR_OFFICER || userRole === UserRole.COMPANY_ADMIN || userRole === UserRole.SUPER_ADMIN) && (
              <DisciplinaryManager
                guards={filteredGuards}
                profiles={profiles}
                incidents={filteredIncidents}
                disciplinaryCodes={filteredDisciplinaryCodes}
                leaveRequests={filteredLeaveRequests}
                sites={filteredSites}
                onUpdateLeaveStatus={handleUpdateLeave}
                onViewGuardAudit={async (g) => {
                  try {
                    const res = await api.get(`/guards/${g.id}`);
                    const fresh = (res && res.data) ? (res.data as Guard) : g;
                    setSelectedGuardForAudit(fresh);
                  } catch {
                    setSelectedGuardForAudit(g);
                  }
                }}
                onAddPolicy={handleAddPolicy}
                onUpdatePolicy={handleUpdatePolicy}
                onDeletePolicy={handleDeletePolicy}
                onAfterSaveRecord={async (guardId: string, penaltyPoints: number) => {
                  const codePts = Math.abs(penaltyPoints || 0);
                  setGuards(prev => prev.map(g => {
                    if (g.id === guardId) {
                      const current = typeof g.performance_score === 'number' ? g.performance_score : (g.profile_score || 0);
                      const next = Math.max(0, current - codePts);
                      const nextStatus = (next <= 5) ? 'blacklisted' : (g as any).status;
                      return { ...g, performance_score: next, status: nextStatus as any };
                    }
                    return g;
                  }));
                  try {
                    const current = guards.find(g => g.id === guardId);
                    const base = typeof current?.performance_score === 'number' ? current?.performance_score : (current?.profile_score || 0);
                    const next = Math.max(0, (base || 0) - codePts);
                    const patchPayload: any = { performance_score: next };
                    if (next <= 5) patchPayload.status = 'blacklisted';
                    await api.patch('/guards/' + guardId, patchPayload);
                  } catch { }
                }}
              />
            )}

            {activeTab === 'sites' && (userRole === UserRole.COMPANY_ADMIN || userRole === UserRole.SUPER_ADMIN) && (
              <SiteManager
                sites={filteredSites}
                profiles={profiles}
                guards={filteredGuards}
                onAddSite={async (site) => {
                  const newSite = {
                    ...site,
                    company_id: userCompanyId as string
                  } as Site;
                  try {
                    const result = await api.post('/sites', {
                      name: newSite.name,
                      lat: newSite.lat,
                      lng: newSite.lng,
                      geofence_radius_meters: newSite.geofence_radius_meters,
                      company_id: newSite.company_id,
                      supervisor_id: newSite.supervisor_id || null
                    });
                    const data = result.data as Site;
                    if (data) {
                      setSites(prev => [data, ...prev]);
                      (window as any).showNotification?.('success', 'Site created.');
                    } else {
                      setSites(prev => [{ ...newSite, id: `s-${Date.now()}` }, ...prev]);
                      (window as any).showNotification?.('warning', 'Offline: site added locally.');
                    }
                  } catch (e) {
                    setSites(prev => [{ ...newSite, id: `s-${Date.now()}` }, ...prev]);
                    (window as any).showNotification?.('warning', 'Error: site added locally.');
                  }
                }}
                onShiftPersonnel={handleShiftPersonnel}
              />
            )}

            {activeTab === 'blacklisted' && (userRole === UserRole.HR_OFFICER || userRole === UserRole.COMPANY_ADMIN || userRole === UserRole.SUPER_ADMIN || userRole === UserRole.SUPERVISOR) && (
              <BlacklistManager
                guards={blacklistedGuards}
                incidents={filteredIncidents}
                disciplinaryCodes={userRole === UserRole.SUPERVISOR ? disciplinaryCodes : filteredDisciplinaryCodes}
                companies={companies}
                userRole={userRole}
                onReinstateGuard={handleReinstate}
              />
            )}

            {activeTab === 'registry' && userRole && (userRole === UserRole.HR_OFFICER || userRole === UserRole.COMPANY_ADMIN || userRole === UserRole.SUPER_ADMIN) && (
              <PersonnelRegistry
                profiles={profiles}
                guards={guards}
                companies={companies}
                sites={sites}
                onUpdateStaff={() => alert('Staff update not implemented in mock')}
                onAddStaff={handleAddStaff}
                onViewGuardAudit={setSelectedGuardForAudit}
                currentUser={user as Profile}
                onOpenIntakeEditor={(guard) => { setSelectedGuardForIntake(guard); setActiveTab('profile-update'); }}
              />
            )}

            {activeTab === 'companies' && userRole === UserRole.SUPER_ADMIN && (
              <CompanyRegistry
                companies={companies}
                profiles={profiles}
                guards={guards}
                incidents={incidents}
                onAddCompany={handleAddCompany}
                onUpdateCompany={handleUpdateCompany}
                onAddStaff={handleAddStaff}
                onToggleActive={handleToggleCompanyActive}
              />
            )}

            {activeTab === 'architecture' && userRole === UserRole.SUPER_ADMIN && <ArchitectureOverview />}
            {activeTab === 'erd-view' && userRole === UserRole.SUPER_ADMIN && <ERDView />}
            {activeTab === 'sql-schema' && userRole === UserRole.SUPER_ADMIN && <CodeBlock code={AMINI_SQL_SCHEMA} />}
          </>
        )}

        {!isGuard && isApplicant && (
          <>
            {activeTab === 'application-status' && (
              <ApplicantDashboard
                guard={
                  (guards.find(g => g.id === (user as Profile).id || g.email === (user as Profile).email) as Guard) ||
                  ({
                    id: (user as Profile).id,
                    full_name: (user as Profile).full_name,
                    email: (user as Profile).email,
                    status: 'draft'
                  } as any)
                }
                userId={(user as Profile).id}
                guardsCount={guards.length}
                onRetry={async () => {
                  try {
                    const guardsRes = await guardService.getGuards();
                    if (guardsRes.data) setGuards(guardsRes.data);
                  } catch (e) { }
                }}
                onContinue={() => setActiveTab('profile-update')}
                onRequestEdit={async (reason: string) => {
                  try {
                    const targetGuard = guards.find(g => g.id === (user as Profile).id || g.email === (user as Profile).email) || ({
                      id: (user as Profile).id
                    } as any);
                    if (!targetGuard) return;
                    const payload = {
                      id: `rr-${Date.now()}`,
                      guard_id: targetGuard.id,
                      company_id: userCompanyId,
                      reason,
                      status: 'pending',
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    };
                    setResubmitRequests(prev => [payload, ...prev]);
                    await api.post('/resubmit-requests', payload);
                    (window as any).showNotification?.('success', 'Edit request submitted.');
                  } catch (e) {
                    (window as any).showNotification?.('warning', 'Error: request saved locally.');
                  }
                }}
              />
            )}
            {activeTab === 'profile-update' && (
              <IntakeManager
                guards={guards}
                userRole={userRole}
                onComplete={handleIntakeComplete}
                isApplicantFlow={true}
                applicantData={
                  (guards.find(g => g.id === (user as Profile).id || g.email === (user as Profile).email) as Guard) ||
                  ({
                    id: (user as Profile).id,
                    full_name: (user as Profile).full_name,
                    email: (user as Profile).email,
                    status: 'draft'
                  } as any)
                }
              />
            )}
          </>
        )}

        {isGuard && user && (
          <>
            {activeTab === 'overview' && (String((user as any)?.status || '').toLowerCase() === 'active') && (
              <GuardProfile guard={user as Guard} />
            )}
            {activeTab === 'application-status' && (String((user as any)?.status || '').toLowerCase() !== 'active') && (
              <ApplicantDashboard
                guard={user as Guard}
                onContinue={() => setActiveTab('profile-update')}
                onRequestEdit={async (reason: string) => {
                  try {
                    const payload = {
                      id: `rr-${Date.now()}`,
                      guard_id: (user as Guard)?.id || '',
                      company_id: userCompanyId,
                      reason,
                      status: 'pending',
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    };
                    setResubmitRequests(prev => [payload, ...prev]);
                    await api.post('/resubmit-requests', payload);
                    (window as any).showNotification?.('success', 'Edit request submitted.');
                  } catch (e) {
                    console.error('Error submitting request:', e);
                    (window as any).showNotification?.('warning', 'Error: request saved locally.');
                  }
                }}
              />
            )}
            {activeTab === 'profile-update' && (String((user as any)?.status || '').toLowerCase() !== 'active') && (
              <IntakeManager guards={guards} userRole={userRole} onComplete={handleIntakeComplete} isApplicantFlow={true} applicantData={user as Guard} />
            )}
            {activeTab === 'operations' && (String((user as any)?.status || '').toLowerCase() === 'active') && (
              <GuardOperations
                guard={user as Guard}
                site={guardSite}
                supervisor={guardSupervisor}
                announcements={filteredAnnouncements}
                leaveRequests={filteredLeaveRequests.filter(r => r.guard_id === (user as Guard)?.id)}
                onReportProblem={handleGuardReportProblem}
                onRequestLeave={handleLeaveRequest}
              />
            )}
            {activeTab === 'notice-board' && (String((user as any)?.status || '').toLowerCase() !== 'active') && (
              <NoticeBoard guard={user as Guard} announcements={filteredAnnouncements} />
            )}
          </>
        )}

        {userRole && (userRole === UserRole.HR_OFFICER || userRole === UserRole.COMPANY_ADMIN || userRole === UserRole.SUPER_ADMIN) && selectedGuardForIntake && activeTab === 'profile-update' && (
          <IntakeManager
            guards={guards}
            userRole={userRole}
            onComplete={handleIntakeComplete}
            isApplicantFlow={true}
            applicantData={selectedGuardForIntake}
          />
        )}

        {selectedGuardForAudit && (
          <ForensicDisclosure
            guard={selectedGuardForAudit}
            incidents={incidents}
            disciplinaryCodes={disciplinaryCodes}
            onClose={() => setSelectedGuardForAudit(null)}
          />
        )}
      </Layout>
    </NotificationManager>
  );
};

export default App;
