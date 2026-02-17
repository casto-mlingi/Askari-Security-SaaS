
import React, { useState, useMemo } from 'react';
import { Guard, Site, Profile, IncidentReport, DisciplinaryCode, ApplicationStatus, UserRole, ResubmitRequest } from '../types';
import { analyzeGuardDossier } from '../services/ai';
import FileUploader from './FileUploader';
import { api } from '../services/api';

interface VettingWorkflowProps {
  guards: Guard[];
  sites: Site[];
  profiles: Profile[];
  companies?: { id: string; name: string; address?: string }[];
  incidents: IncidentReport[];
  disciplinaryCodes: DisciplinaryCode[];
  onLock: (guardId: string, companyId: string, notes: string, schedule?: { date: string; location: string }) => void;
  onFinalize: (guardId: string, result: 'pass' | 'fail' | 'blacklist', terms?: any, rejectionReason?: string) => void;
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
  const isSystemHR = currentUser?.role === UserRole.SYSTEM_HR;
  const [activeTab, setActiveTab] = useState<'marketplace' | 'interviews' | 'resubmits'>(isSystemHR ? 'marketplace' : 'interviews');
  const [selectedGuard, setSelectedGuard] = useState<Guard | null>(null);
  const [detailGuard, setDetailGuard] = useState<Guard | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortKey, setSortKey] = useState<'name' | 'age' | 'education' | 'score'>('score');
  
  // Locking State
  const [lockNote, setLockNote] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewLocation, setInterviewLocation] = useState('');
  
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
  const [aiAnalysis, setAiAnalysis] = useState<{score: number, reasoning: string, flags: string[]} | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [locallyRejectedIds, setLocallyRejectedIds] = useState<string[]>([]);

  // Filter lists
  const poolApplicants = useMemo(() => {
    const unassigned = guards.filter(g => !g.company_id || g.company_id === '');
    const verifiedOnly = unassigned.filter(g => (g.system_verification_status || '').toLowerCase() === 'verified');
    return verifiedOnly.length > 0 ? verifiedOnly : unassigned;
  }, [guards]);
  const lockedApplicants = useMemo(() => {
    const compId = currentUser?.company_id;
    const status = (g: Guard) => (g.application_status as any);
    return guards.filter(g => {
      const s = status(g);
      const isInterview = s === ApplicationStatus.INTERVIEWING || s === 'interview';
      const isPending = s === ApplicationStatus.PENDING || s === 'pending';
      return g.company_id === compId && (isInterview || isPending) && !locallyRejectedIds.includes(g.id);
    });
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

  const handleLockSubmit = () => {
    const companyId = currentUser?.company_id;
    if (!selectedGuard || !companyId) {
      alert("You must be logged in as a Company Admin or HR to lock applicants.");
      return;
    }
    onLock(selectedGuard.id, companyId, lockNote, { date: interviewDate, location: interviewLocation || defaultCompanyAddress || 'Company Office' });
    setSelectedGuard(null);
    setLockNote('');
    setInterviewDate('');
    setInterviewLocation('');
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
    } catch {}

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
    try {
      await api.post('/interview-logs', {
        guard_id: guardId,
        company_id: companyId,
        outcome: blacklist ? 'blacklisted' : 'failed',
        rejection_reason: rejectionReason,
        created_at: new Date().toISOString()
      });
      if (!blacklist) {
        await api.patch(`/guards/${guardId}`, {
          company_id: null,
          application_status: 'pool'
        });
        setLocallyRejectedIds(prev => [...prev, guardId]);
      }
      (window as any).showNotification?.('success', blacklist ? 'Guard blacklisted.' : 'Guard released to pool.');
    } catch (e) {
      console.error('Reject error', e);
      (window as any).showNotification?.('warning', 'Action logged locally.');
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

  const renderDocLink = (label: string, url?: string) => {
    const trimmed = (url || '').trim();
    return (
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
          <p className="text-xs font-medium text-slate-600 truncate">{trimmed || 'Not provided'}</p>
        </div>
        {trimmed ? (
          <a
            href={trimmed}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all"
          >
            View
          </a>
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
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-4">Recruitment & Background Checks</p>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-nowrap overflow-x-auto border border-slate-200 shadow-inner w-full md:w-auto">
            {isSystemHR && (
              <button onClick={() => setActiveTab('marketplace')} className={`flex-none whitespace-nowrap px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'marketplace' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                Marketplace ({poolApplicants.length})
              </button>
            )}
            <button onClick={() => setActiveTab('interviews')} className={`flex-none whitespace-nowrap px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'interviews' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
              Interviews ({lockedApplicants.length})
            </button>
            {isSystemHR && (
              <button onClick={() => setActiveTab('resubmits')} className={`flex-none whitespace-nowrap px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'resubmits' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                Resubmit Requests
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex w-full md:w-auto bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
              <button onClick={() => setViewMode('grid')} className={`flex-1 px-4 py-3 text-[10px] font-black uppercase tracking-widest ${viewMode === 'grid' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/></svg>
              </button>
              <button onClick={() => setViewMode('list')} className={`flex-1 px-4 py-3 text-[10px] font-black uppercase tracking-widest ${viewMode === 'list' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="6" x2="20" y2="6" strokeWidth="2"/><line x1="4" y1="12" x2="20" y2="12" strokeWidth="2"/><line x1="4" y1="18" x2="20" y2="18" strokeWidth="2"/></svg>
              </button>
            </div>
          </div>
                    </div>
      </div>

      {isSystemHR && activeTab === 'marketplace' && (
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
                         {guard.passport_photo_url ? (
                           <img src={guard.passport_photo_url} alt={guard.full_name} className="w-14 h-14 rounded-full object-cover border border-slate-200" />
                         ) : (
                           <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-black text-xl">
                             {guard.full_name?.[0] || 'G'}
                           </div>
                         )}
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
                                 className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                                   (guard.security_level || '').toLowerCase() === 'armed'
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
                               <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 6L9 17l-5-5" strokeWidth="3"/></svg>
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
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" strokeWidth="2"/></svg>
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
                        <span className="text-xs font-bold text-slate-700">{guard.education_history[0]?.level?.replace('_',' ') || 'None'}</span>
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
                      Review & Lock
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
                  {guard.passport_photo_url ? (
                    <img src={guard.passport_photo_url} alt={guard.full_name} className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                  ) : (
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-black text-lg">
                      {guard.full_name?.[0] || 'G'}
                    </div>
                  )}
                  <div>
                    <h4 className="font-black text-slate-900 uppercase tracking-tight leading-none">
                      {guard.full_name}
                      {((guard.education_history || []).some(e => (e.level || '').toLowerCase().includes('military') || (e.level || '').toLowerCase().includes('police') || (e.level || '').toLowerCase().includes('jkt') || e.weapon_proficiency === 'pass')) && (
                        <span className="ml-2" aria-hidden="true">🔫</span>
                      )}
                    </h4>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-600 items-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest text-white border" style={{ backgroundColor: '#2171B5', borderColor: '#2171B5' }}>
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 6L9 17l-5-5" strokeWidth="3"/></svg>
                        Verified by System HR
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-primary/5 text-primary border border-primary/10">
                        Readiness {(typeof guard.readiness_score === 'number' ? guard.readiness_score : 0)}%
                      </span>
                      <span>Age: {safeAge(guard.dob)}</span>
                      <span>Edu: {guard.education_history[0]?.level?.replace('_',' ') || 'None'}</span>
                      {guard.security_level && (
                        <span
                          className={`px-2 rounded text-[10px] font-black uppercase tracking-widest ${
                            (guard.security_level || '').toLowerCase() === 'armed'
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
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" strokeWidth="2"/></svg>
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
                    Review & Lock
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

      {activeTab === 'interviews' && (
        <div className="space-y-6">
           {console.log("Guards passing filter:", lockedApplicants.length, lockedApplicants)}
           {lockedApplicants.map(guard => (
             <div
               key={guard.id}
               onClick={() => setDetailGuard(guard)}
               className="cursor-pointer text-left bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-8 items-start w-full hover:shadow-xl transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
             >
                {guard.passport_photo_url ? (
                  <img src={guard.passport_photo_url} alt={guard.full_name} className="w-16 h-16 rounded-full object-cover border border-slate-200 shrink-0" />
                ) : (
                  <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center font-black text-2xl shrink-0">
                     {guard.full_name?.[0] || 'G'}
                  </div>
                )}
                <div className="flex-grow">
                   <div className="flex items-center gap-4 mb-2">
                      <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{guard.full_name}</h3>
                      <span className="bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md">Interview Locked</span>
                   </div>
                   <p className="text-sm font-medium text-slate-500 italic mb-4">"{guard.dossier_data?.interviewer_notes || 'No notes added.'}"</p>
                   
                   <div className="flex flex-wrap gap-4">
                      {analyzingId === guard.id ? (
                        <span className="px-6 py-3 bg-slate-50 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-xl animate-pulse">Running Analysis...</span>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); handleRunAI(guard); }} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2">
                           <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="2.5"/></svg>
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
                       className="px-8 py-4 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg"
                       style={{ backgroundColor: '#2171B5' }}
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
           )) }
           {lockedApplicants.length === 0 && (
             <div className="py-20 text-center border-4 border-dashed border-slate-100 rounded-[3rem]">
                <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No active interviews</p>
             </div>
           )}
        </div>
      )}

      {isSystemHR && activeTab === 'resubmits' && (
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
                      <span className="text-xs font-bold text-slate-800 text-right">{detailGuard.application_status}</span>
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
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Education</h4>
                  {detailGuard.education_history?.length ? (
                    <div className="space-y-3">
                      {detailGuard.education_history.map((e, idx) => (
                        <div key={e.id || idx} className="border border-slate-100 rounded-xl p-4">
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{e.level?.replace('_', ' ') || '—'}</p>
                            <p className="text-[10px] font-mono font-bold text-slate-400 uppercase">{e.year || '—'}</p>
                          </div>
                          <div className="mt-3">
                            {renderDocLink('Certificate', e.certificate_url)}
                          </div>
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
                          </div>
                        </div>
                        <div className="mt-4">
                          {renderDocLink('Guarantor Letter', g.letter_url)}
                          {renderDocLink('Residence Letter', g.residence_letter_url)}
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
                                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Supervisor</label>
                                <div className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                                  <div className="text-xs font-bold text-slate-700">
                                    <p>{siteSupervisorProfile?.full_name || '—'}</p>
                                    <p className="text-[10px] text-slate-500">{(siteSupervisorProfile as any)?.phone || '—'}</p>
                                  </div>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Auto</span>
                                </div>
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
                        Confirm Lock
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
  );
};

export default VettingWorkflow;
