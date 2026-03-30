import React, { useState, useMemo } from 'react';
import { Guard, Site, DisciplinaryCode, IncidentReport, Profile, Company } from '../types';
import FileUploader from './FileUploader';
import { analyzeIncident } from '../services/ai';
import { api } from '../services/api';
import ForensicDisclosure from './ForensicDisclosure';
import { getPerfCategory } from '../utils/performance';
import PerformanceCircle from './PerformanceCircle';
import AvatarImage from './AvatarImage';
import { 
  Shield, User, Fingerprint, Phone, AlertTriangle, 
  Clock, MapPin, Activity, FileText, LayoutGrid, 
  List, Eye, MoreHorizontal, ChevronRight,
  TrendingDown, TrendingUp, AlertCircle,
  X, Zap, Check
} from 'lucide-react';

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
        return acc + (i.penalty_points || 0);
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
      evidence_url: `https://api.amini.co.tz/uploads/${evidences[0]}`,
      evidence_urls: evidences.map(e => `https://api.amini.co.tz/uploads/${e}`),
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
    <div className="max-w-7xl mx-auto space-y-12 pb-24 animate-in fade-in duration-700 px-4 sm:px-0">
      {/* SENIOR UI HEADER: Instrument Grade Top Bar */}
      <div className="bg-white px-8 py-6 rounded-[2rem] border border-slate-200 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_4px_6px_-2px_rgba(0,0,0,0.05)] flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group">
        <div className="flex items-center gap-6 relative z-10 w-full md:w-auto">
          <div className="w-14 h-14 bg-slate-950 rounded-2xl flex items-center justify-center shadow-2xl transition-transform group-hover:scale-105 duration-500">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-[20px] font-black text-slate-900 uppercase tracking-[-0.04em] leading-tight">Field Operations Portfolio</h2>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">System Live</span>
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Real-time Personnel Monitoring</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto self-end md:self-center relative z-10">
          <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 backdrop-blur-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 h-12 bg-red-600 text-white font-black text-[10px] uppercase tracking-[0.15em] rounded-xl hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-600/20"
          >
            <AlertCircle className="w-4 h-4" />
            Establish Report
          </button>
        </div>
      </div>

      {/* SEGMENTED TAB SYSTEM: High Precision Control */}
      <div className="flex items-center justify-between px-2 pt-2 border-b border-slate-200/60">
        <div className="flex items-center gap-10">
          {[
            { id: 'operations' as const, label: 'Personnel Roster', icon: User },
            { id: 'incidents' as const, label: 'Tactical Archive', icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPanelTab(tab.id)}
              className={`group flex items-center gap-2.5 pb-4 relative transition-all ${panelTab === tab.id ? 'text-slate-950 opacity-100' : 'text-slate-400 hover:text-slate-600 opacity-70'}`}
            >
              <tab.icon className={`w-4 h-4 ${panelTab === tab.id ? 'text-primary' : 'text-slate-400 group-hover:text-slate-500'}`} />
              <span className="text-[11px] font-black uppercase tracking-[0.15em] whitespace-nowrap">{tab.label}</span>
              {panelTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full animate-in slide-in-from-left duration-300" />
              )}
            </button>
          ))}
        </div>
        <div className="hidden sm:flex items-center gap-4 pb-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Clock className="w-3 h-3" />
            Update Frequency: Real-Time
          </p>
        </div>
      </div>

      {panelTab === 'operations' && (
        <div className={`${viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'space-y-4'}`}>
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
                className="group relative bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-5 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] cursor-pointer flex items-center gap-6"
                onClick={() => openDetail(g)}
              >
                {/* Status indicator rail */}
                <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full transition-colors ${count > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} />
                
                <div className="relative shrink-0">
                  <AvatarImage 
                    filename={g.passport_photo_url} 
                    alt={g.full_name} 
                    fallbackLetter={g.full_name?.[0] || 'G'} 
                    className="w-16 h-16 rounded-xl object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all border border-slate-100" 
                  />
                  {count > 0 && (
                    <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[8px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-bounce">
                      {count}
                    </div>
                  )}
                </div>

                <div className="flex-grow min-w-0">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <h4 className="font-black text-slate-900 uppercase tracking-tight truncate text-base">
                      {g.full_name}
                    </h4>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right mr-2">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Health Score</p>
                        <p className={`text-sm font-black font-hud leading-none ${
                          (g.performance_score || 0) > 80 ? 'text-emerald-600' :
                          (g.performance_score || 0) > 60 ? 'text-blue-600' :
                          'text-red-600'
                        }`}>
                          {g.performance_score || 0}%
                        </p>
                      </div>
                      <PerformanceCircle score={g.performance_score || 0} size={32} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 items-center">
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 text-xs">
                        <Fingerprint className="w-3 h-3" />
                        ID: <span className="text-slate-900 font-mono">{g.nida_number?.slice(0, 10)}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 text-xs">
                        <Phone className="w-3 h-3" />
                        CEL: <span className="text-slate-900 font-mono">{g.phone || '---'}</span>
                      </p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5 text-xs">
                        <MapPin className="w-3 h-3" />
                        LOC: <span className="text-slate-900 truncate max-w-[80px] inline-block align-bottom">{sites.find(s => s.id === g.current_site_id)?.name || 'STANDBY'}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-400 hover:text-primary hover:bg-white hover:shadow-md transition-all">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Incidents Panel */}
      {panelTab === 'incidents' && (
        <div className="space-y-4 pt-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
          {(incidents || []).slice(0, 50).map(inc => {
            const g = guards.find(gx => gx.id === inc.guard_id);
            if (!g) return null;
            return (
              <div key={inc.id} className="group relative pl-8 py-6 pr-6 bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition-all duration-300 hover:shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 overflow-hidden">
                {/* Severity Rail */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                  inc.severity === 'critical' ? 'bg-red-600' :
                  inc.severity === 'high' ? 'bg-orange-500' :
                  inc.severity === 'medium' ? 'bg-amber-500' :
                  'bg-slate-300'
                }`} />
                
                <div className="flex items-center gap-6 flex-grow min-w-0">
                  <div className="relative shrink-0">
                    <AvatarImage filename={g.passport_photo_url} alt={g.full_name} fallbackLetter={g.full_name?.[0] || 'G'} className="w-12 h-12 rounded-lg object-cover border border-slate-100 shadow-sm" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        inc.severity === 'critical' ? 'bg-red-600 animate-pulse' :
                        inc.severity === 'high' ? 'bg-orange-500' :
                        'bg-slate-400'
                      }`} />
                    </div>
                  </div>
                  
                  <div className="min-w-0 flex-grow">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
                      <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm truncate uppercase">{g.full_name}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div className="w-1 i-1 rounded-full bg-slate-200" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <MapPin className="w-3 h-3" />
                          {inc.site_name || 'Generic'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <p className="text-sm font-medium text-slate-600 line-clamp-2 leading-relaxed">
                        {inc.notes}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.1em] border ${
                        inc.severity === 'critical' ? 'bg-red-50 text-red-700 border-red-100' :
                        inc.severity === 'high' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                        inc.severity === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {inc.severity || 'low'} priority
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 font-mono tracking-tighter uppercase px-2 py-0.5 bg-slate-50 rounded border border-slate-100">
                        OP-REF: {inc.code || 'UNKN-01'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8 self-end sm:self-auto shrink-0 border-l border-slate-100 pl-6 h-full">
                  <div className="text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Delta Points</p>
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-2xl font-black text-red-600 font-hud tracking-tighter">-{inc.penalty_points || 0}</span>
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-400 group-hover:text-primary group-hover:bg-white group-hover:shadow-md transition-all cursor-pointer">
                    <Eye className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
          {incidents.length === 0 && (
            <div className="py-20 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">No tactical logs recorded in current session.</p>
            </div>
          )}
        </div>
      )}


      {/* SENIOR UI: Instrument-Grade Incident Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1200] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-500">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center border border-red-100">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Establish Incident Record</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Formal Field Operations Protocol</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="w-8 h-8 flex items-center justify-center bg-slate-50 border border-slate-100 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto custom-scrollbar space-y-10">
              {/* Contextual Selector Segment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-slate-50/50 rounded-xl border border-slate-100">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <User className="w-3 h-3" />
                    Subject Personnel
                  </label>
                  <select
                    value={selectedGuardId}
                    onChange={e => {
                      setSelectedGuardId(e.target.value);
                      const g = guards.find(gx => gx.id === e.target.value);
                      if (g?.current_site_id) setSelectedSiteId(g.current_site_id);
                    }}
                    className="w-full h-12 px-4 bg-white border border-slate-200 rounded-lg font-bold uppercase text-[11px] outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all"
                  >
                    <option value="">-- Deploy Search --</option>
                    {activeGuards.map(g => <option key={g.id} value={g.id}>{g.full_name}</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <MapPin className="w-3 h-3" />
                    Deployment Site
                  </label>
                  <select
                    value={selectedSiteId}
                    onChange={e => setSelectedSiteId(e.target.value)}
                    className="w-full h-12 px-4 bg-white border border-slate-200 rounded-lg font-bold uppercase text-[11px] outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm transition-all"
                  >
                    <option value="">-- Select Site --</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Intelligence Input Area */}
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Initial Dispatch Notes</label>
                  <button
                    onClick={handleAnalyze}
                    disabled={!roughNotes || isAnalyzing}
                    className="flex items-center gap-2 px-3 py-1.5 h-8 bg-slate-900 text-white rounded-md text-[9px] font-black uppercase tracking-widest hover:bg-primary transition-all disabled:opacity-30"
                  >
                    <Zap className={`w-3 h-3 ${isAnalyzing ? 'animate-pulse' : ''}`} />
                    AI Vector Analyze
                  </button>
                </div>
                <textarea
                  value={roughNotes}
                  onChange={e => setRoughNotes(e.target.value)}
                  placeholder="E.g. Personnel detected on perimeter at 0300 HRS without authorization..."
                  className="w-full h-24 p-4 bg-white border border-slate-200 rounded-xl outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm font-medium shadow-sm resize-none"
                />
              </div>

              {/* Disciplinary Formalization */}
              <div className="space-y-6 pt-6 border-t border-slate-100">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Disciplinary Classification Code</label>
                  <select
                    value={incidentCode}
                    onChange={e => setIncidentCode(e.target.value)}
                    className={`w-full h-12 px-4 border rounded-lg font-black uppercase text-[11px] outline-none transition-all ${
                      incidentCode ? 'bg-primary/5 border-primary text-primary' : 'bg-white border-slate-200'
                    }`}
                  >
                    <option value="">-- Select Regulation Code --</option>
                    {disciplinaryCodes.map(c => <option key={c.code} value={c.code}>{c.code} - {c.label} ({c.points} pts)</option>)}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Formal Adjudication Log</label>
                  <textarea
                    value={incidentNotes}
                    onChange={e => setIncidentNotes(e.target.value)}
                    placeholder="Provide detailed forensic description..."
                    className="w-full h-32 p-4 bg-white border border-slate-200 rounded-xl outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm font-medium shadow-sm"
                  />
                </div>
              </div>

              {/* Forensic Evidence Collection */}
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Forensic Evidence (Mandatory Digital Assets)</label>
                <div className="grid grid-cols-3 gap-4">
                  <FileUploader label="Primary" fileUrl={evidence1} onUpload={setEvidence1} onRemove={() => setEvidence1('')} className="!h-28 rounded-xl border-dashed" />
                  <FileUploader label="Context" fileUrl={evidence2} onUpload={setEvidence2} onRemove={() => setEvidence2('')} className="!h-28 rounded-xl border-dashed" />
                  <FileUploader label="Secondary" fileUrl={evidence3} onUpload={setEvidence3} onRemove={() => setEvidence3('')} className="!h-28 rounded-xl border-dashed" />
                </div>
                {!evidence1 && !evidence2 && !evidence3 && (
                  <p className="text-[8px] font-black text-red-500 uppercase tracking-widest pl-1">Compliance: Digital evidence required for submission.</p>
                )}
              </div>

              {/* Historical Context (Inline) */}
              {selectedGuardId && (
                <div className="p-6 bg-red-50/30 rounded-xl border border-red-100/50">
                  <p className="text-[10px] font-black text-red-700 uppercase tracking-widest mb-4">Personnel Historical Baseline</p>
                  <div className="space-y-3">
                    {incidents.filter(i => i.guard_id === selectedGuardId).slice(0, 3).map(i => {
                      const code = disciplinaryCodes.find(c => c.code === i.code);
                      return (
                        <div key={i.id} className="flex items-center justify-between p-3 bg-white border border-red-100 rounded-lg shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            <div>
                              <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{code?.label || i.code}</p>
                              <p className="text-[8px] font-bold text-slate-400 font-mono">{new Date(i.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <span className="text-[11px] font-black text-red-600 font-hud">-{i.penalty_points || 0}</span>
                        </div>
                      );
                    })}
                    {incidents.filter(i => i.guard_id === selectedGuardId).length === 0 && (
                      <p className="text-[10px] font-bold text-slate-400 italic">No historical violations detected.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-6">
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="px-6 py-3 bg-white border border-slate-200 text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-all"
              >
                Abort Entry
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSyncing || (!evidence1 && !evidence2 && !evidence3)}
                className="flex-1 px-8 py-3 bg-red-600 text-white font-black text-[10px] uppercase tracking-widest rounded-lg hover:bg-red-700 transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed"
              >
                {isSyncing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Synchronizing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Finalize & Commit Record
                  </>
                )}
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
