
import React, { useState, useMemo } from 'react';
import { Guard, Site, Profile, IncidentReport, DisciplinaryCode, UserRole, ResubmitRequest } from '../types';
import { analyzeGuardDossier } from '../services/ai';
import FileUploader from './FileUploader';
import { api } from '../services/api';
import AvatarImage from './AvatarImage';
import DocumentViewerDialog from './DocumentViewerDialog';
import {
  X, User, Fingerprint, Calendar, MapPin, Phone,
  Activity, Award, Shield, Users, FileText,
  FileCheck, Info, ExternalLink, Briefcase, GraduationCap,
  CreditCard, ClipboardCheck, AlertCircle
} from 'lucide-react';
import ForensicDisclosure from './ForensicDisclosure';

interface VettingWorkflowProps {
  guards: Guard[];
  sites: Site[];
  profiles: Profile[];
  companies?: { id: string; name: string; address?: string }[];
  incidents: IncidentReport[];
  disciplinaryCodes: DisciplinaryCode[];
  onLock: (guardId: string, companyId: string, notes: string, schedule?: { date: string; location: string }) => void;
  onFinalize: (guardId: string, result: 'pass' | 'fail' | 'blacklisted', terms?: any, rejectionReason?: string) => void;
  currentUser?: Profile | null;
  resubmitRequests?: ResubmitRequest[];
  onResubmitDecision?: (requestId: string, guardId: string, decision: 'approved' | 'rejected') => void;
  readOnly?: boolean;
}

