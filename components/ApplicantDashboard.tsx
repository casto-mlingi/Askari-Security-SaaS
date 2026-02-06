import React from 'react';
import { Guard, ApplicationStatus } from '../types';

interface ApplicantDashboardProps {
  guard: Guard;
  onRequestEdit?: (reason: string) => void;
}

const ApplicantDashboard: React.FC<ApplicantDashboardProps> = ({ guard, onRequestEdit }) => {
  
  // 1. Define the logical progression of your application workflow
  const statusOrder = [
    ApplicationStatus.DRAFT,
    ApplicationStatus.PENDING,
    ApplicationStatus.POOL_APPLICANT,
    ApplicationStatus.INTERVIEW_LOCKED,
    ApplicationStatus.INTERVIEWING,
    ApplicationStatus.PROCUREMENT_PENDING,
    ApplicationStatus.HIRED,
    ApplicationStatus.ACTIVE
  ];

  // 2. Helper to determine the visual state of each step
  const getStepStatus = (stepTargetStatus: ApplicationStatus) => {
    // If rejected/blacklisted, show error state
    if (guard.application_status === ApplicationStatus.REJECTED || 
        guard.application_status === ApplicationStatus.BLACKLISTED || 
        guard.application_status === ApplicationStatus.DISQUALIFIED) {
        return 'error'; 
    }

    const currentIdx = statusOrder.indexOf(guard.application_status);
    const targetIdx = statusOrder.indexOf(stepTargetStatus);

    // Safety: If status isn't in our list (e.g. 'ON_LEAVE'), default to pending
    if (currentIdx === -1) return 'pending';

    if (currentIdx > targetIdx) return 'complete';
    if (currentIdx === targetIdx) return 'current';
    return 'pending';
  };

  const steps = [
    { 
      id: 'submitted', 
      label: 'Application Submitted', 
      status: 'complete' 
    },
    { 
      id: 'screening', 
      label: 'Screening & Pool', 
      status: guard.application_status === ApplicationStatus.PENDING ? 'current' : getStepStatus(ApplicationStatus.POOL_APPLICANT)
    },
    { 
      id: 'interview', 
      label: 'Interview Stage', 
      status: getStepStatus(ApplicationStatus.INTERVIEW_LOCKED) 
    },
    { 
      id: 'hired', 
      label: 'Hired & Deployed', 
      status: getStepStatus(ApplicationStatus.ACTIVE) 
    },
  ];

  const statusColors: Record<string, string> = {
    [ApplicationStatus.DRAFT]: 'bg-gray-100 text-gray-700 border-gray-200',
    [ApplicationStatus.PENDING]: 'bg-blue-100 text-blue-700 border-blue-200',
    [ApplicationStatus.POOL_APPLICANT]: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    [ApplicationStatus.INTERVIEW_LOCKED]: 'bg-amber-100 text-amber-700 border-amber-200',
    [ApplicationStatus.INTERVIEWING]: 'bg-amber-100 text-amber-700 border-amber-200',
    [ApplicationStatus.PROCUREMENT_PENDING]: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    [ApplicationStatus.HIRED]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    [ApplicationStatus.ACTIVE]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    [ApplicationStatus.REJECTED]: 'bg-red-100 text-red-700 border-red-200',
    [ApplicationStatus.BLACKLISTED]: 'bg-slate-900 text-white border-slate-900',
    [ApplicationStatus.DISQUALIFIED]: 'bg-red-50 text-red-600 border-red-100',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500 pb-24">
      {/* Header Card */}
      <div className="bg-white rounded-[2.5rem] p-6 md:p-12 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center text-3xl font-black shadow-xl shrink-0">
              {guard.full_name?.[0] || 'G'}
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Your Application</p>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">{guard.full_name}</h1>
              <div className="flex items-center gap-3 mt-4">
                <span className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border shadow-sm ${statusColors[guard.application_status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  {guard.application_status?.replace(/_/g, ' ') || 'UNKNOWN'}
                </span>
                <span className="text-xs font-mono font-bold text-slate-400 uppercase">ID: {guard.id?.slice(0, 8)}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
             <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Completion Score</p>
             <p className="text-4xl md:text-5xl font-black font-hud text-primary">{guard.profile_score || 0}%</p>
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
              {/* FIXED LINE BELOW: Used HTML entities for quotes and optional chaining */}
              <p className="text-base font-medium text-white/80 leading-relaxed italic">
                 &quot;{guard.dossier_data?.interviewer_notes}&quot;
              </p>
           </div>
        </div>
      )}
      
      {guard.application_status === ApplicationStatus.POOL_APPLICANT && (
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
        </div>
      )}
    </div>
  );
};

export default ApplicantDashboard;
