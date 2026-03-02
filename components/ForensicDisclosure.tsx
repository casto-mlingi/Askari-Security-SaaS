import React, { useMemo, useState } from 'react';
import { Guard, IncidentReport, DisciplinaryCode } from '../types';
import { getPerfCategory } from '../utils/performance';

interface ForensicDisclosureProps {
  guard: Guard;
  incidents: IncidentReport[];
  disciplinaryCodes: DisciplinaryCode[];
  onClose: () => void;
}

const ForensicDisclosure: React.FC<ForensicDisclosureProps> = ({ guard, incidents, disciplinaryCodes }) => {
  const isInitiallyBlacklisted = (() => {
    const score = typeof guard.performance_score === 'number' ? guard.performance_score : undefined;
    const status = String((guard as any)?.status || '').toLowerCase();
    return (typeof score === 'number' && score <= 5) || status === 'blacklisted' || status === 'blacklist';
  })();
  const [activeTab, setActiveTab] = useState<'forensic' | 'incident'>(isInitiallyBlacklisted ? 'incident' : 'forensic');
  const guardIncidents = useMemo(
    () => incidents.filter(i => i.guard_id === guard.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [incidents, guard.id]
  );
  const perf = getPerfCategory(guard.performance_score);
  const age = useMemo(() => {
    if (!guard.dob) return null;
    const birth = new Date(guard.dob);
    const now = new Date();
    if (isNaN(birth.getTime())) return null;
    let a = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) a--;
    return a;
  }, [guard.dob]);
  const isBlacklisted = useMemo(() => {
    const score = typeof guard.performance_score === 'number' ? guard.performance_score : undefined;
    const status = String((guard as any)?.status || '').toLowerCase();
    return (typeof score === 'number' && score <= 5) || status === 'blacklisted' || status === 'blacklist';
  }, [guard.performance_score, (guard as any)?.status]);
  const canViewDocs = useMemo(() => {
    try {
      const raw = localStorage.getItem('amini_user') || '';
      if (!raw) return false;
      const u = JSON.parse(raw) || {};
      const role = String(u?.role || '').toLowerCase();
      const myCompanyId = String(u?.company_id || '');
      const isSameCompany = myCompanyId && guard.company_id && String(myCompanyId) === String(guard.company_id);
      const anasulId = 'f2ffa67e-c5fc-4cb5-a81f-7cb0074eff4b';
      const isNeutral = !guard.company_id;
      const isSelfApplicant = role === 'applicant' && String(u?.id || '') === String(guard.id);
      if (role === 'super_admin' || role === 'system_hr') return true;
      if (isNeutral || isSelfApplicant) return true;
      if ((role === 'company_admin' || role === 'hr_officer') && isSameCompany) return true;
      if (role === 'supervisor' && isSameCompany && String(guard.company_id) === anasulId) return true;
      return false;
    } catch { return false; }
  }, [guard.company_id]);

  return (
    <div className="forensic-print p-8 border-b border-slate-100 overflow-y-auto md:overflow-visible">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .forensic-print, .forensic-print * { visibility: visible !important; }
          .forensic-print { position: static !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .force-blacklisted { background-color: #b91c1c !important; border-color: #991b1b !important; color: #fff !important; }
          .anasul-logo { display: flex !important; }
          .print-footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 12px; font-size: 10px; color: #475569; text-align: right; }
        }
      `}</style>
      {(!guard.company_id) ? (
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-slate-200 text-slate-700 font-black flex items-center justify-center">N</div>
          <div className="text-sm font-black uppercase tracking-widest text-slate-600">Marketplace Applicant</div>
        </div>
      ) : (
        <div className="flex items-center gap-3 mb-4 anasul-logo">
          <div className="w-10 h-10 rounded-lg bg-red-700 text-white font-black flex items-center justify-center">A</div>
          <div className="text-sm font-black uppercase tracking-widest text-slate-700">Anasel Security Solutions</div>
        </div>
      )}
      <div className="sticky top-0 z-10 border-b border-transparent mb-6 no-print">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('forensic')}
            className={`px-4 py-3 text-[11px] font-black uppercase tracking-widest flex-1 sm:flex-none text-center rounded-xl ${activeTab === 'forensic' ? 'text-white border-b-2 border-white' : 'text-white/70'
              }`}
          >
            FORENSIC DISCLOSURE
          </button>
          <button
            onClick={() => setActiveTab('incident')}
            className={`px-4 py-3 text-[11px] font-black uppercase tracking-widest flex-1 sm:flex-none text-center rounded-xl ${activeTab === 'incident' ? 'text-white border-b-2 border-white' : 'text-white/70'
              }`}
          >
            INCIDENT REPORT
          </button>
        </div>
      </div>

      {activeTab === 'forensic' && (
        <>
          <div className="mb-6 p-4 bg-white rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">{guard.full_name}</h2>
              <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">NIDA: {(guard.nida_number || '').slice(0, 15)}{(guard.nida_number || '').length > 15 ? '...' : ''}</p>
            </div>
          </div>
          {(() => {
            const countFromGuardArr = Array.isArray((guard as any)?.incidents) ? ((guard as any).incidents.length || 0) : 0;
            const countFromProp = incidents.filter(i => i.guard_id === guard.id).length;
            const countFromIncidentCount = typeof (guard as any)?.incident_count === 'number' ? (guard as any).incident_count : 0;
            const incidentCount = Math.max(countFromGuardArr, countFromProp, countFromIncidentCount);
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 bg-blue-700 rounded-2xl border border-blue-600">
                  <p className="text-[10px] font-black text-white uppercase tracking-widest mb-2">PERFORMANCE</p>
                  <p className="text-3xl font-black font-hud text-white">{guard.performance_score ?? 0}%</p>
                  <p className="text-[10px] font-black text-white/80 uppercase tracking-widest">{perf.label}</p>
                </div>
                <div className="p-5 bg-blue-700 rounded-2xl border border-blue-600">
                  <p className="text-[10px] font-black text-white uppercase tracking-widest mb-2">INCIDENTS</p>
                  <p className="text-2xl font-black text-white font-hud">{incidentCount} Incidents</p>
                  <p className="text-[10px] font-black text-white/80 uppercase tracking-widest">Total Reported</p>
                </div>
                <div className={`p-5 rounded-2xl border ${isBlacklisted ? 'bg-red-700 border-red-600 force-blacklisted' : 'bg-blue-700 border-blue-600'}`}>
                  <p className="text-[10px] font-black text-white uppercase tracking-widest mb-2">CURRENT SYSTEM STATUS</p>
                  <p className="text-xl font-black text-white uppercase">
                    {isBlacklisted ? 'BLACKLISTED' : (!guard.company_id ? 'APPLICANT' : 'ACTIVE GUARD')}
                  </p>
                  <p className="text-[10px] font-black text-white/80 uppercase tracking-widest">Current</p>
                </div>
              </div>
            );
          })()}

          <div className="mt-8 space-y-8">
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeWidth="2.5" /></svg>
                </div>
                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Personal Details</h3>
                <div className="h-px flex-grow bg-slate-100" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">NIDA Number</p>
                  <p className="text-sm font-bold text-slate-700 font-mono">{guard.nida_number || 'Not Disclosed'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Phone Number</p>
                  <p className="text-sm font-bold text-slate-700 font-mono">{guard.phone || 'Not Disclosed'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date of Birth</p>
                  <p className="text-sm font-bold text-slate-700">{guard.dob || 'Not Disclosed'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Age</p>
                  <p className="text-sm font-bold text-slate-700">{typeof age === 'number' ? `${age} Years` : 'Not Disclosed'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Current Shift</p>
                  <p className="text-sm font-bold text-slate-700">{guard.current_shift?.toUpperCase() || 'NOT_ASSIGNED'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Armed Status</p>
                  <p className="text-sm font-bold text-slate-700">{guard.is_armed ? 'Armed' : 'Unarmed'}</p>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 7h18M3 12h18M3 17h18" strokeWidth="2.5" /></svg>
                </div>
                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Dossier</h3>
                <div className="h-px flex-grow bg-slate-100" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Physical Address</p>
                  <p className="text-sm font-bold text-slate-700">{(guard as any)?.dossier_data?.physical_address || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Emergency Contact</p>
                  <p className="text-sm font-bold text-slate-700">{(guard as any)?.dossier_data?.emergency_contact || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Shirt Size</p>
                  <p className="text-sm font-bold text-slate-700">{(guard as any)?.dossier_data?.uniform_shirt_size || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Boot Size</p>
                  <p className="text-sm font-bold text-slate-700">{(guard as any)?.dossier_data?.uniform_boot_size || 'N/A'}</p>
                </div>
              </div>
              <div className="mt-6 p-6 bg-slate-50 border border-slate-100 rounded-2xl">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Guarantors</p>
                {Array.isArray(guard.guarantors) && guard.guarantors.length > 0 ? (
                  <div className="space-y-4">
                    {guard.guarantors.map((g, i) => (
                      <div key={g.id} className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{`Guarantor #${i + 1} Name`}</p>
                          <p className="text-sm font-bold text-slate-700">{g.name}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{`Guarantor #${i + 1} Phone`}</p>
                          <p className="text-sm font-bold text-slate-700 font-mono">{g.phone}</p>
                        </div>
                        {(g as any)?.occupation && (
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{`Guarantor #${i + 1} Occupation`}</p>
                            <p className="text-sm font-bold text-slate-700">{(g as any).occupation}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">No guarantors listed.</p>
                )}
              </div>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" strokeWidth="2.5" /></svg>
                </div>
                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Contacts</h3>
                <div className="h-px flex-grow bg-slate-100" />
              </div>
              <div className="space-y-8">
                {guard.guarantors?.map((g, i) => (
                  <div key={g.id} className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 p-6 bg-slate-50 border border-slate-100 rounded-2xl">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{`Guarantor #${i + 1} Name`}</p>
                      <p className="text-sm font-bold text-slate-700">{g.name}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{`Guarantor #${i + 1} Phone`}</p>
                      <p className="text-sm font-bold text-slate-700 font-mono">{g.phone}</p>
                    </div>
                    {(g as any)?.occupation && (
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{`Guarantor #${i + 1} Occupation`}</p>
                        <p className="text-sm font-bold text-slate-700">{(g as any).occupation}</p>
                      </div>
                    )}
                  </div>
                ))}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 pt-8 border-t border-slate-100">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Next of Kin Name</p>
                    <p className="text-sm font-bold text-slate-700">{guard.next_of_kin_name || 'Not Disclosed'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Next of Kin Phone</p>
                    <p className="text-sm font-bold text-slate-700 font-mono">{guard.next_of_kin_phone || 'Not Disclosed'}</p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 14l9-5-9-5-9 5 9 5z" strokeWidth="2.5" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" strokeWidth="2.5" /></svg>
                </div>
                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Education</h3>
                <div className="h-px flex-grow bg-slate-100" />
              </div>
              <div className="space-y-4">
                {Array.isArray(guard.education_history) && guard.education_history.length > 0 ? (
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

            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
                </div>
                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Documents</h3>
                <div className="h-px flex-grow bg-slate-100" />
              </div>
              {canViewDocs ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {guard.nida_front_url && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
                        <span className="text-[10px] font-bold text-slate-600 uppercase truncate">NIDA Document</span>
                      </div>
                      <a href={guard.nida_front_url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View File</a>
                    </div>
                  )}
                  {guard.application_letter_url && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
                        <span className="text-[10px] font-bold text-slate-600 uppercase truncate">Application Letter</span>
                      </div>
                      <a href={guard.application_letter_url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View File</a>
                    </div>
                  )}
                  {guard.birth_cert_url && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
                        <span className="text-[10px] font-bold text-slate-600 uppercase truncate">Birth Certificate</span>
                      </div>
                      <a href={guard.birth_cert_url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View File</a>
                    </div>
                  )}
                  {guard.residence_letter_url && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
                        <span className="text-[10px] font-bold text-slate-600 uppercase truncate">Residence Letter</span>
                      </div>
                      <a href={guard.residence_letter_url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View File</a>
                    </div>
                  )}
                  {guard.medical_report_url && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
                        <span className="text-[10px] font-bold text-slate-600 uppercase truncate">Medical Report</span>
                      </div>
                      <a href={guard.medical_report_url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View File</a>
                    </div>
                  )}
                  {guard.police_clearance_url && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
                        <span className="text-[10px] font-bold text-slate-600 uppercase truncate">Police Clearance</span>
                      </div>
                      <a href={guard.police_clearance_url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View File</a>
                    </div>
                  )}
                  {guard.cv_url && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
                        <span className="text-[10px] font-bold text-slate-600 uppercase truncate">Curriculum Vitae</span>
                      </div>
                      <a href={guard.cv_url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View File</a>
                    </div>
                  )}
                  {guard.passport_photo_url && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
                        <span className="text-[10px] font-bold text-slate-600 uppercase truncate">Passport Photo</span>
                      </div>
                      <a href={guard.passport_photo_url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View File</a>
                    </div>
                  )}
                  {guard.employment_contract_url && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
                        <span className="text-[10px] font-bold text-slate-600 uppercase truncate">Employment Contract</span>
                      </div>
                      <a href={guard.employment_contract_url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View File</a>
                    </div>
                  )}
                  {guard.guarantors?.map((g, i) => (
                    <React.Fragment key={g.id}>
                      {((g as any).guarantor_letter_url || (g as any).letter_url) && (
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-3">
                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
                            <span className="text-[10px] font-bold text-slate-600 uppercase truncate">{`Guarantor #${i + 1} Letter`}</span>
                          </div>
                          <a href={(g as any).guarantor_letter_url || (g as any).letter_url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View File</a>
                        </div>
                      )}
                      {(g as any).id_copy_url && (
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-3">
                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
                            <span className="text-[10px] font-bold text-slate-600 uppercase truncate">{`Guarantor #${i + 1} ID Copy`}</span>
                          </div>
                          <a href={(g as any).id_copy_url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View File</a>
                        </div>
                      )}
                      {(g as any).residence_letter_url && (
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-3">
                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
                            <span className="text-[10px] font-bold text-slate-600 uppercase truncate">{`Guarantor #${i + 1} Residence Letter`}</span>
                          </div>
                          <a href={(g as any).residence_letter_url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View File</a>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                  {guard.education_history?.map(edu => (
                    edu.certificate_url ? (
                      <div key={edu.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-3">
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z" /></svg>
                          <span className="text-[10px] font-bold text-slate-600 uppercase truncate">{`${edu.level?.replace('_', ' ')} Cert (${edu.year})`}</span>
                        </div>
                        <a href={edu.certificate_url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View File</a>
                      </div>
                    ) : null
                  ))}
                </div>
              ) : (
                <div className="p-4 md:p-5 bg-amber-50 border border-amber-200 rounded-2xl">
                  <p className="text-amber-700 text-[10px] md:text-xs font-black uppercase tracking-widest text-center md:text-left">
                    Login as Supervisor to view sensitive documents.
                  </p>
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {activeTab === 'incident' && (
        <div className="mt-6 space-y-3">
          <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Incidents</p>
          {guardIncidents.map(i => {
            const code = disciplinaryCodes.find(c => c.code === i.code);
            return (
              <div key={i.id} className="p-4 bg-slate-800 rounded-xl border border-slate-700 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-black uppercase">{code?.label || i.code}</p>
                    <p className="text-[11px] font-medium text-white/90 mt-1">{i.notes || i.title || 'No narrative provided.'}</p>
                    <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-2">{new Date(i.created_at).toLocaleString()}</p>
                  </div>
                  <span className="text-[10px] font-black text-red-300 font-hud whitespace-nowrap">-{i.penalty_points || 0}</span>
                </div>
              </div>
            );
          })}
          {guardIncidents.length === 0 && <p className="text-xs text-slate-600">No incidents recorded.</p>}
        </div>
      )}
      <div className="print-footer">
        System Verified Timestamp: {new Date().toLocaleString()}
      </div>
    </div>
  );
};

export default ForensicDisclosure;
