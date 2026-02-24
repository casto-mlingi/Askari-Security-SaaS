
import React, { useState } from 'react';
// Changed default import of GuardWizard to a named import to resolve "Module has no default export" error.
// This is a common workaround when `export default` is present but the build system reports no default export,
// implying it's being treated as a named export.
import { GuardWizard } from './GuardWizard';
import BulkImport from './BulkImport';
import { Guard, UserRole, SecurityLevel, GuardEducationLevel, SecurityTraining } from '../types';
import { api } from '../services/api';

interface IntakeManagerProps {
  guards: Guard[];
  userRole: UserRole;
  onComplete: (guard: Guard, isApplicantFlow?: boolean) => void;
  isApplicantFlow?: boolean;
  applicantData?: Guard;
}

const IntakeManager: React.FC<IntakeManagerProps> = ({ guards, userRole, onComplete, isApplicantFlow = false, applicantData }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'bulk'>('manual');
  const [educationLevel, setEducationLevel] = useState<GuardEducationLevel | ''>('');
  const [securityLevel, setSecurityLevel] = useState<SecurityLevel | ''>('');
  const [securityTraining, setSecurityTraining] = useState<SecurityTraining[]>([]);

  const title = isApplicantFlow ? "Complete Your Application" : "Personnel Intake";
  const subtitle = isApplicantFlow 
    ? "Please provide the following details to proceed with your application." 
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

  const computeReadinessScore = (g: Guard): number => {
    const E_map: Record<GuardEducationLevel, number> = {
      primary: 10,
      secondary: 20,
      college: 30,
      university: 40,
      military: 50
    };
    const S_map: Record<SecurityLevel, number> = {
      standard: 10,
      armed: 30,
      supervisor: 40,
      elite: 50
    };
    const E_points = g.education_level ? E_map[g.education_level as GuardEducationLevel] || 0 : (educationLevel ? E_map[educationLevel as GuardEducationLevel] : 0);
    const S_points = g.security_level ? S_map[g.security_level as SecurityLevel] || 0 : (securityLevel ? S_map[securityLevel as SecurityLevel] : 0);
    const docFields = [
      g.application_letter_url, g.nida_front_url, g.birth_cert_url, g.residence_letter_url,
      g.medical_report_url, g.police_clearance_url, g.cv_url, g.passport_photo_url, g.previous_employer_letter_url,
      g.employment_contract_url
    ];
    const providedCount = docFields.reduce((acc, v) => acc + ((v !== null && v !== undefined && String(v).trim() !== '') ? 1 : 0), 0);
    const D_status = providedCount * 5;
    const training = (g.security_training || securityTraining || []).map(x => String(x).toLowerCase());
    const T_points = (training.includes('k9_handler') ? 12 : 0) + (training.includes('fire_safety') ? 8 : 0);
    return E_points + S_points + D_status + T_points;
  };

  const handleIntakeComplete = async (guard: Guard, isAppFlow?: boolean) => {
    // Single-POST flow: do not PATCH after create. Any scoring is handled server-side.
    onComplete(guard, isAppFlow);
  };
  class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
    declare props: Readonly<{ children: React.ReactNode }>;
    state: { hasError: boolean } = { hasError: false };
    static getDerivedStateFromError(_: any) {
      return { hasError: true };
    }
    componentDidCatch(_: any, __: any) {}
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

      {correctionMode && (
        <div className="bg-white p-6 rounded-[2rem] border border-amber-200 shadow-sm mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-6 bg-amber-400 rounded-full" />
              <p className="text-xs font-black text-amber-600 uppercase tracking-widest">Correction Mode</p>
            </div>
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Inputs unlocked</span>
          </div>
          {!!latestPrivateNote && (
            <p className="text-sm font-medium text-slate-900 mt-3">{latestPrivateNote}</p>
          )}
        </div>
      )}

      {/* Controls removed per request */}

      {isApplicantFlow ? (
          <ErrorBoundary>
            {!canEdit && (
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200 text-center mb-6">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">View Only: Editing is locked. Please request approval to resubmit.</p>
              </div>
            )}
            <GuardWizard onComplete={(guard) => handleIntakeComplete(guard, isApplicantFlow)} guards={guards} userRole={userRole} initialData={applicantData} isApplicantFlow={isApplicantFlow} isReadOnly={!canEdit} />
          </ErrorBoundary>
      ) : (
        (activeTab === 'manual') ? (
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
