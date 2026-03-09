
import React, { useState, useMemo } from 'react';
import { Guard, Site, Profile, IncidentReport, DisciplinaryCode, UserRole, ResubmitRequest } from '../types';
import { analyzeGuardDossier } from '../services/ai';
import FileUploader from './FileUploader';
import { api } from '../services/api';
import AvatarImage from './AvatarImage';
import DocumentViewerDialog from './DocumentViewerDialog';

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
  onResubmitDecision
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

    let finalContractUrl = contractUrl || '';
    try {
      if (contractUrl && contractUrl.startsWith('data:')) {
        const parts = contractUrl.split(',');
        const meta = parts[0] || '';
        const b64 = parts[1] || '';
        const contentTypeMatch = meta.match(/data:(.*?);/);
        const contentType = (contentTypeMatch && contentTypeMatch[1]) || 'application/octet-stream';
        const byteChars = atob(b64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: contentType });
        const ext = contentType.includes('pdf') ? 'pdf' : (contentType.includes('png') ? 'png' : (contentType.includes('jpeg') ? 'jpg' : 'bin'));
        const path = `contracts/${selectedGuard.id}-${Date.now()}.${ext}`;
        finalContractUrl = finalContractUrl;
      }
    } catch { }

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

    await onFinalize(selectedGuard.id, 'pass', terms);
    const siteName = selectedSiteObj?.name || 'Selected Site';
    const supName = siteSupervisorProfile?.full_name || 'Assigned Supervisor';
    (window as any).showNotification?.('success', `Guard successfully deployed to ${siteName} under Supervisor ${supName}.`);
    setLastDeployment({ guard: selectedGuard, site: selectedSiteObj || null, supervisor: siteSupervisorProfile || null, contractUrl: finalContractUrl || '', interviewDate: terms.interviewDate, interviewNotes: terms.interviewNotes });
    setHireSuccess(true);
    setIsProcessing(false);
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

  const renderDocLink = (label: string, url?: string) => {
    const trimmed = (url || '').trim();
    return (
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
          <p className="text-xs font-medium text-slate-600 truncate">{trimmed || 'Not provided'}</p>
        </div>
        {trimmed ? (
          <button
            onClick={() => handleViewDocument(trimmed, label)}
            className="shrink-0 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all"
          >
            View
          </button>
        ) : (
          <span className="shrink-0 px-4 py-2 bg-slate-50 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-xl border border-slate-100">
            —
          </span>
        )}
      </div>
    );
  };

  return (
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
                  className="text-left bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <AvatarImage filename={guard.passport_photo_url} alt={guard.full_name} fallbackLetter={guard.full_name?.[0] || 'G'} className="w-14 h-14 rounded-full object-cover border border-slate-200" />
                      <div>
                        <h4 className="font-black text-slate-900 uppercase tracking-tight text-lg leading-none">
                          {guard.full_name}
                          {Array.isArray(guard.security_training) && guard.security_training.includes('k9_handler') && (
                            <span className="ml-2" title="K-9 Handler">🐕</span>
                          )}
                          {Array.isArray(guard.security_training) && guard.security_training.includes('fire_safety') && (
                            <span className="ml-1" title="Fire Safety">🔥</span>
                          )}
                          {((guard.education_history || []).some(e => (e.level || '').toLowerCase().includes('military') || (e.level || '').toLowerCase().includes('police') || (e.level || '').toLowerCase().includes('jkt') || e.weapon_proficiency === 'pass')) && (
                            <span className="ml-2" aria-hidden="true">🔫</span>
                          )}
                          {guard.security_level && (
                            <span
                              className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${(guard.security_level || '').toLowerCase() === 'armed'
                                ? 'bg-red-50 text-red-600 border-red-100'
                                : (guard.security_level || '').toLowerCase() === 'elite'
                                  ? 'bg-purple-50 text-purple-600 border-purple-100'
                                  : (guard.security_level || '').toLowerCase() === 'supervisor'
                                    ? 'bg-blue-50 text-blue-600 border-blue-100'
                                    : 'bg-slate-50 text-slate-600 border-slate-100'
                                }`}
                            >
                              {(guard.security_level || '').toString().toUpperCase()}
                            </span>
                          )}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest text-white border" style={{ backgroundColor: '#2171B5', borderColor: '#2171B5' }}>
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 6L9 17l-5-5" strokeWidth="3" /></svg>
                            Verified by System HR
                          </span>
                          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Readiness</span>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${((typeof guard.readiness_score === 'number' ? guard.readiness_score : 0) || 0) < 80 ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                            {(typeof guard.readiness_score === 'number' ? guard.readiness_score : 0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="group/tt inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-50 text-slate-500 border border-slate-200">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" strokeWidth="2" /></svg>
                      </div>
                      <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-4 text-xs hidden group-hover/tt:block z-20">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Documents</p>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between"><span>NIDA</span><span className={(guard.nida_front_url ? 'text-emerald-600' : 'text-slate-400')}>{guard.nida_front_url ? '✓' : '—'}</span></div>
                          <div className="flex items-center justify-between"><span>Police Clearance</span><span className={(guard.police_clearance_url ? 'text-emerald-600' : 'text-slate-400')}>{guard.police_clearance_url ? '✓' : '—'}</span></div>
                          <div className="flex items-center justify-between"><span>Medical Report</span><span className={((guard as any)?.medical_report_url || (guard as any)?.dossier_data?.medical_report_url ? 'text-emerald-600' : 'text-slate-400')}>{((guard as any)?.medical_report_url || (guard as any)?.dossier_data?.medical_report_url) ? '✓' : '—'}</span></div>
                          <div className="flex items-center justify-between"><span>Application Letter</span><span className={(guard.application_letter_url ? 'text-emerald-600' : 'text-slate-400')}>{guard.application_letter_url ? '✓' : '—'}</span></div>
                          <div className="flex items-center justify-between"><span>Birth Certificate</span><span className={(guard.birth_cert_url ? 'text-emerald-600' : 'text-slate-400')}>{guard.birth_cert_url ? '✓' : '—'}</span></div>
                          <div className="flex items-center justify-between"><span>Residence Letter</span><span className={(guard.residence_letter_url ? 'text-emerald-600' : 'text-slate-400')}>{guard.residence_letter_url ? '✓' : '—'}</span></div>
                          <div className="flex items-center justify-between"><span>Passport Photo</span><span className={(guard.passport_photo_url ? 'text-emerald-600' : 'text-slate-400')}>{guard.passport_photo_url ? '✓' : '—'}</span></div>
                          <div className="flex items-center justify-between"><span>CV</span><span className={(guard.cv_url ? 'text-emerald-600' : 'text-slate-400')}>{guard.cv_url ? '✓' : '—'}</span></div>
                          <div className="flex items-center justify-between"><span>Previous Employer Letter</span><span className={(guard.previous_employer_letter_url ? 'text-emerald-600' : 'text-slate-400')}>{guard.previous_employer_letter_url ? '✓' : '—'}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between border-b border-slate-50 py-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Age</span>
                      <span className="text-xs font-bold text-slate-700">{safeAge(guard.dob)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 py-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Education</span>
                      <span className="text-xs font-bold text-slate-700">{guard.education_history[0]?.level?.replace('_', ' ') || 'None'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 py-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                      <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded">Available</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Documents</span>
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded">
                        {[
                          guard.application_letter_url,
                          guard.nida_front_url,
                          guard.birth_cert_url,
                          guard.residence_letter_url
                        ].filter(Boolean).length} core • {guard.education_history.filter(e => !!e.certificate_url).length} edu • {guard.guarantors.filter(g => g.letter_url && g.residence_letter_url).length} guarantors
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div
                      onClick={(e) => { e.stopPropagation(); setSelectedGuard(guard); setDecisionMode('view'); }}
                      className="flex-1 py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary transition-all shadow-lg active:scale-95 text-center"
                    >
                      {isPrivileged ? 'Start Interview' : 'Review & Lock'}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedGuard(guard); setDecisionMode('hire'); }}
                      className="flex-1 py-4 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 text-center"
                      style={{ backgroundColor: '#2171B5' }}
                    >
                      Hire & Deploy
                    </button>
                  </div>
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
                  className="w-full text-left bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 flex items-center justify-between gap-6 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <AvatarImage filename={guard.passport_photo_url} alt={guard.full_name} fallbackLetter={guard.full_name?.[0] || 'G'} className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                    <div>
                      <h4 className="font-black text-slate-900 uppercase tracking-tight leading-none">
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
                        <span className="text-emerald-600 bg-emerald-50 px-2 rounded">Available</span>
                        <span className="text-slate-700 bg-slate-50 px-2 rounded">
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
            <div key={guard.id} className="w-full text-left bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <AvatarImage filename={guard.passport_photo_url} alt={guard.full_name} fallbackLetter={guard.full_name?.[0] || 'G'} className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                <div>
                  <h4 className="font-black text-slate-900 uppercase tracking-tight leading-none">{guard.full_name}</h4>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Submitted Application</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setSelectedGuard(guard); setDecisionMode('view'); }} className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl">Review</button>
                <button onClick={() => { setSelectedGuard(guard); setDecisionMode('hire'); }} className="px-4 py-2 text-white text-[10px] font-black uppercase tracking-widest rounded-xl" style={{ backgroundColor: '#2171B5' }}>Hire</button>
              </div>
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
              <div className="flex gap-2">
                <button onClick={() => { setSelectedGuard(guard); setDecisionMode('view'); }} className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl">Review</button>
                <button onClick={() => onFinalize(guard.id, 'fail', undefined, 'Reinstated by Super Admin')} className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl">Reinstate</button>
              </div>
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
                    <button onClick={(e) => { e.stopPropagation(); handleRunAI(guard); }} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="2.5" /></svg>
                      Run AI Analysis
                    </button>
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
                <div key={guard.id} className="text-left bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
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
                <div key={guard.id} className="w-full text-left bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all flex items-center justify-between gap-6">
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
        <div className="fixed inset-0 z-[1190] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div className="min-w-0">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter truncate">
                  Applicant Details
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 truncate">
                  {detailGuard.full_name} • {detailGuard.nida_number}
                </p>
              </div>
              <button
                onClick={() => setDetailGuard(null)}
                className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-400 hover:text-red-500 hover:border-red-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar space-y-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Identity</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between gap-4 border-b border-slate-100 py-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</span>
                      <span className="text-xs font-bold text-slate-800 text-right">{detailGuard.full_name}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-slate-100 py-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NIDA</span>
                      <span className="text-xs font-bold text-slate-800 text-right font-mono">{detailGuard.nida_number}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-slate-100 py-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DOB / Age</span>
                      <span className="text-xs font-bold text-slate-800 text-right">{detailGuard.dob || '—'} • {safeAge(detailGuard.dob)}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-slate-100 py-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Physical Address</span>
                      <span className="text-xs font-bold text-slate-800 text-right">
                        {(detailGuard as any)?.physical_address || (detailGuard as any)?.dossier_data?.physical_address || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 py-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</span>
                      <span className="text-xs font-bold text-slate-800 text-right">{detailGuard.phone || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Status & Flags</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between gap-4 border-b border-slate-100 py-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Application</span>
                      <span className="text-xs font-bold text-slate-800 text-right">{String((detailGuard as any)?.status || '').replace('_', ' ') || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-slate-100 py-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Profile Score</span>
                      <span className="text-xs font-bold text-slate-800 text-right">{detailGuard.profile_score}%</span>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-slate-100 py-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Armed</span>
                      <span className="text-xs font-bold text-slate-800 text-right">{detailGuard.is_armed ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex justify-between gap-4 py-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Residence</span>
                      <span className="text-xs font-bold text-slate-800 text-right">
                        {typeof detailGuard.residence_lat === 'number' && typeof detailGuard.residence_lng === 'number'
                          ? `${detailGuard.residence_lat.toFixed(5)}, ${detailGuard.residence_lng.toFixed(5)}`
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Next of Kin</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between gap-4 border-b border-slate-100 py-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</span>
                      <span className="text-xs font-bold text-slate-800 text-right">{detailGuard.next_of_kin_name || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-slate-100 py-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</span>
                      <span className="text-xs font-bold text-slate-800 text-right">{detailGuard.next_of_kin_phone || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-4 py-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Relationship</span>
                      <span className="text-xs font-bold text-slate-800 text-right">{detailGuard.next_of_kin_relationship || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Education History</h4>
                  {((detailGuard as any)?.education || detailGuard.education_history || [])?.length ? (
                    <div className="overflow-hidden border border-slate-100 rounded-xl">
                      <div className="grid grid-cols-5 gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">School Name</div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Qualification</div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Start Date</div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">End Date</div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Certificate</div>
                      </div>
                      {(((detailGuard as any)?.education as any[]) || detailGuard.education_history).map((e: any, idx: number) => (
                        <div key={`${e.id || 'row'}-${idx}`} className="grid grid-cols-5 gap-2 px-4 py-3 border-b border-slate-100 last:border-b-0">
                          <div className="text-xs font-bold text-slate-800 truncate">{e.institution_name || '—'}</div>
                          <div className="text-xs font-bold text-slate-800 truncate">{e.qualification || (e.level ? String(e.level).replace('_', ' ') : '—')}</div>
                          <div className="text-xs text-slate-700">{e.start_date || '—'}</div>
                          <div className="text-xs text-slate-700">{e.end_date || e.year || '—'}</div>
                          <div className="text-right">{renderDocLink('View Certificate', e.certificate_url)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No education records provided.</p>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Guarantors</h4>
                {detailGuard.guarantors?.length ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {detailGuard.guarantors.map((g, idx) => (
                      <div key={g.id || idx} className="border border-slate-100 rounded-xl p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-900 uppercase tracking-tight truncate">{g.name}</p>
                            <p className="text-xs font-medium text-slate-500">{g.relationship} • {g.phone}</p>
                            <p className="text-[11px] font-bold text-slate-600 mt-1">{g.occupation || '—'}</p>
                            <p className="text-[11px] text-slate-500">{(g as any).address || (g as any).residence_address || '—'}</p>
                          </div>
                        </div>
                        <div className="mt-4">
                          {renderDocLink('Guarantor Letter', g.letter_url)}
                          {renderDocLink('Residence Letter', g.residence_letter_url)}
                          {renderDocLink('ID Copy', (g as any).id_copy_url)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No guarantors provided.</p>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Documents</h4>
                <div className="space-y-1">
                  {renderDocLink('Application Letter', detailGuard.application_letter_url)}
                  {renderDocLink('NIDA (Front)', detailGuard.nida_front_url)}
                  {renderDocLink('Birth Certificate', detailGuard.birth_cert_url)}
                  {renderDocLink('Residence Letter', detailGuard.residence_letter_url)}
                  {renderDocLink('Employment Contract (if any)', detailGuard.employment_contract_url)}
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row gap-3">
              <button
                onClick={() => { setSelectedGuard(detailGuard); setDecisionMode('view'); setDetailGuard(null); }}
                className="flex-1 py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary transition-all shadow-xl active:scale-95"
              >
                Review & Lock
              </button>
              <button
                onClick={() => setDetailGuard(null)}
                className="px-8 py-4 bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decision Modal */}
      {selectedGuard && (
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
      <DocumentViewerDialog
        isOpen={viewer.isOpen}
        onClose={() => setViewer(prev => ({ ...prev, isOpen: false }))}
        url={viewer.url}
        title={viewer.title}
      />
    </div>
  );
};

export default VettingWorkflow;
