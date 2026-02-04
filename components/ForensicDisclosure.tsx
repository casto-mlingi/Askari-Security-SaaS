import React, { useMemo, useState } from 'react';
import { Guard, IncidentReport, DisciplinaryCode, EducationRecord, ApplicationStatus } from '../types';

interface ForensicDisclosureProps {
  guard: Guard;
  incidents: IncidentReport[];
  disciplinaryCodes: DisciplinaryCode[];
  onClose: () => void;
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

const InfoRow: React.FC<{ label: string; value?: string | number; redacted?: boolean; mono?: boolean }> = ({ label, value, redacted, mono }) => (
  <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 last:border-0 group">
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
    <span className={`text-sm font-semibold truncate max-w-full sm:max-w-xs ${redacted ? 'text-red-400 italic bg-red-50 px-2 py-0.5 rounded' : 'text-slate-700'} ${mono ? 'font-mono tracking-tight' : ''}`}>
      {redacted ? 'HIDDEN FOR PRIVACY' : (value || 'N/A')}
    </span>
  </div>
);

const DocumentLink: React.FC<{ label: string; url?: string; redacted?: boolean; onView?: (url: string) => void; }> = ({ label, url, redacted, onView }) => {
  if (!url) return null;
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
      <div className="flex items-center gap-3">
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
        <span className="text-[10px] font-bold text-slate-600 uppercase truncate">{label}</span>
      </div>
      {redacted ? (
        <span className="text-[8px] font-black text-red-400 uppercase tracking-widest px-2 py-1 bg-red-50 rounded">Revoked</span>
      ) : (
        <button onClick={() => onView && url && onView(url)} className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View File</button>
      )}
    </div>
  );
};

