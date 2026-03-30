
import React, { useState } from 'react';
// Changed default import of GuardWizard to a named import to resolve "Module has no default export" error.
// This is a common workaround when `export default` is present but the build system reports no default export,
// implying it's being treated as a named export.
import { GuardWizard } from './GuardWizard';
import BulkImport from './BulkImport';
import VettingWorkflow from './VettingWorkflow';
import { Guard, UserRole, SecurityLevel, GuardEducationLevel, SecurityTraining, Site, Profile, IncidentReport, DisciplinaryCode } from '../types';
import { api } from '../services/api';

interface IntakeManagerProps {
  guards: Guard[];
  userRole: UserRole;
  onComplete: (guard: Guard, isApplicantFlow?: boolean) => void;
  isApplicantFlow?: boolean;
  applicantData?: Guard;
  // Additional props for Interviews tab (mostly for reg_officer)
  sites?: Site[];
  profiles?: Profile[];
  companies?: { id: string; name: string; address?: string }[];
  incidents?: IncidentReport[];
  disciplinaryCodes?: DisciplinaryCode[];
  onLock?: (guardId: string, companyId: string, notes: string, schedule?: { date: string; location: string }) => void;
  onFinalize?: (guardId: string, result: 'pass' | 'fail' | 'blacklisted', terms?: any, rejectionReason?: string) => void;
  currentUser?: Profile | null;
}

const IntakeManager: React.FC<IntakeManagerProps> = ({
  guards,
  userRole,
  onComplete,
  isApplicantFlow = false,
  applicantData,
  sites = [],
  profiles = [],
  companies = [],
  incidents = [],
  disciplinaryCodes = [],
  onLock,
  onFinalize,
  currentUser
}) => {
  const isRegOfficer = userRole === UserRole.REG_OFFICER;
  const [activeTab, setActiveTab] = useState<'manual' | 'bulk' | 'interviews'>(isRegOfficer ? 'manual' : 'manual');
  const [innerTab, setInnerTab] = useState<'manual' | 'bulk'>('manual');
  const [educationLevel, setEducationLevel] = useState<GuardEducationLevel | ''>('');
  const [securityLevel, setSecurityLevel] = useState<SecurityLevel | ''>('');
  const [securityTraining, setSecurityTraining] = useState<SecurityTraining[]>([]);

  const title = isApplicantFlow ? "Complete Your Application" : "Personnel Intake";
  const subtitle = isApplicantFlow 
    ? "Please provide the following details to proceed with your application." 
    : isRegOfficer 
      ? "Register new guards or verify interview list"
      : "Onboard New Guards via Manual or Bulk Entry";

  const canEdit = isApplicantFlow 
    ? (String((applicantData as any)?.status || '').toLowerCase() === 'draft' || !!applicantData?.dossier_data?.allow_edit)
    : true;

  const correctionMode = !!(isApplicantFlow && String((applicantData as any)?.status || '').toLowerCase() === 'draft' && applicantData?.dossier_data?.allow_edit);
  const latestPrivateNote = (() => {
    const notes = (applicantData?.dossier_data?.hr_private_notes || []) as any[];
    const last = Array.isArray(notes) && notes.length > 0 ? notes[notes.length - 1]?.note : '';
    const single = (applicantData?.dossier_data as any)?.private_note || '';
    return last || single || '';
  })();

  const handleIntakeComplete = async (guard: Guard, isAppFlow?: boolean) => {
    onComplete(guard, isAppFlow);
  };

  class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
    declare props: Readonly<{ children: React.ReactNode }>;
    state: { hasError: boolean } = { hasError: false };
    static getDerivedStateFromError(_: any) {
      return { hasError: true };
    }
    render() {
      if (this.state.hasError) {
        return (
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200 text-center">
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Something went wrong. Please refresh and try again.</p>
          </div>
        );
      }
      return this.props.children as any;
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter">{title}</h2>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-3">{subtitle}</p>
        </div>
        {!isApplicantFlow && (
          <div className="bg-slate-100 p-1.5 rounded-2xl flex border border-slate-200 shadow-inner w-full md:w-auto overflow-x-auto">
            {!isRegOfficer ? (
              <>
                <button
                  onClick={() => setActiveTab('manual')}
                  className={`flex-none px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === 'manual' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Manual Intake
                </button>
                <button
                  onClick={() => setActiveTab('bulk')}
                  className={`flex-none px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === 'bulk' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Bulk Import
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setActiveTab('manual')}
                  className={`flex-none px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === 'manual' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Manual Intake
                </button>
                <button
                  onClick={() => setActiveTab('interviews')}
                  className={`flex-none px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === 'interviews' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Interviews
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {isRegOfficer && activeTab === 'manual' && (
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setInnerTab('manual')}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              innerTab === 'manual' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
            }`}
          >
            Manual Form
          </button>
          <button
            onClick={() => setInnerTab('bulk')}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              innerTab === 'bulk' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
            }`}
          >
            Bulk Import
          </button>
        </div>
      )}

      {correctionMode && (
        <div className="bg-white p-6 rounded-[2rem] border border-amber-200 shadow-sm mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-6 bg-amber-400 rounded-full" />
              <p className="text-xs font-black text-amber-600 uppercase tracking-widest">Correction Mode</p>
            </div>
          </div>
          {!!latestPrivateNote && (
            <p className="text-sm font-medium text-slate-900 mt-3">{latestPrivateNote}</p>
          )}
        </div>
      )}

      {activeTab === 'interviews' && isRegOfficer ? (
        <ErrorBoundary>
          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 overflow-hidden">
             <VettingWorkflow 
                guards={guards}
                sites={sites}
                profiles={profiles}
                companies={companies}
                incidents={incidents}
                disciplinaryCodes={disciplinaryCodes}
                onLock={onLock || (() => {})}
                onFinalize={onFinalize || (() => {})}
                currentUser={currentUser}
                readOnly={true}
             />
          </div>
        </ErrorBoundary>
      ) : isApplicantFlow ? (
          <ErrorBoundary>
            {!canEdit && (
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200 text-center mb-6">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">View Only: Editing is locked. Please request approval to resubmit.</p>
              </div>
            )}
            <GuardWizard onComplete={(guard) => handleIntakeComplete(guard, isApplicantFlow)} guards={guards} userRole={userRole} initialData={applicantData} isApplicantFlow={isApplicantFlow} isReadOnly={!canEdit} />
          </ErrorBoundary>
      ) : (
        (activeTab === 'manual' || (isRegOfficer && innerTab === 'manual')) ? (
          <ErrorBoundary>
            <GuardWizard onComplete={(guard) => handleIntakeComplete(guard, isApplicantFlow)} guards={guards} userRole={userRole} />
          </ErrorBoundary>
        ) : (
          <ErrorBoundary>
            <BulkImport />
          </ErrorBoundary>
        )
      )}
    </div>
  );
};

export default IntakeManager;
