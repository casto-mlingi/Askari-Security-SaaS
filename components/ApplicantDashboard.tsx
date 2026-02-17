import React, { useEffect, useMemo, useState } from 'react';
import { Guard, ApplicationStatus } from '../types';
import { api } from '../services/api';
import { generateAIResponse } from '../services/ai';
import { MOCK_ANNOUNCEMENTS } from '../constants/mock';

interface ApplicantDashboardProps {
  guard?: Guard;
  userId?: string;
  guardsCount?: number;
  onRequestEdit?: (reason: string) => void;
  onContinue?: () => void;
  onRetry?: () => void;
}

const ApplicantDashboard: React.FC<ApplicantDashboardProps> = ({ guard, userId, guardsCount, onRequestEdit, onContinue, onRetry }) => {
  const [approved, setApproved] = useState(false);
  const [cvUrl, setCvUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiGuide, setAiGuide] = useState<string>('');
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');
  const [qaLoading, setQaLoading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [freshGuard, setFreshGuard] = useState<Guard | null>(null);
  const [verifying, setVerifying] = useState(false);
  useEffect(() => {
    console.log('DEBUG_DASHBOARD:', { userId, guardsCount });
  }, [userId, guardsCount]);
  const guardId = guard?.id || '';
  useEffect(() => {
    const run = async () => {
      try {
        if (!guardId) return;
        const r = await api.get<any[]>(`/resubmit-requests?guard_id=${guardId}`);
        const list = (r.data || []) as any[];
        setApproved(!!list.find(x => x.status === 'approved'));
      } catch {}
    };
    run();
  }, [guardId]);
  const debugVerify = async () => {
    if (!guardId) {
      (window as any).showNotification?.('error', 'System Audit: Missing guard ID.');
      return;
    }
    setVerifying(true);
    try {
      const r1 = await api.get<any[]>(`/resubmit-requests?guard_id=${guardId}`);
      const r2 = await api.get<any[]>(`/guards/${guardId}/guarantors`);
      const errs: string[] = [];
      if (r1.error) errs.push(`/resubmit-requests: ${r1.error}`);
      if (r2.error) errs.push(`/guards/${guardId}/guarantors: ${r2.error}`);
      if (errs.length === 0) {
        (window as any).showNotification?.('success', 'System Audit: API Connection Verified - All Routes Active ✅');
      } else {
        (window as any).showNotification?.('error', `System Audit: ${errs.join(' | ')}`);
      }
    } catch (e: any) {
      (window as any).showNotification?.('error', `System Audit: ${e?.message || 'Unknown error'}`);
    } finally {
      setVerifying(false);
    }
  };
  useEffect(() => {
    try {
      const auto = localStorage.getItem('debugVerifyAuto');
      if (auto === '1' && guardId) {
        debugVerify();
      }
    } catch {}
  }, [guardId]);
  useEffect(() => {
    const fetchLatest = async () => {
      try {
        if (!guardId) return;
        const r = await api.get<Guard>(`/guards/${guardId}`);
        if (r.data) setFreshGuard(r.data as Guard);
      } catch {}
    };
    fetchLatest();
    const onFocus = () => { fetchLatest(); };
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [guardId]);
  const scheduleKey = `${guard?.dossier_data?.interview_schedule?.date || ''}|${guard?.dossier_data?.interview_schedule?.location || ''}`;
  useEffect(() => {
    const date = guard?.dossier_data?.interview_schedule?.date;
    const location = guard?.dossier_data?.interview_schedule?.location;
    if (date && location) {
      const prompt = `Wewe ni msaidizi wa ajira wa kampuni ya ulinzi. Mwelekeze mwombaji wa kazi (mlinzi) kwa Kiswahili nini cha kubeba na kujiandaa nacho kwa usaili uliopangwa tarehe ${new Date(date).toLocaleDateString('sw-TZ')} katika ${location}. Toa orodha fupi: vitambulisho muhimu, nakala za vyeti, mavazi yanayofaa, muda wa kufika, na mwenendo unaotarajiwa.`;
      generateAIResponse(prompt).then(setAiGuide).catch(() => setAiGuide(''));
    } else {
      setAiGuide('');
    }
  }, [scheduleKey]);
  useEffect(() => {
    if (guardId) {
      setTimedOut(false);
      return;
    }
    const t = setTimeout(() => setTimedOut(true), 5000);
    return () => clearTimeout(t);
  }, [guardId]);
  
  if (!guard) return (
    <div className="p-20 text-center font-black space-y-6">
      <div>INAPAKIA WASIFU WAKO...</div>
      {timedOut && (
        <div className="space-x-3">
          <button onClick={onRetry} className="px-5 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">Jaribu Tena</button>
          <button onClick={onContinue} className="px-5 py-2 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest">Anza Usajili Upya</button>
        </div>
      )}
    </div>
  );
  
  const displayGuard = (freshGuard || guard) as Guard;
  const readinessScore = useMemo(() => {
    if (typeof displayGuard?.readiness_score === 'number') return displayGuard.readiness_score as number;
    const personalOk = !!(displayGuard.full_name && displayGuard.nida_number && displayGuard.phone && displayGuard.dob);
    const eduOk = (displayGuard.education_history || []).length > 0;
    const guarantorsOk = (displayGuard.guarantors || []).length >= 2;
    const docs = [
      displayGuard.application_letter_url, displayGuard.nida_front_url, displayGuard.birth_cert_url,
      displayGuard.residence_letter_url, displayGuard.medical_report_url, displayGuard.police_clearance_url,
      displayGuard.cv_url, displayGuard.passport_photo_url
    ].filter(Boolean);
    const docsOk = docs.length > 0;
    const parts = [personalOk, eduOk, guarantorsOk, docsOk].map(x => (x ? 25 : 0));
    const total = parts.reduce((a, b) => a + b, 0);
    return Math.max(total, 1);
  }, [displayGuard]);

  const latestPrivateNote = useMemo(() => {
    const notes = (guard?.dossier_data?.hr_private_notes || []) as any[];
    const last = Array.isArray(notes) && notes.length > 0 ? notes[notes.length - 1]?.note : '';
    const single = (guard?.dossier_data as any)?.private_note || '';
    return last || single || '';
  }, [guard?.dossier_data]);
  // 1. Define the logical progression of your application workflow
  const statusOrder = [
    ApplicationStatus.DRAFT,
    ApplicationStatus.SUBMITTED_APPLICATION,
    ApplicationStatus.INTERVIEWING,
    ApplicationStatus.MARKET_POOL
  ];

  // 2. Helper to determine the visual state of each step
  const getStepStatus = (stepTargetStatus: ApplicationStatus) => {
    // If rejected/blacklisted, show error state
    if (guard?.application_status === ApplicationStatus.REJECTED || 
        guard?.application_status === ApplicationStatus.BLACKLISTED || 
        guard?.application_status === ApplicationStatus.DISQUALIFIED) {
        return 'error'; 
    }

    const currentIdx = statusOrder.indexOf(guard?.application_status as ApplicationStatus);
    const targetIdx = statusOrder.indexOf(stepTargetStatus);

    // Safety: If status isn't in our list (e.g. 'ON_LEAVE'), default to pending
    if (currentIdx === -1) return 'pending';

    if (currentIdx > targetIdx) return 'complete';
    if (currentIdx === targetIdx) return 'current';
    return 'pending';
  };

  const steps = [
    {
      id: 'draft',
      label: 'Draft (Not Submitted)',
      status: getStepStatus(ApplicationStatus.DRAFT)
    },
    {
      id: 'submitted',
      label: 'Submitted Application',
      status: getStepStatus(ApplicationStatus.SUBMITTED_APPLICATION)
    },
    {
      id: 'interview',
      label: 'Interviewing',
      status: getStepStatus(ApplicationStatus.INTERVIEWING)
    },
    {
      id: 'selected',
      label: 'Selected (Waiting Deployment)',
      status: getStepStatus(ApplicationStatus.MARKET_POOL)
    },
  ];

  const statusColors: Record<string, string> = {
    [ApplicationStatus.DRAFT]: 'bg-gray-100 text-gray-700 border-gray-200',
    [ApplicationStatus.SUBMITTED_APPLICATION]: 'bg-blue-100 text-blue-700 border-blue-200',
    [ApplicationStatus.MARKET_POOL]: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    [ApplicationStatus.INTERVIEWING]: 'bg-amber-100 text-amber-700 border-amber-200',
    [ApplicationStatus.REJECTED]: 'bg-red-100 text-red-700 border-red-200',
    [ApplicationStatus.BLACKLISTED]: 'bg-slate-900 text-white border-slate-900',
    [ApplicationStatus.DISQUALIFIED]: 'bg-red-50 text-red-600 border-red-100',
  };

  const isSara = (guard?.email || '').toLowerCase() === 'sara@amini.co.tz';
  const canContinue = (guard?.application_status !== ApplicationStatus.ACTIVE && guard?.application_status !== ApplicationStatus.ACTIVE_GUARD);

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500 pb-24">
      <div className="no-print flex justify-end">
        <button
          onClick={debugVerify}
          disabled={verifying}
          className={`mb-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${verifying ? 'bg-slate-300 text-slate-500' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
        >
          {verifying ? 'Verifying…' : 'Debug Verify API'}
        </button>
      </div>
      {guard?.application_status === ApplicationStatus.SUBMITTED_APPLICATION && (
        <div className="bg-gradient-to-br from-primary to-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl border border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="3" /></svg>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70">Application Submitted</p>
              <p className="text-sm font-medium text-white mt-2">Hongera! Usajili wako umepokelewa na System HR. Utapata taarifa hapa hapa kwenye Dashboard yako pindi utakapohakikiwa na kuwekwa kwenye Marketplace kwa ajili ya kuajiriwa na kampuni za ulinzi. Kaa tayari!</p>
            </div>
          </div>
        </div>
      )}
      {/* Personalized CTA for Sara */}
      {isSara && canContinue && (
        <div className="bg-gradient-to-br from-primary to-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl border border-white/10">
          <div className="flex items-center justify-between gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70">Karibu Sara</p>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter leading-tight">Endelea na maombi yako</h2>
              <p className="text-sm font-medium text-white/80 mt-2">Bonyeza kifungo hapa chini kuendelea kujaza taarifa zako kabla ya kuangalia muhtasari.</p>
            </div>
            <button
              onClick={onContinue}
              className="px-6 py-3 rounded-xl bg-white text-slate-900 text-[10px] font-black uppercase tracking-widest shadow-lg hover:opacity-90 transition-all active:scale-95"
            >
              Continue With Application
            </button>
          </div>
        </div>
      )}
      {/* Header Card */}
      <div className="bg-white rounded-[2.5rem] p-6 md:p-12 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center text-3xl font-black shadow-xl shrink-0">
              {guard?.full_name?.[0] || 'G'}
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Your Application</p>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">{guard?.full_name}</h1>
              <div className="flex items-center gap-3 mt-4">
                <span className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border shadow-sm ${statusColors[guard?.application_status as any] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  {guard?.application_status?.replace(/_/g, ' ') || 'UNKNOWN'}
                </span>
                <span className="text-xs font-mono font-bold text-slate-400 uppercase">ID: {guard?.id?.slice(0, 8)}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
             <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Readiness Score</p>
             <p className="text-4xl md:text-5xl font-black font-hud text-primary">{readinessScore}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Public SMS</p>
          <div className="space-y-3">
            {(MOCK_ANNOUNCEMENTS || []).slice(0, 3).map(a => (
              <div key={a.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-xs font-bold text-slate-500">{a.title}</p>
                <p className="text-sm font-medium text-slate-900 mt-1">{a.content}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Private Notice</p>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-sm font-medium text-slate-900">{latestPrivateNote || 'Hakuna ujumbe binafsi kwa sasa.'}</p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 p-6 md:p-12 shadow-sm">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-10 flex items-center gap-4">
          Tracking Status
          <div className="h-px flex-grow bg-slate-100" />
        </h3>
        
        <div className="space-y-12">
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            const isComplete = step.status === 'complete';
            const isCurrent = step.status === 'current';
            const isError = step.status === 'error';

            return (
              <div key={step.id} className="relative flex items-start gap-8 group">
                {!isLast && (
                  <div className={`absolute left-5 top-10 w-0.5 h-14 transition-colors duration-500 ${isComplete ? 'bg-primary' : 'bg-slate-100'}`} />
                )}
                
                <div className={`z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 font-hud font-black text-sm ${
                  isComplete ? 'bg-primary border-primary text-white' :
                  isCurrent ? 'bg-white border-primary text-primary shadow-lg shadow-blue-900/10 scale-110' :
                  isError ? 'bg-red-50 border-red-500 text-red-500' :
                  'bg-white border-slate-200 text-slate-300'
                }`}>
                  {isComplete ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="4" /></svg>
                  ) : isError ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="4" /></svg>
                  ) : (
                    idx + 1
                  )}
                </div>

                <div className="flex-grow pt-1">
                  <p className={`font-black uppercase tracking-widest transition-colors ${step.status !== 'pending' ? 'text-slate-900 text-sm md:text-base' : 'text-slate-300 text-sm'}`}>
                    {step.label}
                  </p>
                  <p className={`text-xs font-bold uppercase mt-1 ${
                    isComplete ? 'text-emerald-500' : 
                    isCurrent ? 'text-primary animate-pulse' : 
                    isError ? 'text-red-500' :
                    'text-slate-300'
                  }`}>
                    {isComplete ? 'Step Complete' : 
                     isCurrent ? 'In Progress' : 
                     isError ? 'Application Halted' :
                     'Next Step'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* HR Notes / Dossier */}
      {guard.dossier_data?.interviewer_notes && (
        <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white space-y-6 shadow-2xl">
           <div className="flex items-center gap-3">
              <div className="w-2 h-6 bg-primary rounded-full" />
              <h3 className="text-sm font-black uppercase tracking-widest">Notes from HR</h3>
           </div>
           
           <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                 <span className="text-xs font-black text-primary uppercase tracking-widest">Official Interview Notes</span>
                 <span className="text-[10px] font-bold text-white/40 uppercase">Private</span>
              </div>
              <p className="text-base font-medium text-white/80 leading-relaxed italic">
                 &quot;{guard.dossier_data?.interviewer_notes}&quot;
              </p>
           </div>
        </div>
      )}
      {(guard?.dossier_data?.interview_schedule?.date || guard?.dossier_data?.interview_schedule?.location) && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-6 md:p-12 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Interview Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs font-bold text-slate-500">Date</p>
              <p className="text-sm font-black text-slate-900">{new Date(guard?.dossier_data?.interview_schedule?.date as any).toLocaleString()}</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs font-bold text-slate-500">Location</p>
              <p className="text-sm font-black text-slate-900">{guard?.dossier_data?.interview_schedule?.location || 'Company Office'}</p>
            </div>
          </div>
          {!!aiGuide && (
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Mwongozo wa Usaili</p>
              <p className="text-sm text-slate-700 font-medium leading-relaxed">{aiGuide}</p>
            </div>
          )}
        </div>
      )}
      
      
      {guard.application_status !== ApplicationStatus.DRAFT && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-6 md:p-12 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Request CV Edit</h3>
          <p className="text-xs text-slate-500">You cannot edit your application directly. Submit a request to HR for permission to resubmit.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <textarea id="req-reason" className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="Describe what you need to update"></textarea>
            <div className="flex items-end">
              <button 
                type="button"
                onClick={() => {
                  const el = document.getElementById('req-reason') as HTMLTextAreaElement | null;
                  const reason = el?.value || '';
                  if (!reason.trim()) { alert('Please provide a reason.'); return; }
                  onRequestEdit?.(reason.trim());
                }}
                className="w-full md:w-auto px-6 py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary transition-all"
              >
                Submit Request
              </button>
            </div>
          </div>
          <div className="mt-6">
            <div className="flex items-center gap-3">
              <input
                type="url"
                value={cvUrl}
                onChange={e => setCvUrl(e.target.value)}
                placeholder="Link to your CV"
                className="flex-1 h-12 px-5 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-primary"
              />
              <button
                disabled={!approved || saving || !cvUrl}
                onClick={async () => {
                  setSaving(true);
                  const r = await api.post(`/guards/${guard?.id}/self-update`, { cv_url: cvUrl });
                  setSaving(false);
                  if (r.error) {
                    (window as any).showNotification?.('error', r.error);
                  } else {
                    (window as any).showNotification?.('success', 'CV updated.');
                  }
                }}
                className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${approved ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}
              >
                Save CV
              </button>
            </div>
            {!approved && (
              <p className="text-xs font-bold text-amber-600 mt-2">Awaiting approval from Super Admin.</p>
            )}
          </div>
        </div>
      )}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 p-6 md:p-12 shadow-sm space-y-6">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Uliza Swali</h3>
        <textarea
          value={qaQuestion}
          onChange={e => setQaQuestion(e.target.value)}
          placeholder="Andika swali kuhusu usaili au ajira..."
          className="w-full h-28 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm"
        />
        <button
          onClick={async () => {
            if (!qaQuestion.trim()) return;
            setQaLoading(true);
            try {
              const answer = await generateAIResponse(`Jibu kwa Kiswahili kwa ufupi na kwa heshima: ${qaQuestion}`);
              setQaAnswer(answer);
            } catch {
              setQaAnswer('Imeshindikana kupata jibu kwa sasa.');
            } finally {
              setQaLoading(false);
            }
          }}
          className="px-6 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl"
        >
          {qaLoading ? 'Inachakata...' : 'Tuma Swali'}
        </button>
        {!!qaAnswer && (
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Jibu</p>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">{qaAnswer}</p>
          </div>
        )}
      </div>
      <div className="bg-white rounded-[2.5rem] border border-slate-200 p-6 md:p-12 shadow-sm space-y-4">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Mipangilio ya Akaunti</h3>
        <button
          onClick={async () => {
            try {
              await api.delete('/guards/' + guard?.id);
              (window as any).showNotification?.('success', 'Akaunti yako imeondolewa.');
            } catch {
              (window as any).showNotification?.('error', 'Imeshindikana kuondoa akaunti.');
            }
          }}
          className="px-6 py-3 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl"
        >
          Futa Akaunti
        </button>
      </div>
    </div>
  );
};

export default ApplicantDashboard;