const ForensicDisclosure: React.FC<ForensicDisclosureProps> = ({ guard, incidents, disciplinaryCodes, onClose }) => {
  const [expandedArtifact, setExpandedArtifact] = useState<string | null>(null);

  const guardIncidents = useMemo(() => 
    incidents
      .filter(i => i.guard_id === guard.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [incidents, guard]
  );

  const isBlacklisted = guard.application_status === ApplicationStatus.BLACKLISTED;
  const age = useMemo(() => calculateAge(guard.dob), [guard.dob]);

  return (
    <div className="fixed inset-0 z-[1500] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-0 md:p-6 overflow-hidden">
      <div className="bg-white w-full max-w-4xl h-full md:h-auto md:max-h-[92vh] md:rounded-3xl shadow-2xl flex flex-col animate-in fade-in duration-300">
        
        <div className={`p-6 md:p-8 flex items-center justify-between border-b shrink-0 ${isBlacklisted ? 'bg-red-50/50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
          <div className="flex items-center gap-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-lg ${isBlacklisted ? 'bg-red-600' : 'bg-primary'}`}>
              {guard.full_name[0]}
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">{guard.full_name}</h2>
              <div className="flex items-center gap-3 mt-2">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${isBlacklisted ? 'bg-red-600 text-white border-red-600' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                  {guard.application_status.replace('_', ' ')}
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">ID: {guard.id.slice(0, 8)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Last Audit</span>
              <span className="text-[10px] font-bold text-slate-600 uppercase mt-1">{new Date(guard.updated_at || guard.created_at).toLocaleDateString()}</span>
            </div>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-full transition-all border border-slate-100">✕</button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar p-6 md:p-10 bg-white">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            <div className="lg:col-span-7 space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Performance</p>
                  <p className={`text-2xl font-black font-hud ${guard.performance_score! < 40 ? 'text-red-600' : 'text-slate-900'}`}>{guard.performance_score ?? 100}%</p>
                </div>
                {!isBlacklisted && guard.application_status !== ApplicationStatus.ACTIVE && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Completion</p>
                    <p className="text-2xl font-black font-hud text-primary">{guard.profile_score}%</p>
                  </div>
                )}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Audit Trail</p>
                  <p className="text-[10px] font-black text-slate-700 uppercase mt-2 truncate">Ver: 2.1-TS</p>
                </div>
              </div>

              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-3">
                    Personal Details
                    <div className="h-px w-24 bg-slate-100" />
                  </h3>
                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Dossier-v4.1</span>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 px-6 divide-y divide-slate-50">
                  <InfoRow label="NIDA Number" value={guard.nida_number} mono />
                  <InfoRow label="Phone Number" value={guard.phone} redacted={isBlacklisted} mono />
                  <InfoRow label="Date of Birth" value={guard.dob} redacted={isBlacklisted} />
                  <InfoRow label="Age" value={isBlacklisted ? 'HIDDEN' : `${age} Years`} />
                  <InfoRow label="Armed Status" value={guard.is_armed ? 'Armed' : 'Unarmed'} />
                </div>
              </section>

              <section>
                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                  Contact Information
                  <div className="h-px flex-grow bg-slate-100" />
                </h3>
                <div className="bg-white rounded-2xl border border-slate-100 px-6 divide-y divide-slate-50">
                  {guard.guarantors?.map((g, i) => (
                    <React.Fragment key={g.id}>
                      <InfoRow label={`Guarantor #${i+1} Name`} value={g.name} redacted={isBlacklisted} />
                      <InfoRow label={`Guarantor #${i+1} Phone`} value={g.phone} redacted={isBlacklisted} mono />
                    </React.Fragment>
                  ))}
                   <InfoRow label="Next of Kin Name" value={guard.next_of_kin_name} redacted={isBlacklisted} />
                  <InfoRow label="Next of Kin Phone" value={guard.next_of_kin_phone} redacted={isBlacklisted} mono />
                </div>
              </section>
            </div>

            <div className="lg:col-span-5 space-y-8">
              <section>
                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                  Uploaded Documents
                  <div className="h-px flex-grow bg-slate-100" />
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  <DocumentLink label="NIDA Document" url={guard.nida_front_url} onView={setExpandedArtifact} />
                  <DocumentLink label="Birth Certificate" url={guard.birth_cert_url} redacted={isBlacklisted} onView={setExpandedArtifact} />
                  <DocumentLink label="Residence Letter" url={guard.residence_letter_url} redacted={isBlacklisted} onView={setExpandedArtifact} />
                  <DocumentLink label="Employment Contract" url={guard.employment_contract_url} redacted={isBlacklisted} onView={setExpandedArtifact} />
                </div>
              </section>

              <section>
                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                  Incident History
                  <div className="h-px flex-grow bg-slate-100" />
                </h3>
                <div className="space-y-4">
                  {guardIncidents.length > 0 ? (
                    guardIncidents.map((inc, idx) => (
                      <div key={inc.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-primary/20 transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <span className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest">{inc.code}</span>
                          <span className="text-[9px] font-mono text-slate-500 font-bold">
                            {new Date(inc.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                        
                        <p className="text-[11px] text-slate-600 font-medium leading-relaxed italic mb-4">"{inc.notes}"</p>
                        
                        {inc.evidence_url && (
                          <div className="mb-4">
                            <button 
                              onClick={() => setExpandedArtifact(inc.evidence_url)}
                              className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-200 group/img active:scale-[0.98] transition-all"
                            >
                              <img src={inc.evidence_url} className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500" alt="Evidence" />
                              <div className="absolute inset-0 bg-black/20 group-hover/img:bg-black/0 transition-colors" />
                              <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md shadow-sm border border-slate-100 opacity-0 group-hover/img:opacity-100 transition-opacity">
                                <span className="text-[8px] font-black text-primary uppercase tracking-widest">View Full Image</span>
                              </div>
                            </button>
                          </div>
                        )}

                        <div className="pt-3 border-t border-slate-200/50 flex flex-wrap items-center justify-between gap-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                          <div className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            <span>By: {inc.reported_by}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                            <span>Site: {inc.site_name || 'Ops'}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/30">
                      <p className="text-slate-300 font-bold uppercase tracking-widest text-[9px]">No incidents found</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:bg-black transition-all active:scale-95 shadow-lg shadow-slate-200"
          >
            Close Disclosure
          </button>
        </div>
      </div>

      {expandedArtifact && (
        <div className="fixed inset-0 z-[2000] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-12 animate-in zoom-in-95 duration-200" onClick={() => setExpandedArtifact(null)}>
          <button onClick={() => setExpandedArtifact(null)} className="absolute top-8 right-8 text-white/60 hover:text-white transition-colors p-4 z-20">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {
              !expandedArtifact.startsWith('data:application/pdf') && !expandedArtifact.split('?')[0].toLowerCase().endsWith('.pdf')
            ? (
              <img 
                src={expandedArtifact} 
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/10" 
                alt="Full size artifact" 
              />
            ) : (
              <iframe
                src={expandedArtifact}
                className="w-full h-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-white/10"
                title="File Viewer"
              />
            )}
          </div>
          <div className="absolute bottom-12 left-0 right-0 text-center pointer-events-none">
            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">Artifact Viewer</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ForensicDisclosure;
