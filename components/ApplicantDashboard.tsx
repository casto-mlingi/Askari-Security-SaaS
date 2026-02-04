
import React from 'react';
import { Guard, ApplicationStatus } from '../types';

interface ApplicantDashboardProps {
  guard: Guard;
}

const ApplicantDashboard: React.FC<ApplicantDashboardProps> = ({ guard }) => {
  const steps = [
    { id: 'submitted', label: 'Application Submitted', status: 'complete' },
    { id: 'pending', label: 'Under Review', status: guard.application_status === ApplicationStatus.PENDING ? 'current' : 'complete' },
    { id: 'locked', label: 'Interview Stage', status: guard.application_status === ApplicationStatus.INTERVIEW_LOCKED ? 'current' : (guard.application_status === ApplicationStatus.PROCUREMENT_PENDING || guard.application_status === ApplicationStatus.ACTIVE) ? 'complete' : 'pending' },
    { id: 'deployed', label: 'Hired', status: guard.application_status === ApplicationStatus.ACTIVE ? 'current' : 'pending' },
  ];

  const statusColors: Record<string, string> = {
    [ApplicationStatus.PENDING]: 'bg-blue-100 text-blue-700 border-blue-200',
    [ApplicationStatus.POOL_APPLICANT]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    [ApplicationStatus.INTERVIEW_LOCKED]: 'bg-amber-100 text-amber-700 border-amber-200',
    [ApplicationStatus.PROCUREMENT_PENDING]: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    [ApplicationStatus.REJECTED]: 'bg-red-100 text-red-700 border-red-200',
    [ApplicationStatus.BLACKLISTED]: 'bg-slate-900 text-white border-slate-900',
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500 pb-24">
      <div className="bg-white rounded-[2.5rem] p-6 md:p-12 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center text-3xl font-black shadow-xl shrink-0">
              {guard.full_name[0]}
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Your Application</p>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">{guard.full_name}</h1>
              <div className="flex items-center gap-3 mt-4">
                <span className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border shadow-sm ${statusColors[guard.application_status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  {guard.application_status.replace('_', ' ')}
                </span>
                <span className="text-xs font-mono font-bold text-slate-400 uppercase">ID: {guard.id.slice(0, 8)}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
             <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Completion Score</p>
             <p className="text-4xl md:text-5xl font-black font-hud text-primary">{guard.profile_score}%</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 p-6 md:p-12 shadow-sm">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-10 flex items-center gap-4">
          Application Status
          <div className="h-px flex-grow bg-slate-100" />
        </h3>
        
        <div className="space-y-12">
          {steps.map((step, idx) => (
            <div key={step.id} className="relative flex items-start gap-8 group">
              {idx !== steps.length - 1 && (
                <div className={`absolute left-5 top-10 w-0.5 h-14 transition-colors duration-500 ${step.status === 'complete' ? 'bg-primary' : 'bg-slate-100'}`} />
              )}
              <div className={`z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 font-hud font-black text-sm ${
                step.status === 'complete' ? 'bg-primary border-primary text-white' :
                step.status === 'current' ? 'bg-white border-primary text-primary shadow-lg shadow-blue-900/10 scale-110' :
                'bg-white border-slate-200 text-slate-300'
              }`}>
                {step.status === 'complete' ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="4" /></svg> : (idx + 1)}
              </div>
              <div className="flex-grow pt-1">
                <p className={`font-black uppercase tracking-widest transition-colors ${step.status !== 'pending' ? 'text-slate-900 text-sm md:text-base' : 'text-slate-300 text-sm'}`}>{step.label}</p>
                <p className={`text-xs font-bold uppercase mt-1 ${step.status === 'complete' ? 'text-emerald-500' : step.status === 'current' ? 'text-primary animate-pulse' : 'text-slate-300'}`}>
                  {step.status === 'complete' ? 'Step Complete' : step.status === 'current' ? 'In Progress' : 'Next Step'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

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
                 "{guard.dossier_data.interviewer_notes}"
              </p>
           </div>
        </div>
      )}
    </div>
  );
};

export default ApplicantDashboard;
