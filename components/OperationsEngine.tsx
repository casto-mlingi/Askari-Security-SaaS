import React, { useState, useMemo } from 'react';
import { Guard, ApplicationStatus, Site, DisciplinaryCode, IncidentReport, Profile, Company } from '../types';
import FileUploader from './FileUploader';
import { analyzeIncident } from '../services/ai';

interface OperationsEngineProps {
  guards: Guard[];
  sites: Site[];
  incidents: IncidentReport[];
  onReportIncident: (guardId: string, r: Partial<IncidentReport>) => void;
  onClockIn?: (guardId: string, siteId?: string) => void;
  disciplinaryCodes: DisciplinaryCode[];
  userName?: string;
  currentUser?: Profile;
  companies?: Company[];
  profiles?: Profile[];
}

const OperationsEngine: React.FC<OperationsEngineProps> = ({ 
  guards, 
  sites, 
  incidents,
  onReportIncident, 
  disciplinaryCodes, 
  userName = 'Supervisor',
  onClockIn,
  currentUser,
  companies = [],
  profiles = [],
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGuardId, setSelectedGuardId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [panelTab, setPanelTab] = useState<'operations' | 'incidents'>('operations');
  const [detailGuard, setDetailGuard] = useState<Guard | null>(null);
  
  // Incident Form State
  const [incidentCode, setIncidentCode] = useState('');
  const [incidentNotes, setIncidentNotes] = useState(''); // Formal notes
  const [roughNotes, setRoughNotes] = useState(''); // Input for AI
  const [evidence1, setEvidence1] = useState('');
  const [evidence2, setEvidence2] = useState('');
  const [evidence3, setEvidence3] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const activeGuards = useMemo(() => {
    const base = guards.filter(g => g.application_status === ApplicationStatus.ACTIVE);
    if (currentUser?.role === 'supervisor') {
      const allowedSiteIds = new Set(sites.filter(s => s.supervisor_id === currentUser.id).map(s => s.id));
      return base.filter(g => g.current_site_id && allowedSiteIds.has(g.current_site_id));
    }
    return base;
  }, [guards, sites, currentUser]);
  const incidentByGuard = useMemo(() => {
    return activeGuards.map(g => {
      const items = incidents.filter(i => i.guard_id === g.id);
      const points = items.reduce((acc, i) => {
        const code = disciplinaryCodes.find(c => c.code === i.code);
        return acc + (code?.points || 0);
      }, 0);
      return { guard: g, count: items.length, points };
    });
  }, [incidents, activeGuards, disciplinaryCodes]);

  const handleAnalyze = async () => {
    if (!roughNotes) return;
    setIsAnalyzing(true);
    const result = await analyzeIncident(roughNotes, disciplinaryCodes.map(c => c.code));
    
    if (result) {
        setIncidentCode(result.recommended_code);
        setIncidentNotes(result.formal_notes);
    }
    setIsAnalyzing(false);
  };

  const handleSubmit = async () => {
    const evidences = [evidence1, evidence2, evidence3].filter(Boolean);
    if (!selectedGuardId || !incidentCode || !incidentNotes || evidences.length === 0) {
      alert("Please complete all required fields.");
      return;
    }
    setIsSyncing(true);
    
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 1000));

    const siteName = sites.find(s => s.id === selectedSiteId)?.name;

    onReportIncident(selectedGuardId, {
        code: incidentCode,
        notes: incidentNotes,
        evidence_url: evidences[0],
        evidence_urls: evidences,
        site_id: selectedSiteId,
        site_name: siteName,
        reported_by: userName
    });

    setIsSyncing(false);
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setSelectedGuardId('');
    setIncidentCode('');
    setIncidentNotes('');
    setRoughNotes('');
    setEvidence1('');
    setEvidence2('');
    setEvidence3('');
    setSelectedSiteId('');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-24 animate-in fade-in duration-500">
      <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-10">
        <div>
           <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Field Operations</h2>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-4">Incident Reporting & Tactical Response</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setViewMode('grid')}
            className={`w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center ${viewMode === 'grid' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500'}`}
          >
            ▦
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center ${viewMode === 'list' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500'}`}
          >
            ☰
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-10 py-5 bg-red-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-2xl hover:bg-red-700 transition-all active:scale-95 flex items-center gap-3 shadow-red-600/20"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Report Incident
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-2">
        <button onClick={() => setPanelTab('operations')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${panelTab === 'operations' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>Operations</button>
        <button onClick={() => setPanelTab('incidents')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${panelTab === 'incidents' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>Incidences</button>
      </div>

      {panelTab === 'operations' && (
      <div className={`${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8' : 'space-y-4'}`}>
        {incidentByGuard.map(({ guard, count, points }) => {
          const g = guard;
          const guarantor = (g.guarantors || [])[0];
          const site = sites.find(s => s.id === g.current_site_id);
          const companyName = companies.find(c => c.id === (g.company_id || site?.company_id))?.name;
          const supervisorProfile = profiles.find(p => p.id === (g.assigned_supervisor_id || site?.supervisor_id));
          return (
            <div 
              key={g.id} 
              className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col gap-4 cursor-pointer"
              onClick={() => setDetailGuard(g)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {g.passport_photo_url ? (
                    <img src={g.passport_photo_url} alt={g.full_name} className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                  ) : (
                    <div className="w-12 h-12 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center font-black">{g.full_name[0]}</div>
                  )}
                  <div>
                    <h4 className="font-black text-slate-900 uppercase tracking-tight">{g.full_name}</h4>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Phone: {g.phone || 'N/A'}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Company: {companyName || 'N/A'}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Supervisor: {supervisorProfile?.full_name || 'N/A'}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Site: {site?.name || 'N/A'}</p>
                    {guarantor && (
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Guarantor: {guarantor.name} • {guarantor.phone}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-emerald-600 font-hud">{g.performance_score}%</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{count} Incidents</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button 
                  onClick={(e) => { e.stopPropagation(); onClockIn?.(g.id, g.current_site_id); }} 
                  className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700"
                >
                  Clock In
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Incidents Panel */}
      {panelTab === 'incidents' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Grouped by Guard */}
        {activeGuards.map(g => {
          const items = incidents.filter(i => i.guard_id === g.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          if (items.length === 0) return null;
          return (
            <div key={g.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {g.passport_photo_url ? (
                    <img src={g.passport_photo_url} alt={g.full_name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                  ) : (
                    <div className="w-10 h-10 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center font-black">{g.full_name[0]}</div>
                  )}
                  <div>
                    <h4 className="font-black text-slate-900 uppercase tracking-tight">{g.full_name}</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{items.length} Incidents</p>
                  </div>
                </div>
                <button onClick={() => setDetailGuard(g)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest">View Details</button>
              </div>
              <div className="space-y-3">
                {items.map(i => {
                  const code = disciplinaryCodes.find(c => c.code === i.code);
                  return (
                    <div key={i.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{code?.label}</p>
                        <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">{new Date(i.created_at).toLocaleString()}</p>
                      </div>
                      <span className="text-[10px] font-black text-red-600 font-hud">-{code?.points || 0}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Incident Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {incidents.length > 0 ? incidents.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(inc => {
             const guard = guards.find(g => g.id === inc.guard_id);
             const code = disciplinaryCodes.find(c => c.code === inc.code);
             return (
               <div key={inc.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center font-black text-lg border border-red-100">
                           -{code?.points || 0}
                        </div>
                        <div>
                           <h4 className="font-black text-slate-900 uppercase tracking-tight">{guard?.full_name || 'Unknown'}</h4>
                           <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest bg-red-50 px-2 py-0.5 rounded-md">{code?.label}</span>
                        </div>
                     </div>
                     <span className="text-[9px] font-mono font-bold text-slate-400">{new Date(inc.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-600 italic border-l-2 border-slate-100 pl-4">
                     "{inc.notes}"
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-4 border-t border-slate-50">
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Site: {inc.site_name || 'Unspecified'}</span>
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">By: {inc.reported_by}</span>
                  </div>
               </div>
             );
        }) : (
            <div className="col-span-full py-20 text-center border-4 border-dashed border-slate-100 rounded-[3rem]">
                <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No incidents recorded</p>
            </div>
        )}
      </div>


      {/* Report Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/20">
              <div className="p-8 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                 <div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">New Incident Report</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Disciplinary Action Protocol</p>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-400 hover:text-red-500 hover:border-red-100 transition-colors">✕</button>
              </div>

              <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Personnel Involved</label>
                        <select 
                            value={selectedGuardId} 
                            onChange={e => {
                                setSelectedGuardId(e.target.value);
                                // Auto-select site if guard is assigned
                                const g = guards.find(gx => gx.id === e.target.value);
                                if (g?.current_site_id) setSelectedSiteId(g.current_site_id);
                            }} 
                            className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase text-xs outline-none focus:border-primary"
                        >
                            <option value="">-- Select Guard --</option>
                            {activeGuards.map(g => <option key={g.id} value={g.id}>{g.full_name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Location</label>
                        <select 
                            value={selectedSiteId} 
                            onChange={e => setSelectedSiteId(e.target.value)} 
                            className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase text-xs outline-none focus:border-primary"
                        >
                            <option value="">-- Select Site --</option>
                            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Rough Field Notes</label>
                        <button 
                            onClick={handleAnalyze} 
                            disabled={!roughNotes || isAnalyzing}
                            className="text-[9px] font-black uppercase tracking-widest text-primary hover:text-blue-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isAnalyzing ? (
                                <span className="animate-pulse">Analyzing...</span>
                            ) : (
                                <>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="2.5"/></svg>
                                    AI Auto-Categorize
                                </>
                            )}
                        </button>
                    </div>
                    <textarea 
                        value={roughNotes}
                        onChange={e => setRoughNotes(e.target.value)}
                        placeholder="E.g. Found sleeping at 3am near the main gate. Radio was off."
                        className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-sm font-medium"
                    />
                 </div>
                 
                 <div className="space-y-6 pt-6 border-t border-slate-100">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Disciplinary Code</label>
                        <select 
                            value={incidentCode} 
                            onChange={e => setIncidentCode(e.target.value)} 
                            className={`w-full h-14 px-4 border rounded-xl font-bold uppercase text-xs outline-none transition-colors ${incidentCode ? 'bg-white border-primary text-primary' : 'bg-slate-50 border-slate-200'}`}
                        >
                            <option value="">-- Select Code --</option>
                            {disciplinaryCodes.map(c => <option key={c.code} value={c.code}>{c.code} - {c.label} ({c.points} pts)</option>)}
                        </select>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Formal Report Log</label>
                        <textarea 
                            value={incidentNotes}
                            onChange={e => setIncidentNotes(e.target.value)}
                            placeholder="Formal incident description..."
                            className="w-full h-32 p-4 bg-white border border-slate-200 rounded-xl outline-none focus:border-primary text-sm font-medium shadow-sm"
                        />
                    </div>
                 </div>

                 <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Evidence</label>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                       <FileUploader label="Item 1" fileUrl={evidence1} onUpload={setEvidence1} onRemove={() => setEvidence1('')} className="!h-24" />
                       <FileUploader label="Item 2" fileUrl={evidence2} onUpload={setEvidence2} onRemove={() => setEvidence2('')} className="!h-24" />
                       <FileUploader label="Item 3" fileUrl={evidence3} onUpload={setEvidence3} onRemove={() => setEvidence3('')} className="!h-24" />
                     </div>
                     <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest">At least one evidence item is required</p>
                 </div>

                 {selectedGuardId && (
                   <div className="space-y-2 pt-6 border-t border-slate-100">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Incidences for Selected Guard</p>
                     <div className="space-y-2">
                       {incidents.filter(i => i.guard_id === selectedGuardId).slice(0,5).map(i => {
                         const code = disciplinaryCodes.find(c => c.code === i.code);
                         return (
                           <div key={i.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                             <div>
                               <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{code?.label}</p>
                               <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">{new Date(i.created_at).toLocaleString()}</p>
                             </div>
                             <span className="text-[10px] font-black text-red-600 font-hud">-{code?.points || 0}</span>
                           </div>
                         );
                       })}
                       {incidents.filter(i => i.guard_id === selectedGuardId).length === 0 && (
                         <p className="text-xs text-slate-500">No previous incidents.</p>
                       )}
                     </div>
                   </div>
                 )}
              </div>

              <div className="p-8 border-t border-slate-100 bg-slate-50 flex gap-4">
                  <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-200 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-300 transition-all">Cancel</button>
                  <button 
                    onClick={handleSubmit} 
                    disabled={isSyncing}
                    className="flex-1 py-4 bg-red-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-red-700 transition-all shadow-xl shadow-red-200 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                     {isSyncing ? 'Submitting...' : 'Confirm Incident'}
                  </button>
              </div>
           </div>
        </div>
      )}
      {detailGuard && (
        <div className="fixed inset-0 z-[1300] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/20">
            <div className="p-8 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Guard Details</h3>
              <button onClick={() => setDetailGuard(null)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-400 hover:text-red-500 hover:border-red-100 transition-colors">✕</button>
            </div>
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-4">
                {detailGuard.passport_photo_url ? (
                  <img src={detailGuard.passport_photo_url} alt={detailGuard.full_name} className="w-14 h-14 rounded-full object-cover border border-slate-200" />
                ) : (
                  <div className="w-14 h-14 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center font-black">{detailGuard.full_name[0]}</div>
                )}
                <div>
                  <h4 className="font-black text-slate-900 uppercase tracking-tight">{detailGuard.full_name}</h4>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Phone: {detailGuard.phone || 'N/A'}</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Status: {detailGuard.application_status}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Guarantors</p>
                  {(detailGuard.guarantors || []).map(g => (
                    <div key={g.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-sm font-black text-slate-900 uppercase">{g.name}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{g.phone}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Incidents</p>
                  {incidents.filter(i => i.guard_id === detailGuard.id).map(i => {
                    const code = disciplinaryCodes.find(c => c.code === i.code);
                    return (
                      <div key={i.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-black text-slate-900 uppercase">{code?.label}</p>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{new Date(i.created_at).toLocaleString()}</p>
                        </div>
                        <span className="text-[10px] font-black text-red-600 font-hud">-{code?.points || 0}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationsEngine;
