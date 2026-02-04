
import React, { useState } from 'react';
// Changed default import of GuardWizard to a named import to resolve "Module has no default export" error.
// This is a common workaround when `export default` is present but the build system reports no default export,
// implying it's being treated as a named export.
import { GuardWizard } from './GuardWizard';
import BulkImport from './BulkImport';
import { Guard, UserRole } from '../types';

interface IntakeManagerProps {
  guards: Guard[];
  userRole: UserRole;
  onComplete: (guard: Guard) => void;
  isApplicantFlow?: boolean;
  applicantData?: Guard;
}

const IntakeManager: React.FC<IntakeManagerProps> = ({ guards, userRole, onComplete, isApplicantFlow = false, applicantData }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'bulk'>('manual');

  const title = isApplicantFlow ? "Complete Your Application" : "Personnel Intake";
  const subtitle = isApplicantFlow 
    ? "Please provide the following details to proceed with your application." 
    : "Onboard New Guards via Manual or Bulk Entry";

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter">{title}</h2>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-3">{subtitle}</p>
        </div>
        {!isApplicantFlow && (
          <div className="bg-slate-100 p-1.5 rounded-2xl flex border border-slate-200 shadow-inner w-full md:w-auto">
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 md:flex-none px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'manual' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Manual Intake
            </button>
            <button
              onClick={() => setActiveTab('bulk')}
              className={`flex-1 md:flex-none px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'bulk' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Bulk Import
            </button>
          </div>
        )}
      </div>

      {(activeTab === 'manual' || isApplicantFlow) ? (
        <GuardWizard onComplete={onComplete} guards={guards} userRole={userRole} initialData={applicantData} isApplicantFlow={isApplicantFlow} />
      ) : (
        <BulkImport />
      )}
    </div>
  );
};

export default IntakeManager;
