
import React, { useState, useMemo } from 'react';
import { Guard, Site, Profile, IncidentReport, DisciplinaryCode, ApplicationStatus, UserRole } from '../types';
import { analyzeGuardDossier } from '../services/ai';
import FileUploader from './FileUploader';

interface VettingWorkflowProps {
  guards: Guard[];
  sites: Site[];
  profiles: Profile[];
  incidents: IncidentReport[];
  disciplinaryCodes: DisciplinaryCode[];
  onLock: (guardId: string, companyId: string, notes: string) => void;
  onFinalize: (guardId: string, result: 'pass' | 'fail' | 'blacklist', terms?: any, rejectionReason?: string) => void;
  currentUser?: Profile | null;
}

const VettingWorkflow: React.FC<VettingWorkflowProps> = ({ 
  guards, 
  sites, 
  profiles, 
  incidents, 
  disciplinaryCodes, 
  onLock, 
  onFinalize,
  currentUser 
}) => {
  const [activeTab, setActiveTab] = useState<'marketplace' | 'interviews'>('marketplace');
  const [selectedGuard, setSelectedGuard] = useState<Guard | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Locking State
  const [lockNote, setLockNote] = useState('');

  // Hiring State
  const [deploymentSite, setDeploymentSite] = useState('');
  const [deploymentSupervisor, setDeploymentSupervisor] = useState('');
  const [salary, setSalary] = useState<number>(300000);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [contractUrl, setContractUrl] = useState('');
  
  // Rejection State
  const [rejectionReason, setRejectionReason] = useState('');
  const [decisionMode, setDecisionMode] = useState<'view' | 'hire' | 'reject' | 'blacklist'>('view');

  // AI State
  const [aiAnalysis, setAiAnalysis] = useState<{score: number, reasoning: string, flags: string[]} | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  // Filter lists
  const poolApplicants = useMemo(() => guards.filter(g => g.application_status === ApplicationStatus.POOL_APPLICANT), [guards]);
  const lockedApplicants = useMemo(() => guards.filter(g => g.application_status === ApplicationStatus.INTERVIEW_LOCKED), [guards]);
  const supervisors = useMemo(() => profiles.filter(p => p.role === UserRole.SUPERVISOR), [profiles]);

  const handleLockSubmit = () => {
    // If user is super admin, they might not have a company_id, or they might be acting on behalf of one. 
    // For simplicity, we assume only company admins/hr lock guards, or we use a fallback if super admin.
    const companyId = currentUser?.company_id; 
    
    if (!selectedGuard || !companyId) {
        alert("You must be logged in as a Company Admin or HR to lock applicants.");
        return;
    }
    onLock(selectedGuard.id, companyId, lockNote);
    setSelectedGuard(null);
    setLockNote('');
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

  const handleHireSubmit = () => {
    if (!selectedGuard) return;
    if (!deploymentSite || !startDate || !salary) {
      alert("Please configure the deployment contract fully (Site, Start Date, Salary).");
      return;
    }

    const terms = {
      siteId: deploymentSite,
      supervisorId: deploymentSupervisor,
      salary: Number(salary),
      startDate,
      endDate,
      contractUrl: contractUrl || 'generated_contract_v1.pdf',
      signed: false
    };

    onFinalize(selectedGuard.id, 'pass', terms);
    setSelectedGuard(null);
    resetForm();
  };

  const handleRejectSubmit = (blacklist: boolean) => {
    if (!selectedGuard || !rejectionReason) {
      alert("Please provide a reason.");
      return;
    }
    onFinalize(selectedGuard.id, blacklist ? 'blacklist' : 'fail', undefined, rejectionReason);
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

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-24 animate-in fade-in duration-500">
       <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-10">
        <div>
           <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Vetting Workflow</h2>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-4">Recruitment & Background Checks</p>
        </div>
        <div className="bg-slate-100 p-1.5 rounded-2xl flex border border-slate-200 shadow-inner w-full md:w-auto">
          <button onClick={() => setActiveTab('marketplace')} className={`flex-1 md:flex-none px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'marketplace' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
            Marketplace ({poolApplicants.length})
          </button>
          <button onClick={() => setActiveTab('interviews')} className={`flex-1 md:flex-none px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'interviews' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
            Interviews ({lockedApplicants.length})
          </button>
        </div>
      </div>

      {activeTab === 'marketplace' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {poolApplicants.length > 0 ? poolApplicants.map(guard => (
             <div key={guard.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                         <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-black text-xl">
                            {guard.full_name[0]}
                         </div>
                         <div>
                            <h4 className="font-black text-slate-900 uppercase tracking-tight text-lg leading-none">{guard.full_name}</h4>
                            <p className="text-[10px] font-mono font-bold text-slate-400 mt-1 uppercase">Score: {guard.profile_score}%</p>
                         </div>
                    </div>
                </div>
                <div className="space-y-4 mb-8">
                    <div className="flex justify-between border-b border-slate-50 py-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Age</span>
                        <span className="text-xs font-bold text-slate-700">{new Date().getFullYear() - new Date(guard.dob).getFullYear()} Years</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-50 py-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Education</span>
                        <span className="text-xs font-bold text-slate-700">{guard.education_history[0]?.level.replace('_',' ') || 'None'}</span>
                    </div>
                    <div className="flex justify-between py-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded">Available</span>
                    </div>
                </div>
                <button 
                  onClick={() => { setSelectedGuard(guard); setDecisionMode('view'); }}
                  className="w-full py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary transition-all shadow-lg active:scale-95"
                >
                    Review & Lock
                </button>
             </div>
           )) : (
              <div className="col-span-full py-20 text-center border-4 border-dashed border-slate-100 rounded-[3rem]">
                  <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No applicants in the pool</p>
              </div>
           )}
        </div>
      )}

      {activeTab === 'interviews' && (
        <div className="space-y-6">
           {lockedApplicants.map(guard => (
             <div key={guard.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-8 items-start">
                <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-[1.5rem] flex items-center justify-center font-black text-2xl shrink-0">
                   {guard.full_name[0]}
                </div>
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
                        <button onClick={() => handleRunAI(guard)} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2">
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
                       onClick={() => { setSelectedGuard(guard); setDecisionMode('hire'); }}
                       className="px-8 py-4 bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200"
                    >
                       Hire & Deploy
                    </button>
                    <button 
                       onClick={() => { setSelectedGuard(guard); setDecisionMode('reject'); }}
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
                    </div>
                )}

                {decisionMode === 'hire' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Assign Site</label>
                                <select value={deploymentSite} onChange={e => setDeploymentSite(e.target.value)} className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase text-xs outline-none focus:border-primary">
                                    <option value="">-- Select Site --</option>
                                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Assign Supervisor</label>
                                <select value={deploymentSupervisor} onChange={e => setDeploymentSupervisor(e.target.value)} className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase text-xs outline-none focus:border-primary">
                                    <option value="">-- Select Supervisor --</option>
                                    {supervisors.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
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
                         <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Employment Contract</label>
                             <FileUploader label="Upload Signed PDF" fileUrl={contractUrl} onUpload={setContractUrl} onRemove={() => setContractUrl('')} className="!h-24" />
                        </div>
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
                     <button onClick={handleHireSubmit} className="w-full py-4 bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-all shadow-xl active:scale-95">
                        Finalize Contract
                     </button>
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
