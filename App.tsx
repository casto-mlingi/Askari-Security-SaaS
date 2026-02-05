import { guardService } from './services/guardService';
import { generateAIResponse } from './services/ai';
import React, { useState, useMemo, useEffect } from 'react'; // ✅ Added useEffect here
import Layout from './components/Layout';
import Auth from './components/Auth';
import IntakeManager from './components/IntakeManager';
import VettingWorkflow from './components/VettingWorkflow';
import ProcurementDashboard from './components/ProcurementDashboard';
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
      if (window._aminiDiagnosticsRun) return;
      window._aminiDiagnosticsRun = true;

      console.log("🔍 STARTING SUPABASE DIAGNOSTIC...");

      // Test Supabase connection
      const url = (import.meta as any).env.VITE_SUPABASE_URL;
      const key = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

      if (!url || !key) {
        alert("❌ CRITICAL: Supabase Keys are MISSING in .env.local");
        return;
      }

      const { data, error } = await supabase.from('guards').select('count', { count: 'exact', head: true });

      if (error) {
        console.error("❌ SUPABASE ERROR:", error);
        alert(`❌ Connection Failed: ${error.message}`);
      } else {
        console.log("✅ SUPABASE SUCCESS:", data);
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

  // --- Derived State Helpers ---
  const isGuard = user && !('role' in user);
  const userRole = isGuard ? UserRole.GUARD : (user as Profile)?.role;
  const userCompanyId = isGuard ? (user as Guard).company_id : (user as Profile)?.company_id;
  const currentUserName = user?.full_name || 'N/A';

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
      if (g.application_status === ApplicationStatus.ACTIVE) {
        setActiveTab('overview');
      } else {
        setActiveTab('application-status');
      }
    } else {
      setActiveTab('overview');
    }
  };

  const handleLogout = () => {
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
              profile_score: 75,
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

  const handleLockGuard = (guardId: string, companyId: string, notes: string) => {
    setGuards(prev => prev.map(g => {
        if (g.id === guardId) {
            return {
                ...g,
                application_status: ApplicationStatus.INTERVIEW_LOCKED,
                company_id: companyId,
                dossier_data: { ...g.dossier_data, interviewer_notes: notes }
            };
        }
        return g;
    }));
  };

  const handleFinalizeVetting = (guardId: string, result: 'pass' | 'fail' | 'blacklist', terms?: any, reason?: string) => {
      setGuards(prev => prev.map(g => {
          if (g.id === guardId) {
              if (result === 'pass') {
                  return {
                      ...g,
                      application_status: ApplicationStatus.PROCUREMENT_PENDING,
                      agreed_salary: terms.salary,
                      contract_start_date: terms.startDate,
                      contract_end_date: terms.endDate,
                      employment_contract_url: terms.contractUrl,
                      current_site_id: terms.siteId,
                      assigned_supervisor_id: terms.supervisorId
                  };
              } else if (result === 'blacklist') {
                   return {
                       ...g,
                       application_status: ApplicationStatus.BLACKLISTED,
                       dossier_data: { ...g.dossier_data, rejection_reason: reason }
                   };
              } else {
                  return {
                       ...g,
                       application_status: ApplicationStatus.POOL_APPLICANT,
                       company_id: undefined,
                       dossier_data: { ...g.dossier_data, rejection_reason: reason }
                  };
              }
          }
          return g;
      }));
  };

  const handleIssueKit = (guardId: string, items: any, sig: string) => {
      setGuards(prev => prev.map(g => g.id === guardId ? { ...g, application_status: ApplicationStatus.ACTIVE } : g));
  };

  const handleReportIncident = (guardId: string, report: Partial<IncidentReport>) => {
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
  
  const handleAddPolicy = (policy: DisciplinaryCode) => {
    setDisciplinaryCodes(prev => [...prev, { ...policy, company_id: userCompanyId }]);
  };

  const handleUpdatePolicy = (code: string, updates: Partial<DisciplinaryCode>) => {
    setDisciplinaryCodes(prev => prev.map(c => 
        (c.code === code) ? { ...c, ...updates, updated_at: new Date().toISOString() } : c
    ));
  };

  const handleDeletePolicy = (code: string) => {
    setDisciplinaryCodes(prev => prev.filter(c => c.code !== code));
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
                    incidents={filteredIncidents}
                    disciplinaryCodes={filteredDisciplinaryCodes}
                    onLock={handleLockGuard} 
                    onFinalize={handleFinalizeVetting} 
                    currentUser={user as Profile}
                />
            )}
            
            {activeTab === 'interview-report' && (userRole === UserRole.HR_OFFICER || userRole === UserRole.COMPANY_ADMIN) && (
                <InterviewReport guards={filteredGuards} />
            )}

            {activeTab === 'procurement' && (userRole === UserRole.PROCUREMENT || userRole === UserRole.COMPANY_ADMIN) && (
                <ProcurementDashboard 
                    guards={filteredGuards} 
                    equipment={equipment} 
                    onIssueKit={handleIssueKit} 
                />
            )}

            {activeTab === 'operations' && (userRole === UserRole.SUPERVISOR || userRole === UserRole.COMPANY_ADMIN) && (
                <OperationsEngine 
                    guards={filteredGuards} 
                    sites={filteredSites} 
                    incidents={filteredIncidents}
                    onReportIncident={handleReportIncident}
                    disciplinaryCodes={filteredDisciplinaryCodes}
                    userName={currentUserName}
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
                    onAddSite={() => alert('Add site not implemented in mock')}
                    onShiftPersonnel={handleShiftPersonnel}
                />
            )}

            {activeTab === 'blacklist' && (userRole === UserRole.HR_OFFICER || userRole === UserRole.COMPANY_ADMIN || userRole === UserRole.SUPER_ADMIN) && (
                <BlacklistManager 
                    guards={filteredGuards}
                    incidents={filteredIncidents}
                    disciplinaryCodes={filteredDisciplinaryCodes}
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
                <ApplicantDashboard guard={user as Guard} />
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