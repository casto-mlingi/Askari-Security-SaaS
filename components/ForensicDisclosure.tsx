import React, { useMemo, useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, ShieldAlert, FileText, UserCircle, Briefcase, BookOpen, AlertTriangle } from 'lucide-react';
import { Guard, IncidentReport, DisciplinaryCode, Profile } from '../types';
import { getPerfCategory } from '../utils/performance';
import DocumentViewerDialog from './DocumentViewerDialog';

interface ForensicDisclosureProps {
  guard: Guard;
  incidents: IncidentReport[];
  disciplinaryCodes: DisciplinaryCode[];
  onClose: () => void;
  onTerminate?: () => void;
  currentUser?: Profile | null;
}

const ForensicDisclosure: React.FC<ForensicDisclosureProps> = ({ guard, incidents, disciplinaryCodes, onClose, onTerminate, currentUser }) => {
  const isInitiallyBlacklisted = (() => {
    const score = typeof guard.performance_score === 'number' ? guard.performance_score : undefined;
    const status = String((guard as any)?.status || '').toLowerCase();
    return (typeof score === 'number' && score <= 5) || status === 'blacklisted' || status === 'blacklist';
  })();
  const [activeTab, setActiveTab] = useState<'forensic' | 'incident'>(isInitiallyBlacklisted ? 'incident' : 'forensic');
  const [isTerminating, setIsTerminating] = useState(false);
  const [terminationReason, setTerminationReason] = useState('');
  const [isProcessingTermination, setIsProcessingTermination] = useState(false);

  const guardIncidents = useMemo(
    () => incidents.filter(i => i.guard_id === guard.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [incidents, guard.id]
  );

  const [viewer, setViewer] = useState<{ isOpen: boolean; url: string; title: string }>({
    isOpen: false,
    url: '',
    title: ''
  });

  const openViewer = (url: string, title: string) => {
    // Database contains ONLY filenames. Hardcode the prefix.
    const fullUrl = `https://api.amini.co.tz/uploads/${url}`;
    setViewer({ isOpen: true, url: fullUrl, title });
  };

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
      // Use currentUser prop if provided, otherwise fallback to localStorage
      let u = currentUser;
      if (!u) {
        const raw = localStorage.getItem('amini_user') || '';
        if (raw) u = JSON.parse(raw);
      }

      if (!u) return false;
      const role = String(u?.role || '').toLowerCase();
      const myCompanyId = String(u?.company_id || '');

      // Super admins and system HR always have access
      if (role === 'super_admin' || role === 'system_hr') return true;

      // Check if it's the guard's own profile
      const isSelfApplicant = role === 'applicant' && String(u?.id || '') === String(guard.id);
      if (isSelfApplicant) return true;

      // Check for same company access: company_admin, company_hr, hr_officer, supervisor, hr
      const isSameCompany = myCompanyId && guard.company_id && String(myCompanyId) === String(guard.company_id);
      const privilegedRoles = ['company_admin', 'company_hr', 'hr_officer', 'supervisor', 'hr'];
      if (privilegedRoles.includes(role) && isSameCompany) return true;

      // If the guard is neutral (no company_id), allow certain roles to view (initial vetting)
      if (!guard.company_id && privilegedRoles.includes(role)) return true;

      return false;
    } catch { return false; }
  }, [guard.company_id, guard.id]);

  const countFromGuardArr = Array.isArray((guard as any)?.incidents) ? ((guard as any).incidents.length || 0) : 0;
  const countFromProp = incidents.filter(i => i.guard_id === guard.id).length;
  const countFromIncidentCount = typeof (guard as any)?.incident_count === 'number' ? (guard as any).incident_count : 0;
  const incidentCount = Math.max(countFromGuardArr, countFromProp, countFromIncidentCount);

  const handleTerminateSubmit = async () => {
    if (!terminationReason.trim()) return;
    setIsProcessingTermination(true);
    try {
      const { api } = await import('../services/api');
      const res = await api.post(`/guards/${guard.id}/terminate`, { reason: terminationReason });

      if (res.error) {
        (window as any).showNotification?.('error', String(res.error));
        return;
      }

      setIsTerminating(false);
      setTerminationReason('');
      (window as any).showNotification?.('success', 'Mkataba umesitishwa kwa ufanisi.');
      onTerminate?.();
    } catch (err) {
      console.error('Termination failed:', err);
      (window as any).showNotification?.('error', 'Kushindwa kusitisha mkataba. Tafadhali jaribu tena.');
    } finally {
      setIsProcessingTermination(false);
    }
  };

  return (
    <Transition appear show={true} as={Fragment}>
      <Dialog as="div" className="relative z-[9999] font-sans" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-[#0A192F]/80 backdrop-blur-sm" aria-hidden="true" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-2xl bg-[#F8FAFC] text-left align-middle shadow-2xl transition-all">

                {/* Header Section */}
                <div className="bg-[#0A192F] p-6 text-white relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded bg-white/20 flex items-center justify-center font-black">A</div>
                      <span className="text-xs font-bold uppercase tracking-widest text-white">Askari Security Ecosystem</span>
                    </div>
                    <Dialog.Title as="h2" className="text-3xl font-black uppercase tracking-tight text-white">
                      {guard.full_name}
                    </Dialog.Title>
                    <p className="text-xs font-mono font-medium text-white/70 mt-1 tracking-widest uppercase">
                      NIDA: {guard.nida_number || 'NOT DISCLOSED'}
                    </p>
                    <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mt-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Forensic System Snapshot: {new Date().toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={onClose}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors focus:outline-none"
                      aria-label="Close dialog"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="bg-[#0A192F] border-t border-white/10 px-6 sm:px-8 flex gap-6">
                  <button
                    onClick={() => setActiveTab('forensic')}
                    className={`py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'forensic' ? 'border-white text-white' : 'border-transparent text-white/60 hover:text-white'
                      }`}
                  >
                    Forensic Disclosure
                  </button>
                  <button
                    onClick={() => setActiveTab('incident')}
                    className={`py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'incident' ? 'border-white text-white' : 'border-transparent text-white/60 hover:text-white'
                      }`}
                  >
                    Incident Report
                  </button>

                  {guard.status === 'active' && canViewDocs && (
                    <button
                      onClick={() => setIsTerminating(true)}
                      className="my-auto ml-auto px-4 py-1.5 bg-red-600 text-white font-black text-[9px] uppercase tracking-widest rounded-lg hover:bg-red-700 transition-all shadow-lg active:scale-95 flex items-center gap-2 border border-red-500/50"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      Terminate Contract
                    </button>
                  )}
                </div>

                {/* Content Body */}
                <div className="p-6 sm:p-8">
                  {activeTab === 'forensic' && (
                    <div className="space-y-8 animate-in fade-in duration-300">

                      {/* High Contrast Status Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-6 bg-[#0A192F] rounded-xl shadow-md border border-white/20">
                          <div className="flex items-center gap-2 mb-3 text-white">
                            <ShieldAlert className="w-4 h-4" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-white">Performance</p>
                          </div>
                          <p className="text-4xl font-black text-white">{guard.performance_score ?? 0}%</p>
                          <p className="text-[11px] font-bold text-white uppercase tracking-widest mt-1 opacity-80">{perf.label}</p>
                        </div>

                        <div className="p-6 bg-[#0A192F] rounded-xl shadow-md border border-white/20">
                          <div className="flex items-center gap-2 mb-3 text-white">
                            <AlertTriangle className="w-4 h-4" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-white">Incidents</p>
                          </div>
                          <p className="text-3xl font-black text-white">{incidentCount} <span className="text-lg text-white">Reports</span></p>
                          <p className="text-[11px] font-bold text-white uppercase tracking-widest mt-1 opacity-80">Total Lifetime</p>
                        </div>

                        <div className={`p-6 rounded-xl shadow-md border ${isBlacklisted ? 'bg-red-700 border-red-800' : 'bg-[#0A192F] border-white/20'
                          }`}>
                          <div className="flex items-center gap-2 mb-3 text-white">
                            <Briefcase className="w-4 h-4" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-white">System Status</p>
                          </div>
                          <p className={`text-2xl font-black text-white uppercase break-words`}>
                            {isBlacklisted ? 'BLACKLISTED' : (!guard.company_id ? 'APPLICANT' : 'ACTIVE GUARD')}
                          </p>
                          <p className="text-[11px] font-bold text-white uppercase tracking-widest mt-1 opacity-80">Current</p>
                        </div>
                      </div>


                      {/* Personal Details */}
                      <section className="bg-white rounded-xl shadow-md border border-slate-200 p-6 md:p-8">
                        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                          <div className="p-2 bg-[#0A192F]/5 rounded-lg text-[#0A192F]">
                            <UserCircle className="w-5 h-5" />
                          </div>
                          <h3 className="text-sm font-black text-[#0A192F] uppercase tracking-[0.15em]">Personal Details</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-8 gap-x-6">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">NIDA Number</p>
                            <p className="text-sm font-semibold text-slate-800 font-mono">{guard.nida_number || 'Not Disclosed'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Phone Number</p>
                            <p className="text-sm font-semibold text-slate-800 font-mono">{guard.phone || 'Not Disclosed'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date of Birth</p>
                            <p className="text-sm font-semibold text-slate-800">{guard.dob || 'Not Disclosed'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Age</p>
                            <p className="text-sm font-semibold text-slate-800">{typeof age === 'number' ? `${age} Years` : 'Not Disclosed'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Shift</p>
                            <p className="text-sm font-semibold text-slate-800">{guard.current_shift?.toUpperCase() || 'NOT_ASSIGNED'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Armed Status</p>
                            <p className="text-sm font-semibold text-slate-800">{guard.is_armed ? 'Armed' : 'Unarmed'}</p>
                          </div>
                        </div>
                      </section>

                      {/* Dossier & Guarantors */}
                      <section className="bg-white rounded-xl shadow-md border border-slate-200 p-6 md:p-8">
                        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                          <div className="p-2 bg-[#0A192F]/5 rounded-lg text-[#0A192F]">
                            <Briefcase className="w-5 h-5" />
                          </div>
                          <h3 className="text-sm font-black text-[#0A192F] uppercase tracking-[0.15em]">Dossier</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-6 mb-8">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Physical Address</p>
                            <p className="text-sm font-semibold text-slate-800">{guard.physical_address || (guard as any)?.dossier_data?.physical_address || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Emergency Contact</p>
                            <p className="text-sm font-semibold text-slate-800">{guard.emergency_contact || (guard as any)?.dossier_data?.emergency_contact || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Shirt Size</p>
                            <p className="text-sm font-semibold text-slate-800">{guard.uniform_shirt_size || (guard as any)?.dossier_data?.uniform_shirt_size || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Boot Size</p>
                            <p className="text-sm font-semibold text-slate-800">{guard.uniform_boot_size || (guard as any)?.dossier_data?.uniform_boot_size || 'N/A'}</p>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                          <p className="text-xs font-black text-slate-600 uppercase tracking-[0.15em] mb-4">Guarantors</p>
                          {Array.isArray(guard.guarantors) && guard.guarantors.length > 0 ? (
                            <div className="space-y-6">
                              {guard.guarantors.map((g, i) => (
                                <div key={g.id} className="grid grid-cols-1 sm:grid-cols-3 gap-6 pb-6 border-b border-slate-200 last:border-0 last:pb-0">
                                  <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{`Guarantor #${i + 1} Name`}</p>
                                    <p className="text-sm font-semibold text-slate-800">{g.name}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{`Phone Number`}</p>
                                    <p className="text-sm font-semibold text-slate-800 font-mono">{g.phone}</p>
                                  </div>
                                  {(g as any)?.occupation && (
                                    <div>
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{`Occupation`}</p>
                                      <p className="text-sm font-semibold text-slate-800">{(g as any).occupation}</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs font-medium text-slate-400 italic">No guarantors listed.</p>
                          )}
                        </div>

                        {/* Next of Kin */}
                        <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Next of Kin Name</p>
                            <p className="text-sm font-semibold text-slate-800">{guard.next_of_kin_name || 'Not Disclosed'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Next of Kin Phone</p>
                            <p className="text-sm font-semibold text-slate-800 font-mono">{guard.next_of_kin_phone || 'Not Disclosed'}</p>
                          </div>
                        </div>
                      </section>

                      {/* Education & Contacts */}
                      <section className="bg-white rounded-xl shadow-md border border-slate-200 p-6 md:p-8">
                        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                          <div className="p-2 bg-[#0A192F]/5 rounded-lg text-[#0A192F]">
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <h3 className="text-sm font-black text-[#0A192F] uppercase tracking-[0.15em]">Education</h3>
                        </div>

                        {Array.isArray(guard.education_history) && guard.education_history.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {guard.education_history.map(edu => (
                              <div key={edu.id} className="p-5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-bold text-slate-800 uppercase tracking-tight">{edu.level?.replace('_', ' ')}</p>
                                  <p className="text-xs font-medium text-slate-500 mt-1">Completed: <span className="text-slate-700 font-bold">{edu.year}</span></p>
                                </div>
                                {edu.weapon_proficiency === 'pass' && (
                                  <span className="text-[10px] font-bold bg-[#0A192F] text-white px-2.5 py-1 rounded-md uppercase tracking-wider">Armed Certified</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs font-medium text-slate-400 italic">No education history found.</p>
                        )}
                      </section>

                      {/* Work History */}
                      <section className="bg-white rounded-xl shadow-md border border-slate-200 p-6 md:p-8">
                        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                          <div className="p-2 bg-[#0A192F]/5 rounded-lg text-[#0A192F]">
                            <Briefcase className="w-5 h-5" />
                          </div>
                          <h3 className="text-sm font-black text-[#0A192F] uppercase tracking-[0.15em]">Work History</h3>
                        </div>

                        {Array.isArray(guard.work_history) && guard.work_history.length > 0 ? (
                          <div className="space-y-4">
                            {guard.work_history.map(wh => (
                              <div key={wh.id} className="p-5 bg-slate-50 border border-slate-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                  <p className="text-sm font-bold text-slate-800 uppercase tracking-tight">{wh.company_name}</p>
                                  <p className="text-xs font-medium text-slate-500 mt-1">{wh.role} • <span className="text-slate-700 font-bold">{wh.start_date || '—'} – {wh.end_date || 'Present'}</span></p>
                                </div>
                                {wh.recommendation_letter_url && (
                                  <button
                                    onClick={() => openViewer(wh.recommendation_letter_url!, `Rec. Letter: ${wh.company_name}`)}
                                    className="text-xs font-bold text-[#0A192F] uppercase tracking-widest hover:underline"
                                  >
                                    View Letter
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs font-medium text-slate-400 italic">No previous work history found.</p>
                        )}
                      </section>

                      {/* Documents Section */}
                      <section className="bg-white rounded-xl shadow-md border border-slate-200 p-6 md:p-8">
                        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                          <div className="p-2 bg-[#0A192F]/5 rounded-lg text-[#0A192F]">
                            <FileText className="w-5 h-5" />
                          </div>
                          <h3 className="text-sm font-black text-[#0A192F] uppercase tracking-[0.15em]">Documents</h3>
                        </div>

                        {canViewDocs ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[
                              { label: 'NIDA Document', url: guard.nida_front_url },
                              { label: 'Application Letter', url: guard.application_letter_url },
                              { label: 'Birth Certificate', url: guard.birth_cert_url },
                              { label: 'Residence Letter', url: guard.residence_letter_url },
                              { label: 'Medical Report', url: guard.medical_report_url },
                              { label: 'Police Clearance', url: guard.police_clearance_url },
                              { label: 'Curriculum Vitae', url: guard.cv_url },
                              { label: 'Passport Photo', url: guard.passport_photo_url },
                              { label: 'Employment Contract', url: guard.employment_contract_url },
                            ].map((doc, idx) => doc.url && (
                              <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors">
                                <span className="text-xs font-bold text-slate-700 uppercase truncate pr-4">{doc.label}</span>
                                <button
                                  onClick={() => openViewer(doc.url!, doc.label)}
                                  className="text-xs font-bold text-[#0A192F] uppercase tracking-widest hover:underline whitespace-nowrap"
                                >
                                  View
                                </button>
                              </div>
                            ))}

                            {guard.guarantors?.map((g, i) => (
                              <Fragment key={g.id}>
                                {((g as any).guarantor_letter_url || (g as any).letter_url) && (
                                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors">
                                    <span className="text-xs font-bold text-slate-700 uppercase truncate pr-4">{`Guarantor #${i + 1} Letter`}</span>
                                    <button
                                      onClick={() => openViewer(((g as any).guarantor_letter_url || (g as any).letter_url), `Guarantor #${i + 1} Letter`)}
                                      className="text-xs font-bold text-[#0A192F] uppercase tracking-widest hover:underline whitespace-nowrap"
                                    >
                                      View
                                    </button>
                                  </div>
                                )}
                                {(g as any).id_copy_url && (
                                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors">
                                    <span className="text-xs font-bold text-slate-700 uppercase truncate pr-4">{`Guarantor #${i + 1} ID Copy`}</span>
                                    <button
                                      onClick={() => openViewer((g as any).id_copy_url, `Guarantor #${i + 1} ID Copy`)}
                                      className="text-xs font-bold text-[#0A192F] uppercase tracking-widest hover:underline whitespace-nowrap"
                                    >
                                      View
                                    </button>
                                  </div>
                                )}
                                {(g as any).residence_letter_url && (
                                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors">
                                    <span className="text-xs font-bold text-slate-700 uppercase truncate pr-4">{`Guarantor #${i + 1} Residence`}</span>
                                    <button
                                      onClick={() => openViewer((g as any).residence_letter_url, `Guarantor #${i + 1} Residence Letter`)}
                                      className="text-xs font-bold text-[#0A192F] uppercase tracking-widest hover:underline whitespace-nowrap"
                                    >
                                      View
                                    </button>
                                  </div>
                                )}
                              </Fragment>
                            ))}

                            {guard.education_history?.map((edu) => edu.certificate_url && (
                              <div key={edu.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors">
                                <span className="text-xs font-bold text-slate-700 uppercase truncate pr-4">{`${edu.level?.replace('_', ' ')} Cert`}</span>
                                <button
                                  onClick={() => openViewer(edu.certificate_url!, `${edu.level?.replace('_', ' ')} Cert`)}
                                  className="text-xs font-bold text-[#0A192F] uppercase tracking-widest hover:underline whitespace-nowrap"
                                >
                                  View
                                </button>
                              </div>
                            ))}

                            {guard.work_history?.map((wh) => wh.recommendation_letter_url && (
                              <div key={wh.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors">
                                <span className="text-xs font-bold text-slate-700 uppercase truncate pr-4">{`Rec. Letter: ${wh.company_name}`}</span>
                                <button
                                  onClick={() => openViewer(wh.recommendation_letter_url!, `Rec. Letter: ${wh.company_name}`)}
                                  className="text-xs font-bold text-[#0A192F] uppercase tracking-widest hover:underline whitespace-nowrap"
                                >
                                  View
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-12 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center text-center">
                            <ShieldAlert className="w-12 h-12 text-slate-300 mb-4" />
                            <p className="text-slate-900 text-sm font-black uppercase tracking-widest mb-2">
                              Access Restricted
                            </p>
                            <p className="text-slate-500 text-xs font-bold max-w-sm">
                              You do not have permission to view sensitive documents for this guard.
                              Only authorized company personnel or system administrators can access these records.
                            </p>
                          </div>
                        )}
                      </section>

                    </div>
                  )}

                  {activeTab === 'incident' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <h3 className="text-sm font-black text-[#0A192F] uppercase tracking-[0.15em] mb-6">Incident History</h3>
                      {guardIncidents.map(i => {
                        const code = disciplinaryCodes.find(c => c.code === (i.incident_code || i.code));
                        return (
                          <div key={i.id} className="p-6 bg-white rounded-xl shadow-md border border-slate-200">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                              <div className="flex-1">
                                <p className="text-sm font-black text-slate-900 uppercase">{code?.label || i.incident_code || (i as any).code}</p>
                                <p className="text-sm font-medium text-slate-600 mt-2 leading-relaxed">
                                  {(i as any).formal_report || (i as any).notes || (i as any).title || 'No narrative provided.'}
                                </p>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-4 flex items-center gap-2">
                                  <AlertTriangle className="w-3 h-3" />
                                  {new Date(i.created_at).toLocaleString()}
                                </p>
                              </div>
                              <span className="text-sm font-black bg-red-600 text-white px-3 py-1.5 rounded-lg whitespace-nowrap shadow-sm">
                                -{(i as any).penalty_points || 0} POINTS
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {guardIncidents.length === 0 && (
                        <div className="p-12 bg-white rounded-xl shadow-md border border-slate-200 text-center">
                          <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">No incidents recorded.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-8 pt-6 border-t border-slate-200 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Forensic System Snapshot: {new Date().toLocaleString()}
                    </p>
                  </div>
                </div>

                <DocumentViewerDialog
                  isOpen={viewer.isOpen}
                  onClose={() => setViewer(prev => ({ ...prev, isOpen: false }))}
                  url={viewer.url}
                  title={viewer.title}
                />

                {/* Termination Confirmation Overlay */}
                {isTerminating && (
                  <div className="fixed inset-0 z-[10001] bg-[#0A192F]/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 md:p-10 animate-in zoom-in duration-300">
                      <div className="flex items-center gap-4 mb-8 text-red-600">
                        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
                          <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 leading-tight">Confirm<br />Termination</h3>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8">
                        <p className="text-sm font-medium text-slate-600 leading-relaxed">
                          You are about to terminate <strong className="text-slate-900">{guard.full_name}</strong>. This will:
                        </p>
                        <ul className="mt-3 space-y-2">
                          <li className="flex items-start gap-2 text-xs font-bold text-slate-500 uppercase tracking-tight">
                            <span className="text-red-500">•</span> Return guard to marketplace
                          </li>
                          <li className="flex items-start gap-2 text-xs font-bold text-slate-500 uppercase tracking-tight">
                            <span className="text-red-500">•</span> Clear current site assignment
                          </li>
                          <li className="flex items-start gap-2 text-xs font-bold text-slate-500 uppercase tracking-tight">
                            <span className="text-red-500">•</span> Preserve all historical performance
                          </li>
                        </ul>
                      </div>

                      <div className="space-y-3 mb-10">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason for Termination</label>
                        <textarea
                          value={terminationReason}
                          onChange={e => setTerminationReason(e.target.value)}
                          className="w-full h-32 p-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 text-sm font-medium transition-all"
                          placeholder="E.g. Resignation, Project completion, Disciplinary issues..."
                        />
                      </div>

                      <div className="flex flex-col gap-3">
                        <button
                          onClick={handleTerminateSubmit}
                          disabled={!terminationReason.trim() || isProcessingTermination}
                          className="w-full py-4 bg-red-600 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl hover:bg-red-700 transition-all shadow-xl shadow-red-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isProcessingTermination ? 'Processing Termination...' : 'Confirm Termination'}
                        </button>
                        <button
                          onClick={() => { setIsTerminating(false); setTerminationReason(''); }}
                          disabled={isProcessingTermination}
                          className="w-full py-4 bg-white border border-slate-200 text-slate-400 font-black text-[11px] uppercase tracking-widest rounded-2xl hover:bg-slate-50 transition-all active:scale-95"
                        >
                          Cancel Process
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition >
  );
};

export default ForensicDisclosure;