const VettingWorkflow: React.FC<VettingWorkflowProps> = ({
  guards,
  sites,
  profiles,
  companies = [],
  incidents,
  disciplinaryCodes,
  onLock,
  onFinalize,
  currentUser,
  resubmitRequests = [],
  onResubmitDecision,
  readOnly = false
}) => {
  const isPrivileged = currentUser?.role === UserRole.SYSTEM_HR || currentUser?.role === UserRole.SUPER_ADMIN;
  const isSystemHR = currentUser?.role === UserRole.SYSTEM_HR || currentUser?.role === UserRole.SUPER_ADMIN;
  const isCompanyHR = currentUser?.role === UserRole.HR_OFFICER || currentUser?.role === UserRole.COMPANY_ADMIN;
  const [activeTab, setActiveTab] = useState<'marketplace' | 'submitted' | 'interviews' | 'resubmits' | 'hired' | 'blacklisted'>('marketplace');
  const [selectedGuard, setSelectedGuard] = useState<Guard | null>(null);
  const [detailGuard, setDetailGuard] = useState<Guard | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortKey, setSortKey] = useState<'name' | 'age' | 'education' | 'score'>('score');
  const [viewingForensic, setViewingForensic] = useState(false);

  // Locking State
  const [lockNote, setLockNote] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewLocation, setInterviewLocation] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  const defaultCompanyAddress = companies.find(c => c.id === currentUser?.company_id)?.address || '';
  const ensureDefaultLocation = () => {
    if (!interviewLocation) setInterviewLocation(defaultCompanyAddress || 'Company Office');
  };

  // Hiring State
  const [deploymentSite, setDeploymentSite] = useState('');
  const [deploymentSupervisor, setDeploymentSupervisor] = useState('');
  const [salary, setSalary] = useState<number>(300000);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [contractUrl, setContractUrl] = useState('');
  const [hireInterviewDate, setHireInterviewDate] = useState('');
  const [hireInterviewNotes, setHireInterviewNotes] = useState('');
  const [hireSuccess, setHireSuccess] = useState(false);
  const [lastDeployment, setLastDeployment] = useState<{ guard: Guard, site?: Site | null, supervisor?: Profile | null, contractUrl?: string, interviewDate?: string, interviewNotes?: string } | null>(null);

  // Rejection State
  const [rejectionReason, setRejectionReason] = useState('');
  const [decisionMode, setDecisionMode] = useState<'view' | 'hire' | 'reject' | 'blacklist'>('view');

  // AI State
  const [aiAnalysis, setAiAnalysis] = useState<{ score: number, reasoning: string, flags: string[] } | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [locallyRejectedIds, setLocallyRejectedIds] = useState<string[]>([]);

  // Document Viewer State
  const [viewer, setViewer] = useState<{ isOpen: boolean; url: string; title: string }>({
    isOpen: false,
    url: '',
    title: ''
  });

  // Filter lists
  const poolApplicants = useMemo(() => {
    const s = (g: any) => String(g?.status || '').toLowerCase();
    return guards.filter(g => s(g) === 'marketplace' && (!g?.company_id || g?.company_id === ''));
  }, [guards, isPrivileged]);
  const submittedApplicants = useMemo(() => {
    return guards.filter(g => String((g as any)?.status || '').toLowerCase() === 'pending_approval');
  }, [guards]);
  const interviewApplicants = useMemo(() => {
    const s = (g: any) => {
      const status = String(g?.status || '').toLowerCase();
      return status === 'interviewing' || status === 'pending';
    };
    const compId = currentUser?.company_id;
    return guards.filter(g => s(g) && String(g.company_id || '') === String(compId || '') && !locallyRejectedIds.includes(g.id));
  }, [guards, currentUser?.company_id, locallyRejectedIds]);
  const supervisors = useMemo(() => profiles.filter(p => p.role === UserRole.SUPERVISOR), [profiles]);
  const selectedSiteObj = useMemo(() => sites.find(s => s.id === deploymentSite) || null, [sites, deploymentSite]);
  const siteSupervisorProfile = useMemo(() => profiles.find(p => p.id === selectedSiteObj?.supervisor_id), [profiles, selectedSiteObj?.supervisor_id]);
  const sortedPoolApplicants = useMemo(() => {
    const arr = [...poolApplicants];
    const getAge = (d?: string) => {
      if (!d) return 0;
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return 0;
      return new Date().getFullYear() - dt.getFullYear();
    };
    const getEdu = (g: Guard) => (g.education_history[0]?.level || '').toString().toLowerCase();
    const getReadiness = (g: Guard) => Number(g.performance_score ?? g.profile_score ?? 0);
    arr.sort((a, b) => {
      if (sortKey === 'name') {
        return (a.full_name || '').toLowerCase().localeCompare((b.full_name || '').toLowerCase());
      }
      if (sortKey === 'score') {
        return getReadiness(b) - getReadiness(a);
      }
      if (sortKey === 'age') {
        return getAge(a.dob) - getAge(b.dob);
      }
      if (sortKey === 'education') {
        return getEdu(a).localeCompare(getEdu(b));
      }
      return 0;
    });
    return arr;
  }, [poolApplicants, sortKey]);

  const hiredGuards = useMemo(() => {
    const all = guards.filter(g => !!g.company_id && String((g as any)?.status || '').toLowerCase() === 'active');
    if (isCompanyHR) {
      return all.filter(g => String(g.company_id) === String(currentUser?.company_id || ''));
    }
    return all;
  }, [guards, isCompanyHR, currentUser?.company_id]);
  const blacklistedGuards = useMemo(() => {
    return guards.filter(g => {
      const s = String((g as any)?.status || '').toLowerCase();
      const score = Number((g as any)?.performance_score ?? 100);
      return s === 'blacklisted' || s === 'blacklist' || (!Number.isNaN(score) && score < 5);
    });
  }, [guards]);

  const handleLockSubmit = () => {
    let targetCompanyId = currentUser?.company_id || '';
    if (isPrivileged) {
      targetCompanyId = selectedCompanyId || '';
    }
    if (!selectedGuard || !targetCompanyId) {
      alert(isPrivileged ? "Select a Company to call for interview." : "You must be logged in as a Company Admin or HR to lock applicants.");
      return;
    }
    onLock(selectedGuard.id, targetCompanyId, lockNote, { date: interviewDate, location: interviewLocation || defaultCompanyAddress || 'Company Office' });
    setSelectedGuard(null);
    setLockNote('');
    setInterviewDate('');
    setInterviewLocation('');
    setSelectedCompanyId('');
    setActiveTab('interviews');
  };


  const handleRunAI = async (guard: Guard) => {
    setAnalyzingId(guard.id);
    const result = await analyzeGuardDossier(guard);
    setAiAnalysis({
      score: result.reliability_score,
      reasoning: result.reasoning,
      flags: result.risk_flags
    });
    setAnalyzingId(null);
  };

  const handleHireSubmit = async () => {
    if (!selectedGuard) return;
    if (!deploymentSite || !startDate || !salary) {
      alert("Please configure the deployment contract fully (Site, Start Date, Salary).");
      return;
    }

    setIsProcessing(true);

    try {
      let finalContractUrl = contractUrl || '';
      try {
        if (contractUrl && contractUrl.startsWith('data:')) {
          // Placeholder for future upload logic if needed, currently preserves URL
          finalContractUrl = contractUrl;
        }
      } catch (e) {
        console.warn("Contract URL processing failed:", e);
      }

      const supervisorId = selectedSiteObj?.supervisor_id || deploymentSupervisor || '';
      const terms = {
        siteId: deploymentSite,
        supervisorId,
        salary: Number(salary),
        startDate,
        endDate,
        contractUrl: finalContractUrl || 'generated_contract_v1.pdf',
        signed: false,
        interviewDate: hireInterviewDate || interviewDate || '',
        interviewNotes: hireInterviewNotes || lockNote || ''
      };

      const success = await onFinalize(selectedGuard.id, 'pass', terms);

      // If we got a return value from onFinalize, we can use it, otherwise assume handled by notifications
      if (success !== false) {
        const siteName = selectedSiteObj?.name || 'Selected Site';
        const supName = siteSupervisorProfile?.full_name || 'Assigned Supervisor';
        (window as any).showNotification?.('success', `Guard successfully deployed to ${siteName} under Supervisor ${supName}.`);
        setLastDeployment({ guard: selectedGuard, site: selectedSiteObj || null, supervisor: siteSupervisorProfile || null, contractUrl: finalContractUrl || '', interviewDate: terms.interviewDate, interviewNotes: terms.interviewNotes });
        setHireSuccess(true);
      }
    } catch (error) {
      console.error("Error during hire submission:", error);
      (window as any).showNotification?.('error', 'Deployment failed. Please check your connection and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintDeploymentLetter = () => {
    const info = lastDeployment || (selectedGuard ? { guard: selectedGuard, site: selectedSiteObj || null, supervisor: siteSupervisorProfile || null, contractUrl, interviewDate: hireInterviewDate, interviewNotes: hireInterviewNotes } : null);
    if (!info) return;
    const g = info.guard;
    const s = info.site || null;
    const sup = info.supervisor || null;
    const ref = `ASKARI/${new Date().getFullYear()}/${String(g.id).slice(-4).toUpperCase()}`;
    const today = new Date().toLocaleDateString();
    const docs = [
      { label: 'NIDA', ok: !!g.nida_front_url },
      { label: 'Police Clearance', ok: !!g.police_clearance_url },
      { label: 'Application Letter', ok: !!g.application_letter_url },
      { label: 'Birth Certificate', ok: !!g.birth_cert_url },
      { label: 'Residence Letter', ok: !!g.residence_letter_url },
      { label: 'Passport Photo', ok: !!g.passport_photo_url },
      { label: 'CV', ok: !!g.cv_url },
      { label: 'Previous Employer Letter', ok: !!g.previous_employer_letter_url },
    ];
    const siteLoc = s ? `${s.lat}, ${s.lng}` : 'Not provided';
    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Deployment Letter</title>
          <style>
            @page { size: A4; margin: 20mm; }
            body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; color: #111; }
            .spacer { height: 300px; }
            .container { max-width: 700px; margin: 0 auto; }
            .meta { margin-top: 12px; display: flex; justify-content: space-between; }
            .section { margin-top: 18px; }
            .title { font-weight: 700; font-size: 13pt; }
            .label { font-weight: 700; }
            .list { margin: 8px 0 0 0; padding: 0; list-style: none; }
            .list li { margin: 2px 0; }
            .ok { color: #059669; }
            .no { color: #6b7280; }
            a { color: #0ea5e9; text-decoration: underline; }
            @media print {
              .print-hide { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="spacer"></div>
          <div class="container">
            <div class="section">
              <div class="title">Deployment Letter</div>
              <div class="meta">
                <div><span class="label">Ref:</span> ${ref}</div>
                <div><span class="label">Date:</span> ${today}</div>
              </div>
            </div>
            <div class="section">
              <div class="label">Guard Details</div>
              <div>Full Name: ${g.full_name || '—'}</div>
              <div>ID Number: ${g.nida_number || '—'}</div>
              <div>Phone: ${g.phone || '—'}</div>
            </div>
            <div class="section">
              <div class="label">Site Details</div>
              <div>Site Name: ${s?.name || '—'}</div>
              <div>Location: ${siteLoc}</div>
              <div>Supervisor: ${sup?.full_name || '—'}</div>
              <div>Supervisor Phone: ${(sup as any)?.phone || '—'}</div>
            </div>
            <div class="section">
              <div class="label">Interview</div>
              <div>Date: ${info.interviewDate || '—'}</div>
              <div>Notes: ${info.interviewNotes || '—'}</div>
              <div>Contract: ${info.contractUrl ? `<a href="${info.contractUrl}" target="_blank">View</a>` : '—'}</div>
            </div>
            <div class="section">
              <div class="label">Vetting Checklist</div>
              <ul class="list">
                ${docs.map(d => `<li class="${d.ok ? 'ok' : 'no'}">${d.label}: ${d.ok ? '✓' : '—'}</li>`).join('')}
              </ul>
            </div>
          </div>
          <script>
            window.onload = function(){ window.print(); };
          </script>
        </body>
      </html>
    `;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const handleRejectSubmit = async (blacklist: boolean) => {
    if (!selectedGuard || !rejectionReason) {
      alert("Please provide a reason.");
      return;
    }
    const guardId = String(selectedGuard.id);
    const companyId = String(currentUser?.company_id || '');
    const token = (typeof window !== 'undefined') ? (localStorage.getItem('amini_auth_token') || localStorage.getItem('token')) : null;
    if (!token) {
      (window as any).showNotification?.('warning', 'Session not found. Please log in again.');
      return;
    }
    try {
      const logRes = await api.post('/interview-logs', {
        guard_id: guardId,
        company_id: companyId,
        outcome: blacklist ? 'blacklisted' : 'failed',
        comments: { rejection_reason: rejectionReason },
        score: null,
        created_at: new Date().toISOString()
      });
      if (logRes.error) {
        console.warn('Interview log failed:', logRes.error);
        (window as any).showNotification?.('warning', 'Failed to log action. Please retry.');
        return;
      }
      if (!blacklist) {
        const updRes = await api.patch(`/guards/${guardId}`, {
          company_id: null,
          status: 'marketplace'
        });
        if (updRes.error) {
          console.warn('Guard update failed:', updRes.error);
          (window as any).showNotification?.('warning', 'Failed to update guard. Please retry.');
          return;
        }
        setLocallyRejectedIds(prev => [...prev, guardId]);
      }
      (window as any).showNotification?.('success', blacklist ? 'Guard blacklisted.' : 'Guard released to pool.');
    } catch (e) {
      console.error('Reject error', e);
      (window as any).showNotification?.('warning', 'Network issue. Please try again.');
    }
    setSelectedGuard(null);
    resetForm();
  };

  const handleApproveApplicant = async (guardId: string) => {
    if (!confirm('Are you sure you want to approve this applicant to the marketplace?')) return;
    try {
      const res = await api.post(`/guards/${guardId}/approve`, {});
      if (res.error) throw new Error(res.error);
      (window as any).showNotification?.('success', 'Applicant approved to marketplace!');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      (window as any).showNotification?.('error', e.message || 'Failed to approve');
    }
  };

  const handleRequestImprovement = async (guardId: string) => {
    const reason = prompt('Please enter the reason for requesting improvement:');
    if (reason === null) return;
    if (!reason.trim()) {
      alert("A reason is required to request improvements.");
      return;
    }
    try {
      const res = await api.post(`/guards/${guardId}/request-improvement`, { reason });
      if (res.error) throw new Error(res.error);
      (window as any).showNotification?.('success', 'Requested improvements from applicant!');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      (window as any).showNotification?.('error', e.message || 'Failed to request improvement');
    }
  };

  const resetForm = () => {
    setDeploymentSite('');
    setDeploymentSupervisor('');
    setSalary(300000);
    setStartDate('');
    setEndDate('');
    setContractUrl('');
    setRejectionReason('');
    setDecisionMode('view');
    setAiAnalysis(null);
  };

  const safeAge = (dob?: string) => {
    if (!dob) return '—';
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return '—';
    return `${new Date().getFullYear() - d.getFullYear()} Years`;
  };

  const handleViewDocument = (url: string, title: string) => {
    // Database contains ONLY filenames. Hardcode the prefix.
    const fullUrl = `https://api.amini.co.tz/uploads/${url}`;
    setViewer({ isOpen: true, url: fullUrl, title });
  };


  return (
    <>
      <div className="max-w-7xl mx-auto space-y-10 pb-24 animate-in fade-in duration-500">
        <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col gap-6">
          <div>
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Vetting Workflow</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-4">Marketplace • Submitted • Interviews • Active • Blacklist</p>
          </div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-nowrap overflow-x-auto border border-slate-200 shadow-inner w-full md:w-auto">
              <button onClick={() => setActiveTab('marketplace')} className={`flex-none whitespace-nowrap px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'marketplace' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                Marketplace ({poolApplicants.length})
              </button>
              {isPrivileged && (
                <button onClick={() => setActiveTab('submitted')} className={`flex-none whitespace-nowrap px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'submitted' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                  Submitted ({submittedApplicants.length})
                </button>
              )}
              <button onClick={() => setActiveTab('interviews')} className={`flex-none whitespace-nowrap px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'interviews' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                Interviews ({interviewApplicants.length})
              </button>
              <button onClick={() => setActiveTab('hired')} className={`flex-none whitespace-nowrap px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'hired' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                Hired (Active) ({hiredGuards.length})
              </button>
              {isPrivileged && (
                <button onClick={() => setActiveTab('resubmits')} className={`flex-none whitespace-nowrap px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'resubmits' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                  Resubmit Requests
                </button>
              )}
              {isPrivileged && (
                <button onClick={() => setActiveTab('blacklisted')} className={`flex-none whitespace-nowrap px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'blacklisted' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                  Blacklist ({blacklistedGuards.length})
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="flex w-full md:w-auto bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                <button onClick={() => setViewMode('grid')} className={`flex-1 px-4 py-3 text-[10px] font-black uppercase tracking-widest ${viewMode === 'grid' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="8" height="8" /><rect x="13" y="3" width="8" height="8" /><rect x="3" y="13" width="8" height="8" /><rect x="13" y="13" width="8" height="8" /></svg>
                </button>
                <button onClick={() => setViewMode('list')} className={`flex-1 px-4 py-3 text-[10px] font-black uppercase tracking-widest ${viewMode === 'list' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="6" x2="20" y2="6" strokeWidth="2" /><line x1="4" y1="12" x2="20" y2="12" strokeWidth="2" /><line x1="4" y1="18" x2="20" y2="18" strokeWidth="2" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {activeTab === 'marketplace' && (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {sortedPoolApplicants.length > 0 ? sortedPoolApplicants.map(guard => (
                  <div
                    key={guard.id}
                    onClick={() => setDetailGuard(guard)}
                    className="group relative flex flex-col bg-slate-950/60 backdrop-blur-3xl p-8 rounded-[3rem] border border-white/10 shadow-2xl hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500 cursor-pointer overflow-hidden"
                  >
                    {/* Background Decorative Gradient */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 blur-[80px] rounded-full group-hover:bg-primary/30 transition-colors" />

                    <div className="relative flex justify-between items-start mb-8">
                      <div className="flex items-center gap-5">
                        <div className="relative">
                          <AvatarImage
                            filename={guard.passport_photo_url}
                            alt={guard.full_name}
                            fallbackLetter={guard.full_name?.[0] || 'G'}
                            className="w-16 h-16 rounded-3xl object-cover border-2 border-emerald-500/50 p-0.5 shadow-lg shadow-emerald-500/20"
                          />
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-950 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                          </div>
                        </div>
                        <div>
                          <h4 className="font-black text-white uppercase tracking-tight text-xl leading-tight group-hover:text-emerald-400 transition-colors">
                            {guard.full_name}
                            {((guard.education_history || []).some(e => (e.level || '').toLowerCase().includes('military') || (e.level || '').toLowerCase().includes('police') || (e.level || '').toLowerCase().includes('jkt') || e.weapon_proficiency === 'pass')) && (
                              <span className="ml-2 text-sm" aria-hidden="true" title="Tactical Training">⚔️</span>
                            )}
                          </h4>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-400/10 border border-emerald-400/20">
                              <span className="w-1 h-1 bg-emerald-400 rounded-full" />
                              System Verified
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Circular Readiness Indicator */}
                      <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                          <circle className="text-white/5" strokeWidth="8" stroke="currentColor" fill="transparent" r="40" cx="50" cy="50" />
                          <circle
                            className="text-emerald-500 transition-all duration-1000 ease-out"
                            strokeWidth="8"
                            strokeDasharray={251.2}
                            strokeDashoffset={251.2 - (251.2 * (guard.readiness_score || 0)) / 100}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                            r="40"
                            cx="50"
                            cy="50"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                          <span className="text-lg font-black text-white font-hud">{guard.readiness_score || 0}</span>
                          <span className="text-[6px] font-black text-white/40 uppercase tracking-tighter">Readiness</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-3 mb-8">
                      <div className="bg-white/5 p-4 rounded-3xl border border-white/5 flex flex-col items-center">
                        <span className="text-[7px] font-black text-white/40 uppercase tracking-widest mb-1">Age</span>
                        <span className="text-xs font-black text-white">{safeAge(guard.dob).replace(' Years', '')}</span>
                      </div>
                      <div className="bg-white/5 p-4 rounded-3xl border border-white/5 flex flex-col items-center">
                        <span className="text-[7px] font-black text-white/40 uppercase tracking-widest mb-1">Edu</span>
                        <span className="text-[10px] font-black text-white truncate w-full text-center">{guard.education_history[0]?.level?.slice(0, 7) || 'None'}</span>
                      </div>
                      <div className="bg-white/5 p-4 rounded-3xl border border-white/5 flex flex-col items-center">
                        <span className="text-[7px] font-black text-white/40 uppercase tracking-widest mb-1">Status</span>
                        <span className="text-[8px] font-black text-emerald-400 uppercase">Available</span>
                      </div>
                    </div>

                    {/* Certifications row */}
                    <div className="flex flex-wrap gap-2 mb-8">
                      {[
                        { label: 'NIDA', ok: !!guard.nida_front_url },
                        { label: 'Police', ok: !!guard.police_clearance_url },
                        { label: 'Medical', ok: !!((guard as any)?.medical_report_url || (guard as any)?.dossier_data?.medical_report_url) },
                        { label: 'CV', ok: !!guard.cv_url }
                      ].filter(d => d.ok).map((d, idx) => (
                        <span key={idx} className="px-2 py-1 bg-white/5 text-[7px] font-black text-white/60 uppercase tracking-widest rounded-lg border border-white/5">
                          {d.label} ✓
                        </span>
                      ))}
                      <span className="px-2 py-1 bg-white/5 text-[7px] font-black text-white/60 uppercase tracking-widest rounded-lg border border-white/5">
                        {guard.guarantors.length} Guarantors
                      </span>
                    </div>

                    {!readOnly && (
                      <div className="flex flex-col gap-3 mt-auto">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedGuard(guard); setDecisionMode('hire'); }}
                          className="group/btn relative w-full overflow-hidden py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] text-white transition-all shadow-xl shadow-emerald-500/10 active:scale-95"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-500 group-hover/btn:from-emerald-500 group-hover/btn:to-teal-400" />
                          <span className="relative flex items-center justify-center gap-2">
                            Hire & Deploy Professional
                            <svg className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 7l5 5m0 0l-5 5m5-5H6" strokeWidth="3" /></svg>
                          </span>
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedGuard(guard); setDecisionMode('view'); }}
                          className="group/btnrelative w-full py-4 bg-white/5 border border-white/10 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-white/10 transition-all active:scale-95"
                        >
                          {isPrivileged ? 'Review & Interview' : 'Lock Account'}
                        </button>
                      </div>
                    )}
                  </div>
                )) : (
                  <div className="col-span-full py-20 text-center border-4 border-dashed border-slate-100 rounded-[3rem]">
                    <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No applicants in the pool</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {sortedPoolApplicants.length > 0 ? sortedPoolApplicants.map(guard => (
                  <div
                    key={guard.id}
                    onClick={() => setDetailGuard(guard)}
                    className="group w-full text-left bg-slate-950/60 backdrop-blur-2xl p-6 rounded-[2rem] border border-white/10 shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-between gap-6 cursor-pointer overflow-hidden relative"
                  >
                    <div className="absolute inset-y-0 left-0 w-1 bg-emerald-500/50 group-hover:w-2 transition-all" />
                    <div className="flex items-center gap-4">
                      <AvatarImage filename={guard.passport_photo_url} alt={guard.full_name} fallbackLetter={guard.full_name?.[0] || 'G'} className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                      <div>
                        <h4 className="font-black text-white uppercase tracking-tight leading-none group-hover:text-emerald-400 transition-colors">
                          {guard.full_name}
                          {((guard.education_history || []).some(e => (e.level || '').toLowerCase().includes('military') || (e.level || '').toLowerCase().includes('police') || (e.level || '').toLowerCase().includes('jkt') || e.weapon_proficiency === 'pass')) && (
                            <span className="ml-2" aria-hidden="true">🔫</span>
                          )}
                        </h4>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-600 items-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest text-white border" style={{ backgroundColor: '#2171B5', borderColor: '#2171B5' }}>
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 6L9 17l-5-5" strokeWidth="3" /></svg>
                            Verified by System HR
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-primary/5 text-primary border border-primary/10">
                            Readiness {(typeof guard.readiness_score === 'number' ? guard.readiness_score : 0)}%
                          </span>
                          <span>Age: {safeAge(guard.dob)}</span>
                          <span>Edu: {guard.education_history[0]?.level?.replace('_', ' ') || 'None'}</span>
                          {guard.security_level && (
                            <span
                              className={`px-2 rounded text-[10px] font-black uppercase tracking-widest ${(guard.security_level || '').toLowerCase() === 'armed'
                                ? 'text-red-600 bg-red-50'
                                : (guard.security_level || '').toLowerCase() === 'elite'
                                  ? 'text-purple-600 bg-purple-50'
                                  : (guard.security_level || '').toLowerCase() === 'supervisor'
                                    ? 'text-blue-600 bg-blue-50'
                                    : 'text-slate-700 bg-slate-50'
                                }`}
                            >
                              {(guard.security_level || '').toString().toUpperCase()}
                            </span>
                          )}
                          <span className="text-emerald-400 bg-emerald-400/10 px-2 rounded">Available</span>
                          <span className="text-white/60 bg-white/5 px-2 rounded border border-white/5">
                            Docs {[
                              guard.application_letter_url,
                              guard.nida_front_url,
                              guard.birth_cert_url,
                              guard.residence_letter_url
                            ].filter(Boolean).length}/{4}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <div className="relative mr-3 hidden md:block">
                        <div className="group/tt inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-50 text-slate-500 border border-slate-200">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" strokeWidth="2" /></svg>
                        </div>
                        <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-4 text-xs hidden group-hover/tt:block z-20">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Documents</p>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between"><span>NIDA</span><span className={(guard.nida_front_url ? 'text-emerald-600' : 'text-slate-400')}>{guard.nida_front_url ? '✓' : '—'}</span></div>
                            <div className="flex items-center justify-between"><span>Police Clearance</span><span className={(guard.police_clearance_url ? 'text-emerald-600' : 'text-slate-400')}>{guard.police_clearance_url ? '✓' : '—'}</span></div>
                            <div className="flex items-center justify-between"><span>Application Letter</span><span className={(guard.application_letter_url ? 'text-emerald-600' : 'text-slate-400')}>{guard.application_letter_url ? '✓' : '—'}</span></div>
                            <div className="flex items-center justify-between"><span>Birth Certificate</span><span className={(guard.birth_cert_url ? 'text-emerald-600' : 'text-slate-400')}>{guard.birth_cert_url ? '✓' : '—'}</span></div>
                            <div className="flex items-center justify-between"><span>Residence Letter</span><span className={(guard.residence_letter_url ? 'text-emerald-600' : 'text-slate-400')}>{guard.residence_letter_url ? '✓' : '—'}</span></div>
                            <div className="flex items-center justify-between"><span>Medical Report</span><span className={(guard.medical_report_url ? 'text-emerald-600' : 'text-slate-400')}>{guard.medical_report_url ? '✓' : '—'}</span></div>
                            <div className="flex items-center justify-between"><span>Passport Photo</span><span className={(guard.passport_photo_url ? 'text-emerald-600' : 'text-slate-400')}>{guard.passport_photo_url ? '✓' : '—'}</span></div>
                            <div className="flex items-center justify-between"><span>CV</span><span className={(guard.cv_url ? 'text-emerald-600' : 'text-slate-400')}>{guard.cv_url ? '✓' : '—'}</span></div>
                            <div className="flex items-center justify-between"><span>Previous Employer Letter</span><span className={(guard.previous_employer_letter_url ? 'text-emerald-600' : 'text-slate-400')}>{guard.previous_employer_letter_url ? '✓' : '—'}</span></div>
                          </div>
                        </div>
                      </div>
                      {!readOnly && (
                        <>
                          <div
                            onClick={(e) => { e.stopPropagation(); setSelectedGuard(guard); setDecisionMode('view'); }}
                            className="px-6 py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary transition-all shadow-lg active:scale-95"
                          >
                            Start Interview
                          </div>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const r = await api.patch(`/guards/${guard.id}`, { system_verification_status: 'verified' });
                                if (r?.data) {
                                  (window as any).showNotification?.('success', 'Documents verified.');
                                } else {
                                  (window as any).showNotification?.('warning', 'Offline: verification saved locally.');
                                }
                              } catch {
                                (window as any).showNotification?.('error', 'Failed to verify.');
                              }
                            }}
                            className="mt-3 px-6 py-3 bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all active:scale-95"
                          >
                            Verify Docs
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="py-20 text-center border-4 border-dashed border-slate-100 rounded-[3rem]">
                    <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No applicants in the pool</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {isPrivileged && activeTab === 'submitted' && (
          <div className="space-y-4">
            {submittedApplicants.length ? submittedApplicants.map(guard => (
              <div
                key={guard.id}
                onClick={() => setDetailGuard(guard)}
                className="w-full text-left bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all flex items-center justify-between gap-6 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <AvatarImage filename={guard.passport_photo_url} alt={guard.full_name} fallbackLetter={guard.full_name?.[0] || 'G'} className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                  <div>
                    <h4 className="font-black text-slate-900 uppercase tracking-tight leading-none">{guard.full_name}</h4>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Submitted Application</p>
                  </div>
                </div>
                {!readOnly && (
                  <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedGuard(guard); setDecisionMode('view'); }} className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-colors">Review</button>
                    <button onClick={(e) => { e.stopPropagation(); handleApproveApplicant(guard.id); }} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors">Approve</button>
                    <button onClick={(e) => { e.stopPropagation(); handleRequestImprovement(guard.id); }} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors">Return</button>
                  </div>
                )}
              </div>
            )) : (
              <div className="py-20 text-center border-4 border-dashed border-slate-100 rounded-[3rem]">
                <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No submitted applications</p>
              </div>
            )}
          </div>
        )}

        {isPrivileged && activeTab === 'blacklisted' && (
          <div className="space-y-4">
            {blacklistedGuards.length ? blacklistedGuards.map(guard => (
              <div key={guard.id} className="w-full text-left bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-6">
                <div>
                  <h4 className="font-black text-slate-900 uppercase tracking-tight leading-none">{guard.full_name}</h4>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Blacklisted</p>
                </div>
                {!readOnly && (
                  <div className="flex gap-2">
                    <button onClick={() => { setSelectedGuard(guard); setDecisionMode('view'); }} className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl">Review</button>
                    <button onClick={() => onFinalize(guard.id, 'fail', undefined, 'Reinstated by Super Admin')} className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl">Reinstate</button>
                  </div>
                )}
              </div>
            )) : (
              <div className="py-20 text-center border-4 border-dashed border-slate-100 rounded-[3rem]">
                <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No blacklisted applicants</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'interviews' && (
          <div className="space-y-6">
            {console.log("Guards passing filter:", interviewApplicants.length, interviewApplicants)}
            {interviewApplicants.map(guard => (
              <div
                key={guard.id}
                onClick={() => setDetailGuard(guard)}
                className="cursor-pointer text-left bg-[#0A192F] p-8 rounded-[2.5rem] border border-slate-700 shadow-xl flex flex-col md:flex-row gap-8 items-start w-full hover:shadow-2xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <span className="w-16 h-16 rounded-full border border-slate-200 overflow-hidden shrink-0">
                  {guard.passport_photo_url
                    ? <AvatarImage filename={guard.passport_photo_url} alt={guard.full_name} className="w-16 h-16 object-cover" fallbackLetter={guard.full_name?.[0] || 'G'} />
                    : <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center font-black text-2xl">{guard.full_name?.[0] || 'G'}</div>}
                </span>
                <div className="flex-grow">
                  <div className="flex items-center gap-4 mb-2">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{guard.full_name}</h3>
                    <span className="bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md">Interview Ready</span>
                  </div>
                  <p className="text-sm font-medium text-white/80 italic">"{guard.dossier_data?.interviewer_notes || 'No notes added.'}"</p>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-white/60">
                    <div>Company: <strong className="text-white">{companies.find(c => c.id === guard.company_id)?.name || '—'}</strong></div>
                    <div>Site: <strong className="text-white">{sites.find(s => s.id === guard.current_site_id)?.name || '—'}</strong></div>
                    <div>Supervisor: <strong className="text-white">{profiles.find(p => p.id === guard.assigned_supervisor_id)?.full_name || '—'}</strong></div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4">
                    {analyzingId === guard.id ? (
                      <span className="px-6 py-3 bg-slate-50 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-xl animate-pulse">Running Analysis...</span>
                    ) : (
                      !readOnly && (
                        <button onClick={(e) => { e.stopPropagation(); handleRunAI(guard); }} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2">
                          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="2.5" /></svg>
                          Run AI Analysis
                        </button>
                      )
                    )}
                    {aiAnalysis && analyzingId !== guard.id && selectedGuard?.id === guard.id && (
                      <div className="w-full bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reliability Score</span>
                          <span className={`text-xl font-black font-hud ${aiAnalysis.score > 70 ? 'text-emerald-500' : 'text-amber-500'}`}>{aiAnalysis.score}/100</span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed mb-2">{aiAnalysis.reasoning}</p>
                        <div className="flex gap-2">
                          {aiAnalysis.flags.map((flag, i) => <span key={i} className="px-2 py-1 bg-red-50 text-red-600 text-[8px] font-black uppercase rounded border border-red-100">{flag}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex flex-col gap-3 w-full md:w-auto">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedGuard(guard); setDecisionMode('hire'); }}
                    className="px-8 py-4 bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg hover:bg-emerald-500 active:scale-95"
                  >
                    Hire & Deploy
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedGuard(guard); setDecisionMode('reject'); }}
                    className="px-8 py-4 bg-white border border-slate-200 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
            {interviewApplicants.length === 0 && (
              <div className="py-20 text-center border-4 border-dashed border-slate-100 rounded-[3rem]">
                <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No active interviews</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'hired' && (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {hiredGuards.length > 0 ? hiredGuards.map(guard => (
                  <div
                    key={guard.id}
                    onClick={() => { setDetailGuard(guard); setViewingForensic(true); }}
                    className="cursor-pointer text-left bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <AvatarImage filename={guard.passport_photo_url} alt={guard.full_name} fallbackLetter={guard.full_name?.[0] || 'G'} className="w-14 h-14 rounded-full object-cover border border-slate-200" />
                      <div>
                        <h4 className="font-black text-slate-900 uppercase tracking-tight text-lg leading-none">{guard.full_name}</h4>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Active • {companies.find(c => c.id === guard.company_id)?.name || 'Assigned'}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs text-slate-600">
                      <div className="flex justify-between"><span>Company</span><span className="font-bold">{companies.find(c => c.id === guard.company_id)?.name || String(guard.company_id || '')}</span></div>
                      <div className="flex justify-between"><span>Site</span><span className="font-bold">{sites.find(s => s.id === guard.current_site_id)?.name || '—'}</span></div>
                      <div className="flex justify-between"><span>Supervisor</span><span className="font-bold">{profiles.find(p => p.id === guard.assigned_supervisor_id)?.full_name || '—'}</span></div>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-full py-20 text-center border-4 border-dashed border-slate-100 rounded-[3rem]">
                    <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No active hires</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {hiredGuards.length > 0 ? hiredGuards.map(guard => (
                  <div
                    key={guard.id}
                    onClick={() => { setDetailGuard(guard); setViewingForensic(true); }}
                    className="cursor-pointer w-full text-left bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all flex items-center justify-between gap-6"
                  >
                    <div className="flex items-center gap-4">
                      <AvatarImage filename={guard.passport_photo_url} alt={guard.full_name} fallbackLetter={guard.full_name?.[0] || 'G'} className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                      <div>
                        <h4 className="font-black text-slate-900 uppercase tracking-tight leading-none">{guard.full_name}</h4>
                        <div className="flex gap-2 text-[10px] font-black uppercase tracking-widest">
                          <span className="text-emerald-600">Active</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-700">{companies.find(c => c.id === guard.company_id)?.name || String(guard.company_id || '')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-700">
                      <div className="flex gap-4">
                        <span>Site: <strong>{sites.find(s => s.id === guard.current_site_id)?.name || '—'}</strong></span>
                        <span>Supervisor: <strong>{profiles.find(p => p.id === guard.assigned_supervisor_id)?.full_name || '—'}</strong></span>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-full py-20 text-center border-4 border-dashed border-slate-100 rounded-[3rem]">
                    <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No active hires</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {isPrivileged && activeTab === 'resubmits' && (
          <div className="space-y-6">
            <div className="p-6 bg-white rounded-[2.5rem] border border-slate-200">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Applicants who requested to edit CV</p>
            </div>
            <div className="space-y-4">
              {resubmitRequests.map(r => {
                const g = guards.find(x => x.id === r.guard_id);
                return (
                  <div key={r.id} className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black uppercase tracking-tight text-slate-900">{g?.full_name || r.guard_id}</p>
                      <p className="text-xs text-slate-500">Reason: {r.reason}</p>
                      <p className="text-[10px] font-mono text-slate-400">Submitted: {new Date(r.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => onResubmitDecision?.(r.id, r.guard_id, 'approved')} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest">Approve</button>
                      <button onClick={() => onResubmitDecision?.(r.id, r.guard_id, 'rejected')} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest">Reject</button>
                    </div>
                  </div>
                );
              })}
              {resubmitRequests.length === 0 && (
                <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2rem] text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No resubmit requests</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Applicant Details Modal */}
        {detailGuard && (
          <div className="fixed inset-0 z-[1190] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-in fade-in zoom-in duration-300">
            <div className="bg-slate-50 w-full max-w-5xl rounded-[2rem] shadow-2xl flex flex-col max-h-[95vh] overflow-hidden border border-white/20">
              {/* Premium Header: Ultra-clean for maximum visibility */}
              <div className="relative p-6 md:p-10 bg-slate-900 text-white border-b border-white/5">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <div className="relative shrink-0">
                      <div className="w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden shadow-xl">
                        {detailGuard.passport_photo_url ? (
                          <AvatarImage src={detailGuard.passport_photo_url} alt={detailGuard.full_name} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-12 h-12 text-white/20" />
                        )}
                      </div>
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 border-4 border-slate-900 flex items-center justify-center shadow-lg">
                        <Shield className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-3xl md:text-4xl font-black uppercase tracking-tight leading-none text-white">
                        {detailGuard.full_name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 mt-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/10">
                          <Fingerprint className="w-3 h-3 text-blue-400" />
                          <span className="text-[11px] font-black uppercase tracking-widest text-white/90">
                            NIDA: {detailGuard.nida_number}
                          </span>
                        </div>
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-widest border shadow-lg ${detailGuard.status === 'active' ? 'bg-emerald-600 border-emerald-500 text-white' :
                          detailGuard.status === 'interviewing' ? 'bg-blue-600 border-blue-500 text-white' :
                            'bg-slate-700 border-slate-600 text-white'
                          }`}>
                          <Activity className="w-3 h-3" />
                          {String(detailGuard.status || 'Applied').replace('_', ' ')}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setDetailGuard(null)}
                    className="absolute md:relative top-0 right-0 md:top-auto md:right-auto w-10 h-10 flex items-center justify-center bg-white/20 hover:bg-white/30 border border-white/20 rounded-xl text-white transition-all hover:rotate-90 shadow-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-8">
                {/* Core Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Identity Card */}
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                        <Fingerprint className="w-4 h-4" />
                      </div>
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Identity Info</h4>
                    </div>
                    <div className="space-y-4 flex-1">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date of Birth</p>
                        <p className="text-sm font-bold text-slate-900">{detailGuard.dob || '—'} ({safeAge(detailGuard.dob)} yrs)</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gender</p>
                        <p className="text-sm font-bold text-slate-900 uppercase">{detailGuard.gender || '—'}</p>
                      </div>
                      <div className="space-y-1 pt-2 border-t border-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact Number</p>
                        <div className="flex items-center gap-2 text-slate-900">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span className="text-sm font-bold">{detailGuard.phone || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status & Scores Card */}
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                        <Activity className="w-4 h-4" />
                      </div>
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ecosystem Metrics</h4>
                    </div>
                    <div className="space-y-4 flex-1">
                      <div>
                        <div className="flex justify-between items-end mb-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Performance Score</p>
                          <p className="text-lg font-black text-slate-900 leading-none">{detailGuard.profile_score}%</p>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${detailGuard.profile_score}%` }}></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Armed Ready</p>
                          <p className={`text-xs font-black uppercase tracking-tight ${detailGuard.is_armed ? 'text-blue-600' : 'text-slate-500'}`}>
                            {detailGuard.is_armed ? 'Certified' : 'No'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Experience</p>
                          <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{detailGuard.previous_experience ? 'Verified' : 'Novice'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Location Card */}
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="p-2 bg-orange-50 rounded-xl text-orange-600">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Residence & Kin</h4>
                    </div>
                    <div className="space-y-4 flex-1">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Address</p>
                        <p className="text-xs font-bold text-slate-900 leading-relaxed">
                          {(detailGuard as any)?.physical_address || (detailGuard as any)?.dossier_data?.physical_address || '—'}
                        </p>
                      </div>
                      <div className="space-y-2 pt-2 border-t border-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Next of Kin: {detailGuard.next_of_kin_relationship}</p>
                        <div className="p-3 bg-slate-50 rounded-2xl flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                            <Users className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900 uppercase tracking-tight truncate">{detailGuard.next_of_kin_name}</p>
                            <p className="text-[10px] font-medium text-slate-500">{detailGuard.next_of_kin_phone}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>


                {/* Education History Card */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Educational Background</h4>
                  </div>
                  {((detailGuard as any)?.education || detailGuard.education_history || [])?.length ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(((detailGuard as any)?.education as any[]) || detailGuard.education_history).map((e: any, idx: number) => (
                        <div key={idx} className="group p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-purple-200 transition-all">
                          <div className="flex justify-between items-start gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-900 uppercase tracking-tight truncate">{e.institution_name || '—'}</p>
                              <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mt-0.5">
                                {e.qualification || (e.level ? String(e.level).replace('_', ' ') : '—')}
                              </p>
                            </div>
                            {e.certificate_url && (
                              <button
                                onClick={() => handleViewDocument(e.certificate_url, 'Education Certificate')}
                                className="p-2 bg-white rounded-lg shadow-sm text-slate-400 hover:text-purple-600 transition-colors"
                              >
                                <FileCheck className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <Calendar className="w-3 h-3" />
                            <span>{e.start_date || '—'} – {e.end_date || e.year || '—'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">No academic records documented.</p>
                    </div>
                  )}
                </div>

                {/* Professional Work History Card */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Professional Work History</h4>
                  </div>
                  {detailGuard.work_history?.length ? (
                    <div className="space-y-4">
                      {detailGuard.work_history.map((wh, idx) => (
                        <div key={wh.id || idx} className="p-5 bg-slate-50 rounded-2xl border border-transparent hover:border-blue-200 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400">
                              <Briefcase className="w-5 h-5 opacity-40" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-900 uppercase tracking-tight truncate">{wh.company_name || '—'}</p>
                              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">{wh.role || '—'}</p>
                              <div className="flex items-center gap-2 mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <Calendar className="w-3 h-3" />
                                <span>{wh.start_date || '—'} – {wh.end_date || 'Present'}</span>
                              </div>
                            </div>
                          </div>
                          {wh.recommendation_letter_url && (
                            <button
                              onClick={() => handleViewDocument(wh.recommendation_letter_url, `Recommendation Letter - ${wh.company_name}`)}
                              className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm text-[10px] font-black uppercase text-slate-600 hover:text-blue-600 transition-all border border-slate-100"
                            >
                              <FileCheck className="w-4 h-4" />
                              View Letter
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">No professional history documented.</p>
                    </div>
                  )}
                </div>

                {/* Detailed Document & Guarantor Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Guarantors */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-xl mb-6">
                      <div className="p-2 bg-white/10 rounded-lg text-white">
                        <Shield className="w-4 h-4" />
                      </div>
                      <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Trusted Guarantors</h4>
                    </div>
                    {detailGuard.guarantors?.length ? (
                      <div className="space-y-3">
                        {detailGuard.guarantors.map((g, idx) => (
                          <div key={idx} className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                                  <User className="w-6 h-6" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{g.name}</p>
                                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">{g.relationship} • {g.phone}</p>
                                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-medium">
                                    <span>{g.occupation || 'Self Employed'}</span>
                                    <span>•</span>
                                    <span className="truncate">{(g as any).address || (g as any).residence_address || '—'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="mt-4 grid grid-cols-3 gap-2">
                              {['Guarantor Letter', 'Residence', 'ID Copy'].map((lbl, li) => {
                                const url = li === 0 ? g.guarantor_letter_url : li === 1 ? g.residence_letter_url : (g as any).id_copy_url;
                                return url ? (
                                  <button
                                    key={li}
                                    onClick={() => handleViewDocument(url, `${lbl}: ${g.name}`)}
                                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition-all group"
                                  >
                                    <FileText className="w-4 h-4 text-indigo-400 group-hover:text-indigo-600" />
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{lbl}</span>
                                  </button>
                                ) : (
                                  <div key={li} className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 opacity-40 grayscale border border-slate-100">
                                    <FileText className="w-4 h-4" />
                                    <span className="text-[8px] font-bold uppercase tracking-widest mt-1 text-slate-500">N/A</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">No guarantors verified.</p>
                      </div>
                    )}
                  </div>

                  {/* Main Documents */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-xl">
                      <div className="p-2 bg-white/10 rounded-lg text-white">
                        <FileCheck className="w-4 h-4" />
                      </div>
                      <h4 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Compliance Dossier</h4>
                    </div>
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                      {[
                        { l: 'Application Letter', u: detailGuard.application_letter_url },
                        { l: 'NIDA Certification', u: detailGuard.nida_front_url },
                        { l: 'Birth Certificate', u: detailGuard.birth_cert_url },
                        { l: 'Residence Certificate', u: detailGuard.residence_letter_url },
                        { l: 'Draft Contract', u: detailGuard.employment_contract_url },
                        { l: 'Bank Details', u: (detailGuard as any).bank_account_form_url },
                      ].map((doc, di) => (
                        <div key={di} className="px-6 py-4 flex items-center justify-between gap-4 border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`p-2 rounded-lg ${doc.u ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-300'}`}>
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{doc.l}</p>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{doc.u ? 'Ready for Audit' : 'Pending Upload'}</p>
                            </div>
                          </div>
                          {doc.u ? (
                            <button
                              onClick={() => handleViewDocument(doc.u!, doc.l)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            >
                              <ExternalLink className="w-5 h-5" />
                            </button>
                          ) : (
                            <div className="p-2 text-slate-300">
                              <AlertCircle className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8 bg-slate-100/50 backdrop-blur-sm border-t border-slate-200 flex flex-col md:flex-row gap-4">
                <button
                  onClick={() => { setSelectedGuard(detailGuard); setDecisionMode('view'); setDetailGuard(null); }}
                  className="flex-1 py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-primary transition-all shadow-xl hover:shadow-primary/20 active:scale-95 flex items-center justify-center gap-3 group"
                >
                  <ClipboardCheck className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  Initialize Full Audit
                </button>
                <button
                  onClick={() => setDetailGuard(null)}
                  className="px-8 py-4 bg-white border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all active:scale-95"
                >
                  Exit View
                </button>
              </div>
            </div>
          </div>
        )
        }

        {/* Decision Modal */}
        {
          selectedGuard && (
            <div className="fixed inset-0 z-[1200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
              <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                      {decisionMode === 'hire' ? 'Deployment Contract' : decisionMode === 'reject' ? 'Rejection Process' : 'Applicant Review'}
                    </h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                      Target: {selectedGuard.full_name}
                    </p>
                  </div>
                  <button onClick={() => { setSelectedGuard(null); resetForm(); }} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-400 hover:text-red-500 hover:border-red-100 transition-colors">✕</button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
                  {decisionMode === 'view' && (
                    <div className="space-y-6">
                      {isPrivileged && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Select Company</label>
                            <select
                              value={selectedCompanyId}
                              onChange={e => setSelectedCompanyId(e.target.value)}
                              className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase text-xs outline-none focus:border-primary"
                            >
                              <option value="">-- Choose Company --</option>
                              {companies.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Interview Date</label>
                            <input
                              type="datetime-local"
                              value={interviewDate}
                              onChange={e => setInterviewDate(e.target.value)}
                              className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-primary"
                            />
                          </div>
                        </div>
                      )}
                      <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                        <p className="text-sm font-bold text-blue-800 mb-2">Locking Policy</p>
                        <p className="text-xs text-blue-600 leading-relaxed">
                          By locking this applicant, you reserve them for your company's exclusive interview process.
                          They will be removed from the public marketplace.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Internal Note (Optional)</label>
                        <textarea
                          value={lockNote}
                          onChange={e => setLockNote(e.target.value)}
                          className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-sm font-medium"
                          placeholder="E.g. Candidate fits the profile for the Downtown Bank site..."
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Interview Date</label>
                          <input
                            type="datetime-local"
                            value={interviewDate}
                            onChange={e => setInterviewDate(e.target.value)}
                            className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-primary"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Interview Location</label>
                          <input
                            type="text"
                            value={interviewLocation}
                            onFocus={ensureDefaultLocation}
                            onChange={e => setInterviewLocation(e.target.value)}
                            className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-primary"
                            placeholder={defaultCompanyAddress || 'Company Office'}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {decisionMode === 'hire' && (
                    <div className="space-y-6">
                      {hireSuccess ? (
                        <div className="space-y-4">
                          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-medium">
                            Deployment completed successfully. You can now print the Deployment Letter.
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Assign Site</label>
                              <select value={deploymentSite} onChange={e => setDeploymentSite(e.target.value)} className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase text-xs outline-none focus:border-primary">
                                <option value="">-- Select Site --</option>
                                {(
                                  (isPrivileged || !selectedGuard?.company_id)
                                    ? sites
                                    : sites.filter(s => String(s.company_id || '') === String(selectedGuard.company_id || ''))
                                ).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Supervisor</label>
                              <select value={deploymentSupervisor} onChange={e => setDeploymentSupervisor(e.target.value)} className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase text-xs outline-none focus:border-primary">
                                <option value="">-- Select Supervisor --</option>
                                {(
                                  (isPrivileged || !selectedGuard?.company_id)
                                    ? supervisors
                                    : supervisors.filter(p => String(p.company_id || '') === String(selectedGuard.company_id || ''))
                                ).map(p => (
                                  <option key={p.id} value={p.id}>{p.full_name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Monthly Salary (TZS)</label>
                              <input type="number" value={salary} onChange={e => setSalary(Number(e.target.value))} className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-primary" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Contract Start</label>
                              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-primary" />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Interview Date</label>
                              <input
                                type="datetime-local"
                                value={hireInterviewDate}
                                onChange={e => setHireInterviewDate(e.target.value)}
                                className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-primary"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Interview Notes</label>
                              <textarea
                                value={hireInterviewNotes}
                                onChange={e => setHireInterviewNotes(e.target.value)}
                                className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-primary"
                                placeholder="Summary of interview outcome and remarks"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Employment Contract</label>
                            <FileUploader label="Upload Signed PDF" fileUrl={contractUrl} onUpload={setContractUrl} onRemove={() => setContractUrl('')} className="!h-24" />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {decisionMode === 'reject' && (
                    <div className="space-y-6">
                      <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs font-medium">
                        Rejecting this applicant will release them back to the Marketplace for other companies.
                        Blacklisting will permanently ban them from the platform.
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Reason for Rejection</label>
                        <textarea
                          value={rejectionReason}
                          onChange={e => setRejectionReason(e.target.value)}
                          className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-sm font-medium"
                          placeholder="E.g. Failed physical fitness test, incomplete documentation..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                  {decisionMode === 'view' ? (
                    <button onClick={handleLockSubmit} className="w-full py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary transition-all shadow-xl active:scale-95">
                      {isPrivileged ? 'Call for Interview' : 'Confirm Lock'}
                    </button>
                  ) : decisionMode === 'hire' ? (
                    <>
                      {!hireSuccess ? (
                        <button
                          onClick={handleHireSubmit}
                          disabled={isProcessing}
                          className="w-full py-4 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-xl active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                          style={{ backgroundColor: '#2171B5' }}
                        >
                          {isProcessing ? 'Deploying…' : 'Hire & Deploy'}
                        </button>
                      ) : (
                        <div className="flex gap-3 w-full">
                          <button onClick={handlePrintDeploymentLetter} className="flex-1 py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary transition-all shadow-xl active:scale-95">
                            Print Deployment Letter
                          </button>
                          <button onClick={() => { setHireSuccess(false); setSelectedGuard(null); resetForm(); }} className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all">
                            Close
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleRejectSubmit(false)} className="flex-1 py-4 bg-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-300 transition-all">
                        Release to Pool
                      </button>
                      <button onClick={() => handleRejectSubmit(true)} className="flex-1 py-4 bg-red-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-red-700 transition-all shadow-xl">
                        Blacklist Permanently
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
      </div>

      <DocumentViewerDialog
        isOpen={viewer.isOpen}
        onClose={() => setViewer(prev => ({ ...prev, isOpen: false }))}
        url={viewer.url}
        title={viewer.title}
      />

      {viewingForensic && detailGuard && (
        <ForensicDisclosure
          guard={detailGuard}
          incidents={incidents}
          disciplinaryCodes={disciplinaryCodes}
          currentUser={currentUser}
          onClose={() => { setDetailGuard(null); setViewingForensic(false); }}
          onTerminate={() => {
            setDetailGuard(null);
            setViewingForensic(false);
            window.location.reload(); // Simple refresh to update pool/hired counts
          }}
        />
      )}
    </>
  );
};

export default VettingWorkflow;
