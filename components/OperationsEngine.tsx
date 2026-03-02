import React, { useState, useMemo } from 'react';
import { Guard, Site, DisciplinaryCode, IncidentReport, Profile, Company } from '../types';
import FileUploader from './FileUploader';
import { analyzeIncident } from '../services/ai';
import { api } from '../services/api';
import ForensicDisclosure from './ForensicDisclosure';
import { getPerfCategory } from '../utils/performance';
import PerformanceCircle from './PerformanceCircle';

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
  const SEVERITY_THRESHOLDS = { critical: 30, high: 15, medium: 7 };
  const getSeverityBadgeClass = (pts: number) => {
    const p = Math.abs(pts || 0);
    if (p >= SEVERITY_THRESHOLDS.critical) return 'bg-red-100 text-red-700 border-red-200';
    if (p >= SEVERITY_THRESHOLDS.high) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (p >= SEVERITY_THRESHOLDS.medium) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  };


  const activeGuards = useMemo(() => {
    const base = guards
      .filter(g => String((g as any)?.status || '').toLowerCase() === 'active')
      .filter(g => (typeof g.performance_score === 'number' ? g.performance_score : 0) > 5);
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
        return acc + (i.points_deducted || 0);
      }, 0);
      return { guard: g, count: items.length, points };
    });
  }, [incidents, activeGuards]);

  const handleAnalyze = async () => {
    if (!roughNotes) return;
    setIsAnalyzing(true);
    const result = await analyzeIncident(roughNotes, disciplinaryCodes.map(c => ({ code: c.code, label: c.label, points: c.points })));

    if (result) {
      const data = (result && (result.recommended_code || result.formal_notes)) ? result : (result?.data || {});
      const code = String(data.recommended_code || '');
      const notes = String(data.formal_notes || roughNotes);
      setIncidentCode(code);
      setIncidentNotes(notes);
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
    try {
      let companyId = 'f2ffa67e-c5fc-4cb5-a81f-7cb0074eff4b';
      try {
        const parsed = JSON.parse(localStorage.getItem('amini_user') || 'null');
        companyId = parsed?.company_id || companyId;
      } catch { }
      const selected = disciplinaryCodes.find(c => c.code === incidentCode);
      const points = selected ? -Math.abs(selected.points || 0) : -5;
      const rn = `${roughNotes}\nEvidence: ${evidences.join(', ')}`;
      const resp = await api.post('/disciplinary/records', {
        guard_id: selectedGuardId,
        company_id: companyId,
        formal_report: incidentNotes,
        incident_code: incidentCode,
        penalty_points: points,
        rough_notes: rn
      });
      const wasBlacklisted = Boolean((resp as any)?.data && (resp as any).data.blacklisted);
      if (wasBlacklisted) {
        (window as any).showNotification?.('warning', 'Guard has been automatically blacklisted due to low performance (<= 5%).');
      }
    } catch { }

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
    <div className="max-w-7xl mx-auto space-y-10 pb-24 animate-in fade-in duration-500 px-4 sm:px-0">
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
        <div className={`${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8' : 'space-y-4'}`}>
          {incidentByGuard.map(({ guard, count, points }) => {
            const g = guard;
            const openDetail = async (gx: Guard) => {
              try {
                const res = await api.get<Guard>(`/guards/${gx.id}`);
                if ((res as any)?.data) {
                  setDetailGuard((res as any).data as Guard);
                } else {
                  setDetailGuard(gx);
                }
              } catch {
                setDetailGuard(gx);
              }
            };
            return (
              <div
                key={g.id}
                className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openDetail(g)}
              >
                <div className="flex items-center gap-4 flex-1">
                  {g.passport_photo_url ? (
                    <img src={g.passport_photo_url} alt={g.full_name} className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                  ) : (
                    <div className="w-12 h-12 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center font-black">{g.full_name?.[0] || 'G'}</div>
                  )}
                  <div>
                    <h4 className="font-black text-slate-900 uppercase tracking-tight">{g.full_name}</h4>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">NIDA: {g.nida_number?.slice(0, 10)}...</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Phone: {g.phone || 'N/A'}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Incidents: {count}</p>
                  </div>
                </div>
                <div className="self-start sm:self-auto">
                  <div className="block sm:hidden">
                    <PerformanceCircle score={g.performance_score || 0} size={48} />
                  </div>
                  <div className="hidden sm:block">
                    <PerformanceCircle score={g.performance_score || 0} size={64} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Incidents Panel */}
      {panelTab === 'incidents' && (
        <div className="space-y-4 pt-4 animate-in fade-in duration-300">
          {(incidents || []).slice(0, 50).map(inc => {
            const g = guards.find(gx => gx.id === inc.guard_id);
            if (!g) return null;
            return (
              <div key={inc.id} className="p-6 bg-white border border-slate-200 rounded-[2rem] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3M12 2a10 10 0 100 20 10 10 0 000-20z" strokeWidth="2.5" /></svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-slate-900 uppercase tracking-tight">{g.full_name}</h4>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${inc.severity === 'critical' ? 'bg-red-100 text-red-700' :
                          inc.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                            inc.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-700'
                        }`}>
                        {inc.severity || 'low'}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-600 mt-1">{inc.notes}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">{new Date(inc.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 self-start sm:self-auto min-w-max">
                  <span className="text-lg font-black text-red-600 font-hud px-4 py-2 bg-red-50 rounded-xl border border-red-100">-{inc.points_deducted || 0} PTS</span>
                </div>
              </div>
            );
          })}
          {incidents.length === 0 && (
            <div className="py-20 text-center border-4 border-dashed border-slate-100 rounded-[3rem]">
              <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No incidents recorded yet.</p>
            </div>
          )}
        </div>
      )}


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

            {detailGuard && (
              <ForensicDisclosure
                guard={detailGuard}
                incidents={incidents}
                disciplinaryCodes={disciplinaryCodes}
                onClose={() => setDetailGuard(null)}
              />
            )}
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
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="2.5" /></svg>
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
                    {incidents.filter(i => i.guard_id === selectedGuardId).slice(0, 5).map(i => {
                      const code = disciplinaryCodes.find(c => c.code === i.code);
                      return (
                        <div key={i.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div>
                            <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{code?.label || i.code}</p>
                            <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">{new Date(i.created_at).toLocaleString()}</p>
                          </div>
                          <span className="text-[10px] font-black text-red-600 font-hud">-{i.points_deducted || 0}</span>
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
        <div className="fixed inset-0 z-[1300] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-full sm:max-w-4xl mx-2 sm:mx-0 rounded-[2rem] sm:rounded-[3rem] shadow-2xl border border-white/20 max-h-[90vh] overflow-y-auto overscroll-contain">
            <div className="p-8 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Guard Detail</h3>
              <button onClick={() => setDetailGuard(null)} className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-400 hover:text-red-500 hover:border-red-100 transition-colors">✕</button>
            </div>
            <ForensicDisclosure guard={detailGuard} incidents={incidents} disciplinaryCodes={disciplinaryCodes} onClose={() => setDetailGuard(null)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationsEngine;
