

import React, { useMemo } from 'react';
import { Guard, ApplicationStatus } from '../types';

interface GuardProfileProps {
  guard: Guard;
}

const calculateAge = (dob: string): number | null => {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  if (isNaN(birth.getTime())) return null;
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

const SectionHeader: React.FC<{ title: string; icon: React.ReactNode }> = ({ title, icon }) => (
  <div className="flex items-center gap-3 mb-6">
    <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
      {icon}
    </div>
    <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">{title}</h3>
    <div className="h-px flex-grow bg-slate-100" />
  </div>
);

const DetailItem: React.FC<{ label: string; value?: string | number; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    <span className={`text-sm font-bold text-slate-700 ${mono ? 'font-mono' : ''}`}>
      {value || 'Not Disclosed'}
    </span>
  </div>
);

const DocumentLink: React.FC<{ label: string; url?: string; onView?: (url: string) => void; }> = ({ label, url, onView }) => {
  if (!url) return null;
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
      <div className="flex items-center gap-3">
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
        <span className="text-[10px] font-bold text-slate-600 uppercase truncate">{label}</span>
      </div>
      <button onClick={() => onView && url && onView(url)} className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View File</button>
    </div>
  );
};

const GuardProfile: React.FC<GuardProfileProps> = ({ guard }) => {
  const age = useMemo(() => calculateAge(guard.dob), [guard.dob]);

  const handleRequestUpdate = () => {
    alert("Your request to update your profile has been sent to HR for review.");
  };
  
  // Dummy function for document viewing within the profile, not a real modal for this component
  const handleViewDocument = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Summary */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 flex items-center gap-6">
          {guard.passport_photo_url ? (
            <img src={guard.passport_photo_url} alt={guard.full_name} className="w-20 h-20 rounded-2xl object-cover border border-white/20 shadow-xl" />
          ) : (
            <div className="w-20 h-20 rounded-[2rem] bg-white text-primary flex items-center justify-center text-3xl font-black shadow-xl">
              {guard.full_name?.[0] || 'G'}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter leading-none">{guard.full_name}</h2>
            <div className="flex items-center gap-3 mt-3">
              <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                guard.application_status === ApplicationStatus.BLACKLISTED 
                  ? 'bg-red-50 text-red-600 border-red-100' 
                  : 'bg-primary/20 text-primary-light border-white/10'
              }`}>
                {guard.application_status === ApplicationStatus.BLACKLISTED ? 'Blacklisted' : 'Active Duty'}
              </span>
              <span className="text-[10px] font-mono text-white/40 font-bold">ID: {guard.id.slice(0, 8)}</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-white/5">
          <div>
            <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Performance</p>
            <p className="text-4xl font-black font-hud text-emerald-400">{guard.performance_score || 100}%</p>
            <div className="mt-3">
              <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Readiness</p>
              <p className="text-xl font-black font-hud text-primary-light">{typeof guard.readiness_score === 'number' ? guard.readiness_score : 0}%</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Status</p>
            <p className={`text-lg font-black uppercase tracking-tight ${
              guard.application_status === ApplicationStatus.BLACKLISTED ? 'text-red-400' : 'text-white/90'
            }`}>
              {String(guard.application_status || 'active').replace('_',' ')}
            </p>
          </div>
        </div>
      </div>

      {/* Main Dossier Content */}
      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden p-8 md:p-12 space-y-12">
        
        {/* Identity Registry */}
        <section>
          <SectionHeader title="Personal Details" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeWidth="2.5" /></svg>} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            <DetailItem label="NIDA Number" value={guard.nida_number} mono />
            <DetailItem label="Phone Number" value={guard.phone} mono />
            <DetailItem label="Date of Birth" value={guard.dob} />
            <DetailItem label="Age" value={age ? `${age} Years` : undefined} />
            <DetailItem label="Current Shift" value={guard.current_shift?.toUpperCase() || 'NOT_ASSIGNED'} />
            <DetailItem label="Armed Status" value={guard.is_armed ? 'Armed' : 'Unarmed'} />
          </div>
        </section>

        <section>
          <SectionHeader title="Dossier" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 7h18M3 12h18M3 17h18" strokeWidth="2.5" /></svg>} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            <DetailItem label="Physical Address" value={(guard as any)?.dossier_data?.physical_address || 'N/A'} />
            <DetailItem label="Emergency Contact" value={(guard as any)?.dossier_data?.emergency_contact || 'N/A'} />
            <DetailItem label="Shirt Size" value={(guard as any)?.dossier_data?.uniform_shirt_size || 'N/A'} />
            <DetailItem label="Boot Size" value={(guard as any)?.dossier_data?.uniform_boot_size || 'N/A'} />
          </div>
          <div className="mt-6 p-6 bg-slate-50 border border-slate-100 rounded-2xl">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Guarantors</p>
            {Array.isArray(guard.guarantors) && guard.guarantors.length > 0 ? (
              <div className="space-y-4">
                {guard.guarantors.map((g, i) => (
                  <div key={g.id} className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
                    <DetailItem label={`Guarantor #${i + 1} Name`} value={g.name} />
                    <DetailItem label={`Guarantor #${i + 1} Phone`} value={g.phone} mono />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">No guarantors listed.</p>
            )}
          </div>
        </section>

        <section>
          <SectionHeader title="Security Training" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6v12m6-6H6" strokeWidth="2.5" /></svg>} />
          {Array.isArray((guard as any).security_training) && (guard as any).security_training.length > 0 ? (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
              <p className="text-sm font-bold text-slate-700">{(guard as any).security_training.join(', ')}</p>
            </div>
          ) : (
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">No training listed.</p>
          )}
        </section>

        {/* Support Network */}
        <section>
          <SectionHeader title="Contacts" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" strokeWidth="2.5" /></svg>} />
          <div className="space-y-8">
            {guard.guarantors?.map((g, i) => (
              <div key={g.id} className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 p-6 bg-slate-50 border border-slate-100 rounded-2xl">
                 <DetailItem label={`Guarantor #${i + 1} Name`} value={g.name} />
                 <DetailItem label={`Guarantor #${i + 1} Phone`} value={g.phone} mono />
              </div>
            ))}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 pt-8 border-t border-slate-100">
                <DetailItem label="Next of Kin Name" value={guard.next_of_kin_name} />
                <DetailItem label="Next of Kin Phone" value={guard.next_of_kin_phone} mono />
             </div>
          </div>
        </section>

        {/* Academic History */}
        <section>
          <SectionHeader title="Education" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 14l9-5-9-5-9 5 9 5z" strokeWidth="2.5" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" strokeWidth="2.5" /></svg>} />
          <div className="space-y-4">
            {guard.education_history.length > 0 ? (
              guard.education_history.map(edu => (
                <div key={edu.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{edu.level?.replace('_', ' ')}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-widest">Completed: {edu.year}</p>
                  </div>
                  {edu.weapon_proficiency === 'pass' && (
                    <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 px-2 py-1 rounded uppercase tracking-widest border border-emerald-200">Armed Certified</span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">No education history found.</p>
            )}
          </div>
        </section>

        {/* Documents */}
        <section>
          <SectionHeader title="Documents" icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" strokeWidth="2.5" /></svg>} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <DocumentLink label="NIDA Document" url={guard.nida_front_url} onView={handleViewDocument} />
            <DocumentLink label="Birth Certificate" url={guard.birth_cert_url} onView={handleViewDocument} />
            <DocumentLink label="Residence Letter" url={guard.residence_letter_url} onView={handleViewDocument} />
            <DocumentLink label="Employment Contract" url={guard.employment_contract_url} onView={handleViewDocument} />
            {/* Add guarantor letters here if they were globally viewable, otherwise they are nested under guarantors */}
            {guard.guarantors?.map((g, i) => (
                <React.Fragment key={g.id}>
                    <DocumentLink label={`Guarantor #${i+1} Letter`} url={g.letter_url} onView={handleViewDocument} />
                    <DocumentLink label={`Guarantor #${i+1} Residence`} url={g.residence_letter_url} onView={handleViewDocument} />
                </React.Fragment>
            ))}
            {guard.education_history?.map(edu => (
                edu.certificate_url && <DocumentLink key={edu.id} label={`${edu.level?.replace('_', ' ')} Cert (${edu.year})`} url={edu.certificate_url} onView={handleViewDocument} />
            ))}
          </div>
        </section>

        {/* Action Controls */}
        <div className="pt-10 border-t border-slate-100 flex flex-col items-center gap-6">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center max-w-sm">
            To change your profile information, you must submit an update request to HR.
          </p>
          <button 
            onClick={handleRequestUpdate}
            className="w-full h-16 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-primary transition-all active:scale-95 shadow-xl shadow-slate-200"
          >
            Request Profile Update
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuardProfile;
