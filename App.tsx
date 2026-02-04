
import React, { useState, useMemo } from 'react';
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
import { ASKARI_SQL_SCHEMA } from './constants/sql';
import { 
  MOCK_COMPANIES, MOCK_PROFILES, MOCK_SITES, MOCK_GUARDS, 
  MOCK_INCIDENTS, MOCK_EQUIPMENT, MOCK_DISCIPLINARY_CODES,
  MOCK_LEAVE_REQUESTS, MOCK_ATTENDANCE, MOCK_ANNOUNCEMENTS 
} from './constants/mock';
import { Guard, Profile, UserRole, ApplicationStatus, Company, Site, IncidentReport, DisciplinaryCode, LeaveRequest, Announcement } from './types';

const App: React.FC = () => {
  // --- Global State ---
  const [user, setUser] = useState<Profile | Guard | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedGuardForAudit, setSelectedGuardForAudit] = useState<Guard | null>(null);

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

  // Filter data based on Multi-Tenancy (if not Super Admin)
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
    setUser(loggedInUser);
    if ('role' in loggedInUser) {
       setActiveTab('overview');
    } else {
       const g = loggedInUser as Guard;
       if (g.application_status === ApplicationStatus.ACTIVE) {
         setActiveTab('overview');
       } else {
         setActiveTab('application-status');
       }
    }
  };

  const handleLogout = () => {
    setUser(null);
    setActiveTab('overview');
  };

  const handlePublicApply = (newGuard: Guard) => {
    const existing = guards.find(g => g.nida_number === newGuard.nida_number);
    if (existing && existing.application_status === ApplicationStatus.BLACKLISTED) {
      alert(`Access Denied: The applicant ${newGuard.full_name} and NIDA Number ${newGuard.nida_number} are blacklisted and cannot apply again.`);
      return;
    }
    setGuards(prev => [...prev, newGuard]);
    handleLogin(newGuard);
  };

  const handleIntakeComplete = (newGuard: Guard) => {
    const guardWithCompany = { 
        ...newGuard, 
        company_id: userCompanyId,
        application_status: ApplicationStatus.PENDING 
    };
    setGuards(prev => [...prev, guardWithCompany]);
    alert("New personnel added to the pool.");
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
      setGuards(prev => prev.map(g => {
          if (g.id === guardId) {
              return { ...g, application_status: ApplicationStatus.ACTIVE };
          }
          return g;
      }));
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
                  if (newScore <= 5 && g.application_status !== ApplicationStatus.BLACKLISTED) {
                      setTimeout(() => alert(`SYSTEM ALERT: Guard ${g.full_name} has been automatically blacklisted due to critical performance failure (Score: ${newScore}).`), 100);
                      return {
                          ...g,
                          performance_score: newScore,
                          application_status: ApplicationStatus.BLACKLISTED,
                          dossier_data: {
                              ...g.dossier_data,
                              rejection_reason: `Automatic System Blacklist: Performance score dropped to ${newScore} (Threshold: ≤5). Last Incident: ${code.label}.`
                          }
                      };
                  }
                  return { ...g, performance_score: newScore };
              }
              return g;
          }));
      }
  };

  const handleReinstate = (guardId: string) => {
      setGuards(prev => prev.map(g => 
          g.id === guardId ? { ...g, application_status: ApplicationStatus.POOL_APPLICANT, company_id: undefined, performance_score: 100 } : g
      ));
  };

  const handleShiftPersonnel = (personId: string, targetSiteId: string, type: 'guard' | 'supervisor') => {
      if (type === 'guard') {
          setGuards(prev => prev.map(g => g.id === personId ? { ...g, current_site_id: targetSiteId || undefined } : g));
      } else {
          // Robust supervisor reassignment to fix "Occupied" errors
          setSites(prev => {
              // 1. Remove this supervisor from any site they are currently commanding
              const cleanedSites = prev.map(site => 
                  site.supervisor_id === personId ? { ...site, supervisor_id: undefined } : site
              );
              // 2. If targetSiteId is provided, assign the supervisor to that site
              if (targetSiteId) {
                  return cleanedSites.map(site => 
                      site.id === targetSiteId ? { ...site, supervisor_id: personId } : site
                  );
              }
              return cleanedSites;
          });
          // Also update the profile current_site_id for consistency
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
      setLeaveRequests(prev => prev.map(r => {
          if (r.id === id) {
              if (status === 'approved') {
                  setGuards(g_prev => g_prev.map(g => g.id === r.guard_id ? { ...g, application_status: ApplicationStatus.ON_LEAVE } : g));
              } else if (status === 'rejected') {
                  setGuards(g_prev => g_prev.map(g => g.id === r.guard_id && g.application_status === ApplicationStatus.ON_LEAVE ? { ...g, application_status: ApplicationStatus.ACTIVE } : g));
              }
              return { ...r, status };
          }
          return r;
      }));
  };
  
  const handleAddPolicy = (policy: DisciplinaryCode) => {
    setDisciplinaryCodes(prev => [...prev, { ...policy, company_id: userCompanyId }]);
  };

  const handleUpdatePolicy = (code: string, updates: Partial<DisciplinaryCode>) => {
    setDisciplinaryCodes(prev => prev.map(c => 
        (c.code === code && (c.company_id === userCompanyId || c.company_id === undefined && userRole === UserRole.SUPER_ADMIN)) 
        ? { ...c, ...updates, updated_at: new Date().toISOString() } 
        : c
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
    return <Auth onLogin={handleLogin} onPublicSubmit={handlePublicApply} guards={guards} profiles={profiles} />;
  }

  const guardSite = isGuard ? sites.find(s => s.id === (user as Guard).current_site_id) : undefined;
  const guardSupervisor = isGuard ? profiles.find(p => p.id === (guardSite?.supervisor_id)) : undefined;

  return (
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
                <div className="space-y-12 animate-in fade-in duration-500">
                    <div className="bg-slate-900 rounded-[3rem] p-10 md:p-14 text-white shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                        <div className="relative z-10">
                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-4">Welcome Back, {user.full_name.split(' ')[0]}!</p>
                            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none">
                                Operational Nexus <br />
                                <span className="text-white/60">Ready for Command.</span>
                            </h1>
                            <div className="flex flex-col sm:flex-row gap-6 mt-10">
                                <div className="p-5 bg-white/10 rounded-2xl border border-white/10 flex items-center gap-4">
                                    <div className="w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center text-xl font-bold">
                                        {filteredGuards.filter(g => g.application_status === ApplicationStatus.ACTIVE).length}
                                    </div>
                                    <span className="text-sm font-black text-white uppercase tracking-tight">Active<br/>Guards</span>
                                </div>
                                <div className="p-5 bg-white/10 rounded-2xl border border-white/10 flex items-center gap-4">
                                    <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center text-xl font-bold">
                                        {filteredSites.length}
                                    </div>
                                    <span className="text-sm font-black text-white uppercase tracking-tight">Active<br/>Sites</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Updated Dashboard Grid: 2 Columns, 3 Rows */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Applicants in Pool</p>
                            <p className="text-5xl font-black text-primary font-hud">{filteredGuards.filter(g => g.application_status === ApplicationStatus.POOL_APPLICANT).length}</p>
                        </div>
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Interviews Locked</p>
                            <p className="text-5xl font-black text-amber-500 font-hud">{filteredGuards.filter(g => g.application_status === ApplicationStatus.INTERVIEW_LOCKED).length}</p>
                        </div>
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Procurement Pending</p>
                            <p className="text-5xl font-black text-indigo-500 font-hud">{filteredGuards.filter(g => g.application_status === ApplicationStatus.PROCUREMENT_PENDING).length}</p>
                        </div>
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Incidents Last 30d</p>
                            <p className="text-5xl font-black text-red-600 font-hud">{filteredIncidents.length}</p>
                        </div>
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Blacklisted Personnel</p>
                            <p className="text-5xl font-black text-slate-900 font-hud">{filteredGuards.filter(g => g.application_status === ApplicationStatus.BLACKLISTED).length}</p>
                        </div>
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Leave Requests</p>
                            <p className="text-5xl font-black text-purple-600 font-hud">{filteredLeaveRequests.filter(r => r.status === 'pending').length}</p>
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
            {activeTab === 'sql-schema' && userRole === UserRole.SUPER_ADMIN && <CodeBlock code={ASKARI_SQL_SCHEMA} />}
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
  );
};

export default App;
