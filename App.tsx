import { guardService } from './services/guardService';
import { generateAIResponse } from './services/ai';
import React, { useState, useMemo, useEffect } from 'react'; // ✅ Added useEffect here
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
import ForensicDisclosure from './components/ForensicDisclosure';
import GuardApplication from './components/GuardApplication';
import { NotificationManager } from './components/Notification';
import { AMINI_SQL_SCHEMA } from './constants/sql';
import { supabase } from './services/supabaseClient'; // ✅ Moved import to TOP level
import { 
  MOCK_COMPANIES, MOCK_PROFILES, MOCK_SITES, MOCK_GUARDS, 
  MOCK_INCIDENTS, MOCK_EQUIPMENT, MOCK_DISCIPLINARY_CODES,
  MOCK_LEAVE_REQUESTS, MOCK_ATTENDANCE, MOCK_ANNOUNCEMENTS 
} from './constants/mock';
import { Guard, Profile, UserRole, ApplicationStatus, Company, Site, IncidentReport, DisciplinaryCode, LeaveRequest, Announcement } from './types';

const App: React.FC = () => {
  // --- COMBINED DIAGNOSTIC & AI TEST (Single useEffect to prevent duplicates) ---
  useEffect(() => {
    const runDiagnostics = async () => {
      // Prevent multiple executions in development (React Strict Mode)
      if ((window as any)._aminiDiagnosticsRun) return;
      (window as any)._aminiDiagnosticsRun = true;

      console.log("🔍 STARTING SUPABASE DIAGNOSTIC...");

      // Test Supabase connection
      const url = (import.meta as any).env.VITE_SUPABASE_URL;
      const key = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

      if (!url || !key) {
        alert("❌ CRITICAL: Supabase Keys are MISSING in .env.local");
        return;
      }

      const { data, count, error } = await supabase
        .from('guards')
        .select('id', { count: 'exact' })
        .limit(1);

      if (error) {
        console.error("❌ SUPABASE ERROR:", error);
        alert(`❌ Connection Failed: ${error.message}`);
      } else {
        console.log("✅ SUPABASE SUCCESS:", { count });
      }

      // Only test AI in production or if explicitly enabled (to avoid rate limits)
      const shouldTestAI = import.meta.env.PROD || import.meta.env.VITE_TEST_AI === 'true';

      if (shouldTestAI) {
        console.log("🤖 Testing Gemini Connection...");

        try {
          const response = await generateAIResponse("Write a one-sentence slogan for a security company.");
          console.log("🤖 Gemini Response:", response);

          if (response.startsWith("Error") || response.startsWith("Failed")) {
            console.warn("⚠️ AI Test Failed - this is expected on free tier");
          }
        } catch (error) {
          console.warn("⚠️ AI Test Error:", error.message);
        }
      } else {
        console.log("🤖 Skipping AI test in development (to avoid rate limits)");
      }
    };

    runDiagnostics();
  }, []);
  // --- END DIAGNOSTIC CODE ---


useEffect(() => {
    const fetchRealData = async () => {
      console.log("📥 App: Fetching data from Supabase...");

      try {
        // Load guards
        const { data: guardData, error: guardError } = await guardService.getGuards();
        if (guardError) {
          console.error("❌ Failed to fetch guards:", guardError);
        } else if (guardData) {
          console.log(`✅ Loaded ${guardData.length} guards from database.`);
          setGuards(guardData);
        }

        // Load sites from Supabase directly (since sites table exists)
        const { data: siteData, error: siteError } = await supabase
          .from('sites')
          .select('*')
          .order('created_at', { ascending: false });

        if (siteError) {
          console.error("❌ Failed to fetch sites:", siteError);
        } else if (siteData) {
          console.log(`✅ Loaded ${siteData.length} sites from database.`);
          setSites(siteData);
        }

        // Load profiles from Supabase directly (since profiles table exists)
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (profileError) {
          console.error("❌ Failed to fetch profiles:", profileError);
        } else if (profileData) {
          console.log(`✅ Loaded ${profileData.length} profiles from database.`);
          setProfiles(profileData);
        }

        // Load companies from Supabase directly (since companies table exists)
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .order('created_at', { ascending: false });

        if (companyError) {
          console.error("❌ Failed to fetch companies:", companyError);
        } else if (companyData) {
          console.log(`✅ Loaded ${companyData.length} companies from database.`);
          setCompanies(companyData);
        }

        const { data: resubData, error: resubError } = await supabase
          .from('resubmit_requests')
          .select('*')
          .order('created_at', { ascending: false });
        if (resubError) {
          console.error("❌ Failed to fetch resubmit requests:", resubError);
        } else if (resubData) {
          setResubmitRequests(resubData);
        }

        // TODO: Load incidents, equipment, disciplinary_codes, leave_requests, attendance_logs, announcements
        // These would need to be implemented in the service layer or loaded directly from Supabase
        // For now, keeping mock data as fallback

      } catch (error) {
        console.error("❌ Error fetching data:", error);
      }
    };

    fetchRealData();
  }, []);
  // --- Global State ---
  const [user, setUser] = useState<Profile | Guard | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedGuardForAudit, setSelectedGuardForAudit] = useState<Guard | null>(null);
  const [showGuardApplication, setShowGuardApplication] = useState(false);

  // --- Data State (Mock Database) ---
  const [companies, setCompanies] = useState<Company[]>(MOCK_COMPANIES);
  const [profiles, setProfiles] = useState<Profile[]>(MOCK_PROFILES);
  const [sites, setSites] = useState<Site[]>(MOCK_SITES);
  const [guards, setGuards] = useState<Guard[]>(MOCK_GUARDS);
  const [incidents, setIncidents] = useState<IncidentReport[]>(MOCK_INCIDENTS);
  const [equipment, setEquipment] = useState(MOCK_EQUIPMENT);
  const [disciplinaryCodes, setDisciplinaryCodes] = useState<DisciplinaryCode[]>(MOCK_DISCIPLINARY_CODES);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(MOCK_LEAVE_REQUESTS);
  const [attendanceLogs, setAttendanceLogs] = useState(MOCK_ATTENDANCE);
  const [announcements, setAnnouncements] = useState<Announcement[]>(MOCK_ANNOUNCEMENTS);
  const [resubmitRequests, setResubmitRequests] = useState<any[]>([]);
  const [dbCompanyId, setDbCompanyId] = useState<string | undefined>(undefined);

  // --- Derived State Helpers ---
  const isGuard = user && !('role' in user);
  const userRole = isGuard ? UserRole.GUARD : (user as Profile)?.role;
  const userCompanyId = isGuard ? (user as Guard).company_id : (user as Profile)?.company_id;
  const currentUserName = user?.full_name || 'N/A';

  useEffect(() => {
    const resolveCompanyUuid = async () => {
      if (!userCompanyId || userRole === UserRole.SUPER_ADMIN) {
        setDbCompanyId(undefined);
        return;
      }
      const mockCompany = MOCK_COMPANIES.find(c => c.id === userCompanyId);
      const desiredSlug = mockCompany?.slug;
      const desiredName = mockCompany?.name;
      const desiredEmail = mockCompany?.contact_email || 'ops@company.local';
      if (!desiredSlug || !desiredName) {
        setDbCompanyId(undefined);
        return;
      }
      const match = companies.find(c => c.slug === desiredSlug || c.name === desiredName);
      if (match) {
        setDbCompanyId(match.id);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('companies')
          .insert({
            name: desiredName,
            slug: desiredSlug,
            contact_email: desiredEmail,
            is_active: true
          })
          .select('*')
          .single();
        if (!error && data?.id) {
          setDbCompanyId(data.id);
          setCompanies(prev => [data as Company, ...prev]);
        }
      } catch {
        setDbCompanyId(undefined);
      }
    };
    resolveCompanyUuid();
  }, [userCompanyId, userRole, companies]);

  // Filter data based on Multi-Tenancy
  const filteredGuards = useMemo(() => {
    if (userRole === UserRole.SUPER_ADMIN) return guards;
    if (isGuard) return [user as Guard]; 
    return guards.filter(g => !g.company_id || g.company_id === userCompanyId); 
  }, [guards, userRole, userCompanyId, isGuard, user]);

  const filteredSites = useMemo(() => {
    if (userRole === UserRole.SUPER_ADMIN) return sites;
    return sites.filter(s => s.company_id === userCompanyId);
  }, [sites, userRole, userCompanyId]);

  const filteredIncidents = useMemo(() => {
    if (userRole === UserRole.SUPER_ADMIN) return incidents;
    const companyGuardIds = guards.filter(g => g.company_id === userCompanyId).map(g => g.id);
    return incidents.filter(i => companyGuardIds.includes(i.guard_id));
  }, [incidents, userRole, userCompanyId, guards]);

  const filteredAnnouncements = useMemo(() => {
     if (userRole === UserRole.SUPER_ADMIN) return announcements;
     return announcements.filter(a => a.company_id === userCompanyId);
  }, [announcements, userRole, userCompanyId]);

  const filteredLeaveRequests = useMemo(() => {
      if (userRole === UserRole.SUPER_ADMIN) return leaveRequests;
      const companyGuardIds = guards.filter(g => g.company_id === userCompanyId).map(g => g.id);
      return leaveRequests.filter(r => companyGuardIds.includes(r.guard_id));
  }, [leaveRequests, userRole, userCompanyId, guards]);

  const filteredDisciplinaryCodes = useMemo(() => {
      if (userRole === UserRole.SUPER_ADMIN) return disciplinaryCodes;
      return disciplinaryCodes.filter(c => !c.company_id || c.company_id === userCompanyId);
  }, [disciplinaryCodes, userCompanyId, userRole]);


  // --- Actions ---

  const handleLogin = (loggedInUser: Profile | Guard) => {
    const pendingAccount = localStorage.getItem('pending_guard_account');
    let finalUser = loggedInUser;
    let needsIntake = false;

    if (pendingAccount && !('role' in loggedInUser)) {
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

    if (!('role' in finalUser)) { 
      const g = finalUser as Guard;
      if (needsIntake) {
        setActiveTab('profile-update');
        return;
      }
      if (g.application_status === ApplicationStatus.DRAFT) {
        setActiveTab('profile-update');
      } else if (g.application_status === ApplicationStatus.ACTIVE) {
        setActiveTab('overview');
      } else {
        setActiveTab('application-status');
      }
    } else {
      setActiveTab('overview');
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    setUser(null);
    setActiveTab('overview');
  };

  const handlePublicApply = (newGuard: Guard) => {
    const existing = guards.find(g => g.nida_number === newGuard.nida_number);
    if (existing && existing.application_status === ApplicationStatus.BLACKLISTED) {
      alert(`Access Denied: Blacklisted.`);
      return;
    }
    setGuards(prev => [...prev, newGuard]);
    handleLogin(newGuard);
  };

  const handleIntakeComplete = (newGuard: Guard, isApplicantFlow = false) => {
    if (isApplicantFlow) {
      setGuards(prev => prev.map(g =>
        g.id === newGuard.id
          ? {
              ...newGuard,
              application_status: ApplicationStatus.POOL_APPLICANT,
              profile_score: newGuard.profile_score || 0,
              updated_at: new Date().toISOString()
            }
          : g
      ));
      localStorage.removeItem('pending_guard_account');
      (window as any).showNotification?.('success', 'Application complete!');
    } else {
      const guardWithCompany = {
        ...newGuard,
        company_id: userCompanyId,
        application_status: ApplicationStatus.PENDING
      };
      setGuards(prev => [...prev, guardWithCompany]);
      (window as any).showNotification?.('success', 'Personnel added.');
    }
  };

  const handleLockGuard = async (guardId: string, companyId: string, notes: string, schedule?: { date: string; location: string }) => {
    console.log('🚀 Action Started: handleLockGuard');
    console.log('📦 Payload:', { guardId, companyId, notes, schedule });
    try {
      const { data, error } = await supabase
        .from('guards')
        .update({
          application_status: ApplicationStatus.INTERVIEW_LOCKED,
          company_id: companyId,
          dossier_data: { interviewer_notes: notes, interview_schedule: schedule || null }
        })
        .eq('id', guardId)
        .select()
        .single();
      if (error) {
        console.error('Failed to persist lock:', error);
        setGuards(prev => prev.map(g => {
          if (g.id === guardId) {
            return {
              ...g,
              application_status: ApplicationStatus.INTERVIEW_LOCKED,
              company_id: companyId,
              dossier_data: { ...g.dossier_data, interviewer_notes: notes, interview_schedule: schedule || null }
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
      console.error('🔥 Supabase Error:', e);
      console.error('Error locking applicant:', e);
      setGuards(prev => prev.map(g => {
        if (g.id === guardId) {
          return {
            ...g,
            application_status: ApplicationStatus.INTERVIEW_LOCKED,
            company_id: companyId,
            dossier_data: { ...g.dossier_data, interviewer_notes: notes, interview_schedule: schedule || null }
          };
        }
        return g;
      }));
      (window as any).showNotification?.('warning', 'Error: lock saved locally.');
    }
  };

  const handleFinalizeVetting = async (guardId: string, result: 'pass' | 'fail' | 'blacklist', terms?: any, reason?: string) => {
    console.log('🚀 Action Started: handleFinalizeVetting');
    console.log('📦 Payload:', { guardId, result, terms, reason });
    try {
      if (result === 'pass' && terms) {
        const updatePayload = {
          application_status: ApplicationStatus.PROCUREMENT_PENDING,
          agreed_salary: Number(terms.salary),
          contract_start_date: terms.startDate || null,
          contract_end_date: terms.endDate || null,
          employment_contract_url: terms.contractUrl || null,
          current_site_id: terms.siteId || null,
          assigned_supervisor_id: terms.supervisorId || null
        };
        const { data, error } = await supabase
          .from('guards')
          .update(updatePayload)
          .eq('id', guardId)
          .select()
          .single();
        if (error) {
          console.error('Failed to persist hiring:', error);
          setGuards(prev => prev.map(g => g.id === guardId ? { ...g, ...updatePayload } : g));
          (window as any).showNotification?.('warning', 'Offline: hiring saved locally.');
        } else {
          setGuards(prev => prev.map(g => g.id === guardId ? { ...g, ...data } : g));
          (window as any).showNotification?.('success', 'Hiring finalized.');
        }
      } else if (result === 'blacklist') {
        const updatePayload = {
          application_status: ApplicationStatus.BLACKLISTED,
          dossier_data: { rejection_reason: reason }
        };
        const { data, error } = await supabase
          .from('guards')
          .update(updatePayload)
          .eq('id', guardId)
          .select()
          .single();
        if (error) {
          console.error('Failed to persist blacklist:', error);
          setGuards(prev => prev.map(g => g.id === guardId ? { ...g, ...updatePayload } : g));
          (window as any).showNotification?.('warning', 'Offline: blacklist saved locally.');
        } else {
          setGuards(prev => prev.map(g => g.id === guardId ? { ...g, ...data } : g));
          (window as any).showNotification?.('success', 'Applicant blacklisted.');
        }
      } else {
        const updatePayload = {
          application_status: ApplicationStatus.POOL_APPLICANT,
          company_id: null,
          dossier_data: { rejection_reason: reason }
        };
        const { data, error } = await supabase
          .from('guards')
          .update(updatePayload)
          .eq('id', guardId)
          .select()
          .single();
        if (error) {
          console.error('Failed to persist rejection:', error);
          setGuards(prev => prev.map(g => g.id === guardId ? { ...g, ...updatePayload } : g));
          (window as any).showNotification?.('warning', 'Offline: rejection saved locally.');
        } else {
          setGuards(prev => prev.map(g => g.id === guardId ? { ...g, ...data } : g));
          (window as any).showNotification?.('success', 'Applicant released to pool.');
        }
      }
    } catch (e) {
      console.error('🔥 Supabase Error:', e);
      console.error('Error finalizing vetting:', e);
    }
  };

  const handleIssueKit = (guardId: string, items: any, sig: string) => {
      setGuards(prev => prev.map(g => g.id === guardId ? { ...g, application_status: ApplicationStatus.ACTIVE, performance_score: 100 } : g));
  };

  const handleReportIncident = async (guardId: string, report: Partial<IncidentReport>) => {
      console.log('🚀 Action Started: handleReportIncident');
      console.log('📦 Payload:', { guardId, report });
      const newIncident: IncidentReport = {
          id: `inc-${Date.now()}`,
          guard_id: guardId,
          code: report.code || 'OTHER',
          notes: report.notes || '',
          evidence_url: report.evidence_url || '',
          reported_by: report.reported_by || 'Unknown',
          site_id: report.site_id,
          site_name: report.site_name,
          created_at: new Date().toISOString()
      };
      setIncidents(prev => [newIncident, ...prev]);
      try {
        const { error } = await supabase.from('incidents').insert({
          guard_id: newIncident.guard_id,
          code: newIncident.code,
          notes: newIncident.notes,
          evidence_url: newIncident.evidence_url,
          reported_by: newIncident.reported_by,
          site_id: newIncident.site_id,
          site_name: newIncident.site_name,
          created_at: newIncident.created_at
        });
        if (error) {
          console.error('🔥 Supabase Error:', error);
          console.error('Failed to persist incident:', error);
        }
      } catch (e) {
        console.error('Error persisting incident:', e);
      }
      
      const code = disciplinaryCodes.find(c => c.code === report.code);
      if (code) {
          setGuards(prev => prev.map(g => {
              if (g.id === guardId) {
                  const newScore = Math.max(0, (g.performance_score || 100) - code.points);
                  return { ...g, performance_score: newScore };
              }
              return g;
          }));
      }

      const current = guards.find(g => g.id === guardId);
      const scoreAfter = Math.max(0, (current?.performance_score || 100) - (code?.points || 0));
      if (scoreAfter <= 5) {
        setGuards(prev => prev.map(g => g.id === guardId ? { ...g, application_status: ApplicationStatus.BLACKLISTED, performance_score: scoreAfter } : g));
        try {
          const { error } = await supabase.from('guards').update({ application_status: ApplicationStatus.BLACKLISTED, performance_score: scoreAfter }).eq('id', guardId);
          if (error) console.error('Failed to update guard status:', error);
        } catch (e) {
          console.error('Error updating guard status:', e);
        }
      }
  };

  const handleClockIn = async (guardId: string, siteId?: string) => {
    const site = sites.find(s => s.id === (siteId || guards.find(g => g.id === guardId)?.current_site_id));
    if (!site) return;
    const log = {
      id: `al-${Date.now()}`,
      guard_id: guardId,
      site_id: site.id,
      supervisor_id: profiles.find(p => p.current_site_id === site.id && p.role === UserRole.SUPERVISOR)?.id || '',
      checked_in_at: new Date().toISOString(),
      lat: site.lat,
      lng: site.lng,
      distance_meters: 0,
      status: 'present' as const
    };
    setAttendanceLogs(prev => [log, ...prev]);
    try {
      const { error } = await supabase.from('attendance_logs').insert(log);
      if (error) console.error('Failed to persist attendance:', error);
    } catch (e) {
      console.error('Error persisting attendance:', e);
    }
  };

  const handleReinstate = (guardId: string) => {
      setGuards(prev => prev.map(g => g.id === guardId ? { ...g, application_status: ApplicationStatus.POOL_APPLICANT, company_id: undefined, performance_score: 100 } : g));
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
      const { error } = await supabase.from('disciplinary_codes').insert(payload);
      if (error) console.error('Failed to persist policy:', error);
    } catch (e) {
      console.error('Error persisting policy:', e);
    }
  };

  const handleUpdatePolicy = async (code: string, updates: Partial<DisciplinaryCode>) => {
    setDisciplinaryCodes(prev => prev.map(c => 
        (c.code === code) ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
    ));
    try {
      const { error } = await supabase.from('disciplinary_codes').update({ ...updates, updated_at: new Date().toISOString() }).eq('code', code);
      if (error) console.error('Failed to update policy:', error);
    } catch (e) {
      console.error('Error updating policy:', e);
    }
  };

  const handleDeletePolicy = async (code: string) => {
    setDisciplinaryCodes(prev => prev.filter(c => c.code !== code));
    try {
      const { error } = await supabase.from('disciplinary_codes').delete().eq('code', code);
      if (error) console.error('Failed to delete policy:', error);
    } catch (e) {
      console.error('Error deleting policy:', e);
    }
  };
  
  const handleGuardReportProblem = (desc: string, evidence?: string) => {
      if (!isGuard) return;
      handleReportIncident((user as Guard).id, { code: 'OTHER_REPORT', notes: desc, evidence_url: evidence, reported_by: (user as Guard).full_name });
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

  if (!user) {
    if (showGuardApplication && window.innerWidth >= 1024) {
      return (
        <NotificationManager>
          <div className="min-h-screen bg-background overflow-y-auto" style={{ scrollBehavior: 'smooth' }}>
            <GuardApplication
              onComplete={(guard) => setShowGuardApplication(false)}
              onBackToLogin={() => setShowGuardApplication(false)}
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
      >
      {!isGuard && (
        <>
            {activeTab === 'overview' && (
                <div className="space-y-16 animate-in fade-in duration-700">
                    <div className="bg-slate-900 rounded-[2.5rem] p-12 text-white shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/20 rounded-full blur-3xl -mr-40 -mt-40 pointer-events-none" />
                        <div className="relative z-10">
                            <h1 className="text-5xl font-black uppercase tracking-tight leading-none mb-8">
                                Dashboard <br />
                                <span className="text-primary text-4xl">Overview</span>
                            </h1>
                            <div className="grid grid-cols-4 gap-6">
                                <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm">
                                    <p className="text-sm font-bold text-white/60 uppercase">Active Guards</p>
                                    <p className="text-4xl font-black text-white mt-2">{filteredGuards.filter(g => g.application_status === ApplicationStatus.ACTIVE).length}</p>
                                </div>
                                <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm">
                                    <p className="text-sm font-bold text-white/60 uppercase">Total Sites</p>
                                    <p className="text-4xl font-black text-white mt-2">{filteredSites.length}</p>
                                </div>
                                <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm">
                                    <p className="text-sm font-bold text-white/60 uppercase">Incidents</p>
                                    <p className="text-4xl font-black text-white mt-2">{filteredIncidents.length}</p>
                                </div>
                                <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm">
                                    <p className="text-sm font-bold text-white/60 uppercase">Pending Leave</p>
                                    <p className="text-4xl font-black text-white mt-2">{filteredLeaveRequests.filter(r => r.status === 'pending').length}</p>
                                </div>
                            </div>
                            <div className="mt-8 bg-white rounded-[2rem] p-6 text-slate-900">
                                <h3 className="text-sm font-black uppercase tracking-widest mb-4">Fleet-Wide Metrics</h3>
                                <PerformanceLineChart />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'intake' && (userRole === UserRole.HR_OFFICER || userRole === UserRole.COMPANY_ADMIN) && (
                <IntakeManager guards={guards} userRole={userRole} onComplete={handleIntakeComplete} />
            )}

            {activeTab === 'vetting' && (userRole === UserRole.HR_OFFICER || userRole === UserRole.COMPANY_ADMIN) && (
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
                          console.error('Failed to update resubmit request:', error);
                          setResubmitRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: decision } : r));
                          if (decision === 'approved') {
                            setGuards(prev => prev.map(g => g.id === guardId ? { ...g, application_status: ApplicationStatus.DRAFT } : g));
                          }
                          (window as any).showNotification?.('warning', 'Offline: decision saved locally.');
                        } else {
                          setResubmitRequests(prev => prev.map(r => r.id === requestId ? { ...r, ...data } : r));
                          if (decision === 'approved') {
                            setGuards(prev => prev.map(g => g.id === guardId ? { ...g, application_status: ApplicationStatus.DRAFT } : g));
                          }
                          (window as any).showNotification?.('success', `Request ${decision}.`);
                        }
                      } catch (e) {
                        console.error('Error updating resubmit request:', e);
                        setResubmitRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: decision } : r));
                        if (decision === 'approved') {
                          setGuards(prev => prev.map(g => g.id === guardId ? { ...g, application_status: ApplicationStatus.DRAFT } : g));
                        }
                        (window as any).showNotification?.('warning', 'Error: decision saved locally.');
                      }
                    }}
                />
            )}
            
            {activeTab === 'interview-report' && (userRole === UserRole.HR_OFFICER || userRole === UserRole.COMPANY_ADMIN) && (
                <InterviewReport guards={filteredGuards} />
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
                <StockInPage companyId={dbCompanyId} />
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
                    onViewGuardAudit={setSelectedGuardForAudit}
                    onAddPolicy={handleAddPolicy}
                    onUpdatePolicy={handleUpdatePolicy}
                    onDeletePolicy={handleDeletePolicy}
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
                        const { data, error } = await supabase
                          .from('sites')
                          .insert({
                            name: newSite.name,
                            lat: newSite.lat,
                            lng: newSite.lng,
                            geofence_radius_meters: newSite.geofence_radius_meters,
                            company_id: newSite.company_id,
                            supervisor_id: newSite.supervisor_id || null
                          })
                          .select()
                          .single();
                        if (error) {
                          console.error('Failed to add site:', error);
                          setSites(prev => [{ ...newSite, id: `s-${Date.now()}` }, ...prev]);
                          (window as any).showNotification?.('warning', 'Offline: site added locally.');
                        } else {
                          setSites(prev => [data as Site, ...prev]);
                          (window as any).showNotification?.('success', 'Site created.');
                        }
                      } catch (e) {
                        console.error('Error adding site:', e);
                        setSites(prev => [{ ...newSite, id: `s-${Date.now()}` }, ...prev]);
                        (window as any).showNotification?.('warning', 'Error: site added locally.');
                      }
                    }}
                    onShiftPersonnel={handleShiftPersonnel}
                />
            )}

            {activeTab === 'blacklist' && (userRole === UserRole.HR_OFFICER || userRole === UserRole.COMPANY_ADMIN || userRole === UserRole.SUPER_ADMIN || userRole === UserRole.SUPERVISOR) && (
                <BlacklistManager 
                    guards={userRole === UserRole.SUPERVISOR ? guards : filteredGuards}
                    incidents={userRole === UserRole.SUPERVISOR ? incidents : filteredIncidents}
                    disciplinaryCodes={userRole === UserRole.SUPERVISOR ? disciplinaryCodes : filteredDisciplinaryCodes}
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

      {isGuard && user && (
        <>
            {activeTab === 'overview' && (user as Guard).application_status === ApplicationStatus.ACTIVE && (
                <GuardProfile guard={user as Guard} />
            )}
            {activeTab === 'application-status' && (user as Guard).application_status !== ApplicationStatus.ACTIVE && (
                <ApplicantDashboard 
                  guard={user as Guard} 
                  onRequestEdit={async (reason: string) => {
                    try {
                      const payload = {
                        id: `rr-${Date.now()}`,
                        guard_id: (user as Guard).id,
                        company_id: userCompanyId,
                        reason,
                        status: 'pending',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                      };
                      setResubmitRequests(prev => [payload, ...prev]);
                      const { error } = await supabase.from('resubmit_requests').insert(payload);
                      if (error) console.error('Failed to persist request:', error);
                      (window as any).showNotification?.('success', 'Edit request submitted.');
                    } catch (e) {
                      console.error('Error submitting request:', e);
                      (window as any).showNotification?.('warning', 'Error: request saved locally.');
                    }
                  }}
                />
            )}
            {activeTab === 'profile-update' && (user as Guard).application_status !== ApplicationStatus.ACTIVE && (
                <IntakeManager guards={guards} userRole={userRole} onComplete={handleIntakeComplete} isApplicantFlow={true} applicantData={user as Guard} />
            )}
            {activeTab === 'operations' && (user as Guard).application_status === ApplicationStatus.ACTIVE && (
                <GuardOperations 
                    guard={user as Guard}
                    site={guardSite}
                    supervisor={guardSupervisor}
                    announcements={filteredAnnouncements}
                    leaveRequests={filteredLeaveRequests.filter(r => r.guard_id === user.id)}
                    onReportProblem={handleGuardReportProblem}
                    onRequestLeave={handleLeaveRequest}
                />
            )}
            {activeTab === 'notice-board' && (user as Guard).application_status !== ApplicationStatus.ACTIVE && (
                <NoticeBoard guard={user as Guard} announcements={filteredAnnouncements} />
            )}
        </>
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
