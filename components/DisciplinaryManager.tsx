import React, { useState, useMemo, useEffect } from 'react';
import { Guard, IncidentReport, DisciplinaryCode, Site, LeaveRequest, Profile, Company } from '../types';
import PerformanceLineChart from './PerformanceLineChart';
// ✅ FIXED: Imported only once, using the correct relative path
import { suggestDisciplinaryPolicy, generateFormalDisciplinaryRecord } from '../services/ai';
import { api } from '../services/api';
import AvatarImage from './AvatarImage';

interface DisciplinaryManagerProps {
  guards: Guard[];
  profiles: Profile[];
  incidents: IncidentReport[];
  disciplinaryCodes: DisciplinaryCode[];
  leaveRequests: LeaveRequest[];
  sites?: Site[];
  onUpdateLeaveStatus: (id: string, status: 'approved' | 'rejected') => void;
  onViewGuardAudit?: (guard: Guard) => void;
  onAddPolicy?: (policy: DisciplinaryCode) => void;
  onDeletePolicy?: (code: string) => void;
  onUpdatePolicy?: (code: string, updates: Partial<DisciplinaryCode>) => void;
  onAfterSaveRecord?: (guardId: string, penaltyPoints: number) => void;
}

const DisciplinaryManager: React.FC<DisciplinaryManagerProps> = ({
  guards,
  profiles,
  incidents,
  disciplinaryCodes,
  leaveRequests,
  sites = [],
  onUpdateLeaveStatus,
  onViewGuardAudit,
  onAddPolicy,
  onDeletePolicy,
  onUpdatePolicy,
  onAfterSaveRecord
}) => {
  const [view, setView] = useState<'performance' | 'incidents' | 'leave' | 'policies'>('performance');
  const [perfMode, setPerfMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');

  // Policy Generation State
  const [policyDesc, setPolicyDesc] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPolicy, setGeneratedPolicy] = useState<DisciplinaryCode | null>(null);

  // Policy Editing State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<DisciplinaryCode | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editPoints, setEditPoints] = useState(0);
  const [editDescription, setEditDescription] = useState('');
  const [roughNotes, setRoughNotes] = useState('');
  const [selectedGuardId, setSelectedGuardId] = useState('');
  const [formalPreview, setFormalPreview] = useState<{ formal_report: string; incident_code: string; penalty_points: number } | null>(null);
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [formalReportText, setFormalReportText] = useState('');
  const [incidentCodeText, setIncidentCodeText] = useState('');
  const [penaltyPointsValue, setPenaltyPointsValue] = useState<number>(0);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [guardContext, setGuardContext] = useState<{ company?: Company | null; site?: Site | null; supervisor?: Profile | null }>({});

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const r = await api.get<Company[]>('/companies');
        setCompanies(r.data || []);
      } catch { }
    };
    loadCompanies();
  }, []);

  useEffect(() => {
    const g = guards.find(x => x.id === selectedGuardId);
    if (!g) {
      setGuardContext({});
      return;
    }
    const company = companies.find(c => c.id === g.company_id) || null;
    const site = sites.find(s => s.id === g.current_site_id || s.id === g.assigned_site_id) || null;
    const supervisor = profiles.find(p => p.id === (g.assigned_supervisor_id || site?.supervisor_id || '')) || null;
    setGuardContext({ company, site, supervisor });
  }, [selectedGuardId, companies, sites, profiles, guards]);

  const deployedGuards = useMemo(() => guards.filter(g =>
    String((g as any)?.status || '').toLowerCase() === 'active'
  ), [guards]);

  const filteredIncidents = useMemo(() => incidents.filter(i => {
    const g = guards.find(guard => guard.id === i.guard_id);
    return ((g?.full_name || '').toLowerCase()).includes((searchTerm || '').toLowerCase());
  }), [incidents, guards, searchTerm]);

  const handleGeneratePolicy = async () => {
    if (!policyDesc) return;
    setIsGenerating(true);
    try {
      const result = await suggestDisciplinaryPolicy(policyDesc);
      if (result) {
        setGeneratedPolicy(result);
      }
    } catch (error) {
      console.error("Policy generation failed:", error);
    }
    setIsGenerating(false);
  };

  const confirmPolicy = () => {
    if (generatedPolicy && onAddPolicy) {
      onAddPolicy(generatedPolicy);
      setGeneratedPolicy(null);
      setPolicyDesc('');
    }
  };

  const openEditModal = (policy: DisciplinaryCode) => {
    setEditingPolicy(policy);
    setEditLabel(policy.label);
    setEditPoints(policy.points);
    setEditDescription(policy.description || '');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (editingPolicy && onUpdatePolicy) {
      onUpdatePolicy(editingPolicy.code, {
        label: editLabel,
        points: editPoints,
        description: editDescription,
      });
      setIsEditModalOpen(false);
      setEditingPolicy(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-24 animate-in fade-in duration-500">
      <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-10">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Disciplinary & HR</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-4">Performance tracking & policy enforcement</p>
        </div>
        <div className="bg-slate-100 p-1.5 rounded-2xl flex border border-slate-200 shadow-inner overflow-x-auto max-w-full">
          <button onClick={() => setView('performance')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${view === 'performance' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Performance</button>
          <button onClick={() => setView('incidents')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${view === 'incidents' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Incidents</button>
          <button onClick={() => setView('leave')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${view === 'leave' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Leave Requests</button>
          <button onClick={() => setView('policies')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${view === 'policies' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Policies</button>
        </div>
      </div>

      {view === 'performance' && (
        <div className="space-y-8">
          {/* Fleet-Wide Metrics chart removed from Disciplinary page */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => setPerfMode('grid')}
              className={`w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center ${perfMode === 'grid' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500'}`}
            >▦</button>
            <button
              onClick={() => setPerfMode('list')}
              className={`w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center ${perfMode === 'list' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500'}`}
            >☰</button>
          </div>
          <div className={perfMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
            {deployedGuards.map(guard => (
              <div key={guard.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center justify-between group hover:border-primary/20 transition-all">
                <div className="flex items-center gap-4">
                  <AvatarImage filename={guard.passport_photo_url} alt={guard.full_name} fallbackLetter={guard.full_name?.[0] || 'G'} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                  <div>
                    <h4 className="font-black text-slate-900 uppercase tracking-tight">{guard.full_name}</h4>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Site: {sites.find(s => s.id === guard.current_site_id)?.name || 'Unassigned'}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Supervisor: {profiles.find(p => p.id === sites.find(s => s.id === guard.current_site_id)?.supervisor_id)?.full_name || 'N/A'}</p>
                  </div>
                </div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white ${guard.performance_score! < 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                  {guard.performance_score}%
                </div>
                <button onClick={() => onViewGuardAudit?.(guard)} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'incidents' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-4">Rough Field Notes → Formal Report</h3>
            {selectedGuardId && (
              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px] font-black uppercase tracking-widest text-slate-600">
                <div>Company: <span className="text-slate-900">{guardContext.company?.name || '—'}</span></div>
                <div>Site: <span className="text-slate-900">{guardContext.site?.name || '—'}</span></div>
                <div>Supervisor: <span className="text-slate-900">{guardContext.supervisor?.full_name || '—'}</span></div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select value={selectedGuardId} onChange={e => setSelectedGuardId(e.target.value)} className="h-12 px-4 bg-white border border-slate-200 rounded-xl font-bold uppercase text-[10px]">
                <option value="">Select Guard</option>
                {guards.map(g => (
                  <option key={g.id} value={g.id}>{g.full_name}</option>
                ))}
              </select>
              <button
                onClick={async () => {
                  if (!roughNotes || !selectedGuardId) return;
                  const result = await generateFormalDisciplinaryRecord(roughNotes, disciplinaryCodes);
                  const data = (result && (result.formal_report || result.incident_code)) ? result : (result?.data || {});
                  const fr = String(data.formal_report || '');
                  const ic = String(data.incident_code || '');
                  const pts = typeof data.penalty_points === 'number' ? data.penalty_points : Number(data.penalty_points || 0);
                  setFormalReportText(fr);
                  setIncidentCodeText(ic);
                  setPenaltyPointsValue(pts);
                  setFormalPreview({ formal_report: fr, incident_code: ic, penalty_points: pts });
                }}
                className="h-12 px-6 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
              >
                Generate with AI
              </button>
              <button
                onClick={async () => {
                  if (!formalPreview || !selectedGuardId) return;
                  setIsSavingRecord(true);
                  let companyId = 'f2ffa67e-c5fc-4cb5-a81f-7cb0074eff4b';
                  try {
                    const parsed = JSON.parse(localStorage.getItem('amini_user') || 'null');
                    companyId = parsed?.company_id || companyId;
                  } catch { }
                  const payload = {
                    guard_id: selectedGuardId,
                    company_id: companyId,
                    formal_report: formalReportText,
                    penalty_points: penaltyPointsValue <= 0 ? penaltyPointsValue : -Math.abs(penaltyPointsValue),
                    incident_code: incidentCodeText,
                    rough_notes: roughNotes
                  };
                  await api.post('/disciplinary/records', payload);
                  try {
                    const pts = Math.abs(penaltyPointsValue <= 0 ? penaltyPointsValue : -Math.abs(penaltyPointsValue));
                    onAfterSaveRecord?.(selectedGuardId, pts);
                  } catch { }
                  setIsSavingRecord(false);
                  setFormalPreview(null);
                  setRoughNotes('');
                  setSelectedGuardId('');
                  setFormalReportText('');
                  setIncidentCodeText('');
                  setPenaltyPointsValue(0);
                }}
                disabled={isSavingRecord}
                className="h-12 px-6 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
              >
                {isSavingRecord ? 'Saving...' : 'Save to Record'}
              </button>
            </div>
            <textarea
              value={roughNotes}
              onChange={e => setRoughNotes(e.target.value)}
              placeholder="Enter Rough Field Notes..."
              className="w-full h-28 mt-4 px-4 py-3 bg-white border border-slate-200 rounded-xl font-medium"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <textarea
                value={formalReportText}
                onChange={e => setFormalReportText(e.target.value)}
                placeholder="Formal Report (AI will fill this)"
                className="md:col-span-2 w-full h-28 px-4 py-3 bg-white border border-slate-200 rounded-xl font-medium"
              />
              <div className="space-y-3">
                <input
                  type="text"
                  value={incidentCodeText}
                  onChange={e => setIncidentCodeText(e.target.value)}
                  placeholder="Incident Code (e.g., S.1)"
                  className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl font-bold uppercase text-[10px]"
                />
                <input
                  type="number"
                  value={penaltyPointsValue}
                  onChange={e => setPenaltyPointsValue(Number(e.target.value || 0))}
                  placeholder="Penalty Points (negative)"
                  className="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl font-bold uppercase text-[10px]"
                />
              </div>
            </div>
            {formalPreview && (
              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Formal Report</p>
                <pre className="text-xs whitespace-pre-wrap text-slate-800">{formalPreview.formal_report}</pre>
                <div className="mt-2 flex items-center gap-3">
                  <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black uppercase tracking-widest">{formalPreview.incident_code}</span>
                  <span className="px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200 text-[10px] font-black uppercase tracking-widest">-{formalPreview.penalty_points} PTS</span>
                </div>
              </div>
            )}
          </div>
          <input
            type="text"
            placeholder="Search incidents by guard name..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full h-14 px-6 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest outline-none focus:border-primary transition-all"
          />
          {filteredIncidents.length > 0 ? (
            <div className="space-y-6">
              {guards.map(g => {
                const byG = filteredIncidents.filter(i => i.guard_id === g.id);
                if (byG.length === 0) return null;
                const total = byG.reduce((acc, i) => acc + (disciplinaryCodes.find(c => c.code === i.code)?.points || 0), 0);
                return (
                  <div key={g.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center font-black text-xl border border-red-100">!</div>
                        <div>
                          <h4 className="font-black text-slate-900 uppercase tracking-tight text-lg">{g.full_name}</h4>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Supervisor: {profiles.find(p => p.id === sites.find(s => s.id === g.current_site_id)?.supervisor_id)?.full_name || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-red-600 font-hud">-{total} PTS</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{byG.length} Incidents</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {byG.map(inc => {
                        const code = disciplinaryCodes.find(c => c.code === inc.code);
                        return (
                          <button key={inc.id} className="w-full text-left p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-black text-slate-900 uppercase">{code?.label}</p>
                              <span className="text-[10px] font-black text-red-600 font-hud">-{code?.points || 0} PTS</span>
                            </div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{new Date(inc.created_at).toLocaleString()}</p>
                            <p className="text-xs text-slate-600 font-medium italic mt-2">"{inc.notes}"</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center border-4 border-dashed border-slate-100 rounded-[3rem]">
              <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No incidents found</p>
            </div>
          )}
        </div>
      )}

      {view === 'leave' && (
        <div className="grid grid-cols-1 gap-6">
          {leaveRequests.map(req => {
            const guard = guards.find(g => g.id === req.guard_id);
            return (
              <div key={req.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black text-2xl">
                    {guard?.full_name?.[0] || 'G'}
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{guard?.full_name}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${req.type === 'long' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                        {req.type} Leave
                      </span>
                      <span className="text-[10px] font-mono font-bold text-slate-500">
                        {new Date(req.start_date).toLocaleDateString()} → {new Date(req.end_date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-2 italic">"{req.reason}"</p>
                  </div>
                </div>
                {req.status === 'pending' ? (
                  <div className="flex gap-3 w-full md:w-auto">
                    <button onClick={() => onUpdateLeaveStatus(req.id, 'approved')} className="flex-1 md:flex-none px-6 py-3 bg-emerald-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-all shadow-lg">Approve</button>
                    <button onClick={() => onUpdateLeaveStatus(req.id, 'rejected')} className="flex-1 md:flex-none px-6 py-3 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-red-50 hover:text-red-500 transition-all">Reject</button>
                  </div>
                ) : (
                  <div className={`px-6 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest ${req.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                    {req.status}
                  </div>
                )}
              </div>
            );
          })}
          {leaveRequests.length === 0 && (
            <div className="py-20 text-center border-4 border-dashed border-slate-100 rounded-[3rem]">
              <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No pending leave requests</p>
            </div>
          )}
        </div>
      )}

      {view === 'policies' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/20 rounded-full -mr-20 -mt-20 blur-3xl"></div>
              <h3 className="text-xl font-black uppercase tracking-tighter mb-6 relative z-10">AI Policy Architect</h3>
              <div className="space-y-4 relative z-10">
                <textarea
                  value={policyDesc}
                  onChange={e => setPolicyDesc(e.target.value)}
                  placeholder="Describe the misconduct to generate a policy code (e.g. 'Sleeping during night shift')..."
                  className="w-full h-32 p-4 bg-white/10 border border-white/10 rounded-xl text-sm font-medium outline-none focus:bg-white/20 transition-all placeholder:text-white/30"
                />
                <button
                  onClick={handleGeneratePolicy}
                  disabled={isGenerating || !policyDesc}
                  className="w-full py-4 bg-primary text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary-light transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGenerating ? 'Architecting...' : 'Generate Policy Code'}
                </button>
              </div>
            </div>

            {generatedPolicy && (
              <div className="bg-white p-6 rounded-[2rem] border-2 border-primary/20 shadow-xl animate-in slide-in-from-top-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Generated Code</p>
                    <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">{generatedPolicy.code}</h4>
                  </div>
                  <span className="text-xl font-black text-red-600 font-hud">-{generatedPolicy.points} PTS</span>
                </div>
                <p className="text-sm font-bold text-slate-600 mb-2">{generatedPolicy.label}</p>
                <p className="text-xs text-slate-500 mb-6">{generatedPolicy.description}</p>
                <div className="flex gap-3">
                  <button onClick={() => setGeneratedPolicy(null)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-200">Discard</button>
                  <button onClick={confirmPolicy} className="flex-1 py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary shadow-lg">Activate Policy</button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Active Disciplinary Codes</h3>
            </div>
            <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto custom-scrollbar">
              {disciplinaryCodes.map(code => (
                <div key={code.code} className="p-6 flex items-center justify-between group hover:bg-slate-50 transition-colors">
                  <div className="flex-grow">
                    <div className="flex items-center gap-3">
                      <span className="font-black text-slate-900 uppercase tracking-tight">{code.code}</span>
                      <span className="text-[9px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded uppercase tracking-widest">-{code.points} Pts</span>
                    </div>
                    <p className="text-xs font-medium text-slate-500 mt-1">{code.label}</p>
                    {code.description && <p className="text-[10px] text-slate-400 mt-0.5 italic max-w-sm">{code.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {onUpdatePolicy && (
                      <button onClick={() => openEditModal(code)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-primary transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
                      </button>
                    )}
                    {onDeletePolicy && (
                      <button onClick={() => onDeletePolicy(code.code)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Policy Modal */}
      {isEditModalOpen && editingPolicy && (
        <div className="fixed inset-0 z-[1200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-10 space-y-8 border border-white/20">
            <div className="text-center">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Edit Disciplinary Policy</h3>
              <p className="text-sm font-medium text-slate-500 mt-2">Modify policy: <span className="font-bold">{editingPolicy.code}</span></p>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Policy Label</label>
                <input value={editLabel} onChange={e => setEditLabel(e.target.value)} required className="w-full h-14 px-6 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold uppercase outline-none focus:border-primary transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Points Deduction</label>
                <input type="number" value={editPoints} onChange={e => setEditPoints(Number(e.target.value))} required min="0" max="100" className="w-full h-14 px-6 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Description</label>
                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={3} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-medium outline-none focus:border-primary transition-all" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary shadow-xl active:scale-95 transition-all">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DisciplinaryManager;
