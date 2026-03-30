import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Site, Profile, Guard, UserRole, Company } from '../types';

interface SearchableSelectProps {
  options: { id: string; label: string; sublabel?: string; isOccupied?: boolean }[];
  onSelect: (id: string) => void;
  placeholder: string;
  icon?: React.ReactNode;
  theme?: 'dark' | 'light';
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ options, onSelect, placeholder, icon, theme = 'light' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => options.filter(opt => (opt.label || '').toLowerCase().includes((searchTerm || '').toLowerCase())), [options, searchTerm]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <input type="text" className={`w-full h-16 pl-14 pr-6 rounded-[1.2rem] outline-none font-bold text-[10px] uppercase tracking-widest border-2 transition-all ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-100 focus:border-primary'}`} placeholder={placeholder} value={searchTerm} onFocus={() => setIsOpen(true)} onChange={e => setSearchTerm(e.target.value)} />
      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">{icon || <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="3"/></svg>}</div>
      {isOpen && (
        <div className="absolute z-[500] w-full mt-4 bg-white rounded-[1.5rem] shadow-2xl border border-slate-100 max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2">
          {filtered.map(opt => (
            <button key={opt.id} onClick={() => { onSelect(opt.id); setIsOpen(false); setSearchTerm(''); }} className="w-full px-8 py-6 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 group flex justify-between items-center">
              <div className="min-w-0">
                <p className="text-[11px] font-black text-slate-900 uppercase truncate tracking-wider">{opt.label}</p>
                <p className={`text-[9px] font-bold uppercase mt-2 tracking-widest ${opt.isOccupied ? 'text-red-400' : 'text-slate-400'}`}>{opt.sublabel}</p>
              </div>
              {opt.isOccupied && <span className="text-[8px] font-black bg-red-50 text-red-600 px-3 py-1 rounded-full border border-red-100 uppercase tracking-widest">RE-ASSIGN</span>}
            </button>
          ))}
          {filtered.length === 0 && <div className="p-10 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">No matches found</div>}
        </div>
      )}
    </div>
  );
};

interface SiteManagerProps {
  sites: Site[];
  profiles: Profile[];
  guards: Guard[];
  companies: Company[];
  userRole: UserRole | string | null;
  onAddSite: (site: Omit<Site, 'id'>) => void;
  onShiftPersonnel: (personId: string, targetSiteId: string, type: 'guard' | 'supervisor') => void;
}

const SiteManager: React.FC<SiteManagerProps> = ({ sites, profiles, guards, companies, userRole, onAddSite, onShiftPersonnel }) => {
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newLat, setNewLat] = useState<string>('');
  const [newLng, setNewLng] = useState<string>('');
  const [selectedCompanyIdForNewSite, setSelectedCompanyIdForNewSite] = useState<string | undefined>(undefined);
  const [newSupervisorId, setNewSupervisorId] = useState<string | undefined>(undefined);
  const selectedSite = sites.find(s => s.id === selectedSiteId);
  const siteSupervisor = profiles.find(p => p.id === selectedSite?.supervisor_id);
  const activeGuards = useMemo(() => guards.filter(g => String((g as any)?.status || '').toLowerCase() === 'active'), [guards]);

  const effectiveCompanyId = useMemo(() => {
    if (userRole === UserRole.SUPER_ADMIN) return selectedCompanyIdForNewSite;
    return profiles.find(p => p.id === profiles[0]?.id)?.company_id; // Approximation, better to pass userCompanyId
  }, [userRole, selectedCompanyIdForNewSite, profiles]);

  const unassignedSupervisors = useMemo(() => {
    return profiles.filter(p => {
      const isSupervisor = p.role === UserRole.SUPERVISOR;
      const notAssigned = !sites.some(s => s.supervisor_id === p.id);
      const sameCompany = userRole === UserRole.SUPER_ADMIN 
        ? (!selectedCompanyIdForNewSite || p.company_id === selectedCompanyIdForNewSite)
        : true; // If COMPANY_ADMIN, profiles are usually pre-filtered or they only care about their own
      return isSupervisor && notAssigned && sameCompany;
    });
  }, [profiles, sites, userRole, selectedCompanyIdForNewSite]);

  const assignableGuards = useMemo(() => activeGuards.filter(g => g.current_site_id !== selectedSiteId), [activeGuards, selectedSiteId]);

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Site Management</h2>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-4 ml-1">Assign guards and supervisors to sites</p>
        </div>
        <button onClick={() => setIsCreating(true)} className="px-12 py-5 bg-primary text-white font-black text-xs uppercase tracking-[0.2em] rounded-[1.5rem] shadow-2xl shadow-blue-900/20 active:scale-95 transition-all hover:bg-blue-700 self-start md:self-center">+ Add New Site</button>
      </div>

      <div className="flex flex-col gap-6">
        {sites.map(site => {
          const supervisor = profiles.find(p => p.id === site.supervisor_id);
          const guardCount = activeGuards.filter(g => g.current_site_id === site.id).length;
          
          return (
            <div key={site.id} className="bg-white p-6 lg:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 group flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-12">
              {/* Site Identity */}
              <div className="flex items-center gap-6 min-w-[300px]">
                <div className="w-16 h-16 bg-slate-50 text-primary rounded-[1.5rem] flex items-center justify-center font-black shadow-inner border border-slate-100 group-hover:scale-110 transition-all duration-500">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeWidth="2.5"/></svg>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none mb-2">{site.name}</h3>
                  <p className="text-[10px] font-mono font-black text-slate-300 uppercase tracking-widest">{site.lat.toFixed(4)} • {site.lng.toFixed(4)}</p>
                </div>
              </div>

              {/* Site Stats / Metadata */}
              <div className="flex flex-wrap lg:flex-nowrap items-center gap-4 lg:gap-8 flex-grow">
                <div className="bg-slate-50 px-6 py-4 rounded-[1.5rem] border border-slate-100 flex items-center gap-4 min-w-[200px] hover:bg-white hover:shadow-md transition-all">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeWidth="2.5" /></svg></div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Supervisor</p>
                    <p className="text-[11px] font-black text-slate-800 uppercase truncate max-w-[120px]">{supervisor?.full_name || 'NOT ASSIGNED'}</p>
                  </div>
                </div>

                <div className="bg-slate-50 px-6 py-4 rounded-[1.5rem] border border-slate-100 flex items-center gap-4 min-w-[180px] hover:bg-white hover:shadow-md transition-all">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary font-black text-sm shadow-sm">{guardCount}</div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Guards on Site</p>
                    <p className="text-[11px] font-black text-slate-800 uppercase">View Roster</p>
                  </div>
                </div>

                {/* Company Tag (if relevant) */}
                {userRole === UserRole.SUPER_ADMIN && site.company_id && (
                  <div className="px-5 py-2 bg-blue-50 text-blue-600 rounded-full border border-blue-100 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-[9px] font-black uppercase tracking-widest">{companies.find(c => c.id === site.company_id)?.name || 'Tenant'}</span>
                  </div>
                )}
              </div>

              {/* Action Column */}
              <div className="flex justify-end min-w-[160px]">
                <button 
                  onClick={() => setSelectedSiteId(site.id)} 
                  className="w-full lg:w-auto px-10 py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-[1.2rem] shadow-xl hover:bg-primary active:scale-95 transition-all shadow-slate-900/10"
                >
                  Manage Site
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {selectedSiteId && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-0 md:p-10 overflow-hidden">
          <div className="bg-white w-full max-w-5xl h-full md:h-[90vh] md:rounded-[4rem] shadow-2xl flex flex-col animate-in zoom-in-95 duration-500 overflow-hidden border border-slate-200/50">
            <div className="p-10 border-b-2 border-slate-100 flex justify-between items-center bg-white text-slate-900 shadow-sm">
              <div>
                <p className="text-[9px] font-black text-primary uppercase tracking-[0.4em] mb-3">Manage Site Assignments</p>
                <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter leading-none">{selectedSite?.name}</h3>
              </div>
              <button onClick={() => setSelectedSiteId(null)} className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all border border-slate-200">✕</button>
            </div>
            <div className="flex-grow overflow-y-auto p-6 md:p-20 grid grid-cols-1 lg:grid-cols-2 gap-20 custom-scrollbar bg-slate-50/20">
               <div className="space-y-14">
                  <section>
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] border-b-2 border-slate-100 pb-5 mb-10 flex items-center gap-3"><div className="w-2 h-2 bg-primary rounded-full" />Supervisor</h4>
                    {siteSupervisor ? (
                      <div className="p-8 bg-white rounded-[2rem] text-slate-900 flex justify-between items-center shadow-lg border border-slate-200 border-l-8 border-primary animate-in slide-in-from-left-5">
                        <div>
                          <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-2">Current Supervisor</p>
                          <p className="text-xl font-black uppercase tracking-tight">{siteSupervisor.full_name}</p>
                        </div>
                        <button onClick={() => onShiftPersonnel(siteSupervisor.id, '', 'supervisor')} className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-red-600 transition-all text-slate-400 hover:text-white">✕</button>
                      </div>
                    ) : (
                      <SearchableSelect options={unassignedSupervisors.map(p => ({ id: p.id, label: p.full_name, sublabel: 'Available for assignment' }))} onSelect={id => onShiftPersonnel(id, selectedSiteId, 'supervisor')} placeholder="Assign a supervisor..." />
                    )}
                  </section>
                  <section>
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] border-b-2 border-slate-100 pb-5 mb-10 flex items-center gap-3"><div className="w-2 h-2 bg-slate-900 rounded-full" />Assign Guards</h4>
                    <SearchableSelect options={assignableGuards.map(g => ({ id: g.id, label: g.full_name, sublabel: sites.find(s => s.id === g.current_site_id)?.name || 'UNASSIGNED', isOccupied: !!g.current_site_id }))} onSelect={id => onShiftPersonnel(id, selectedSiteId, 'guard')} placeholder="Add guards to this site..." theme="light" />
                  </section>
               </div>
               <div className="space-y-10">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] border-b-2 border-slate-100 pb-5 mb-5 flex items-center gap-3"><div className="w-2 h-2 bg-emerald-500 rounded-full" />Current Roster</h4>
                  <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-4 -mr-4 custom-scrollbar">
                    {activeGuards.filter(g => g.current_site_id === selectedSiteId).map(guard => (
                      <div key={guard.id} className="p-6 bg-white border border-slate-100 rounded-2xl flex justify-between items-center shadow-sm animate-in fade-in slide-in-from-right-5">
                         <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400">{guard.full_name?.[0] || 'G'}</div>
                           <div>
                             <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{guard.full_name}</p>
                             <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Performance {Math.round(guard.performance_score || 100)}%</p>
                           </div>
                         </div>
                         <button onClick={() => onShiftPersonnel(guard.id, '', 'guard')} className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-red-500">✕</button>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
      {isCreating && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-0 md:p-10">
          <div className="bg-white w-full max-w-3xl md:rounded-[3rem] shadow-2xl border border-slate-200/50 overflow-hidden">
            <div className="p-8 bg-white text-slate-900 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-primary uppercase tracking-[0.4em] mb-2">Create Site</p>
                <h3 className="text-2xl font-black uppercase tracking-tight">Add New Site</h3>
              </div>
              <button onClick={() => setIsCreating(false)} className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center hover:bg-red-600 transition-all border border-slate-200 shadow-sm">✕</button>
            </div>
            <div className="p-8 md:p-12 space-y-8">
              <div className="space-y-3">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Site Name</p>
                <input value={newSiteName} onChange={e => setNewSiteName(e.target.value)} className="w-full h-14 rounded-2xl border border-slate-200 px-5 font-black text-sm uppercase tracking-widest focus:border-primary outline-none" placeholder="Enter site name" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Latitude</p>
                  <input value={newLat} onChange={e => setNewLat(e.target.value)} className="w-full h-14 rounded-2xl border border-slate-200 px-5 font-black text-sm uppercase tracking-widest focus:border-primary outline-none" placeholder="e.g. -6.7924" />
                </div>
                <div className="space-y-3">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Longitude</p>
                  <input value={newLng} onChange={e => setNewLng(e.target.value)} className="w-full h-14 rounded-2xl border border-slate-200 px-5 font-black text-sm uppercase tracking-widest focus:border-primary outline-none" placeholder="e.g. 39.2083" />
                </div>
              </div>
              {userRole === UserRole.SUPER_ADMIN && (
                <div className="space-y-3">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Assign to Company</p>
                  <SearchableSelect
                    options={companies.map(c => ({ id: c.id, label: c.name, sublabel: c.slug }))}
                    onSelect={id => {
                      setSelectedCompanyIdForNewSite(id);
                      setNewSupervisorId(undefined); // Reset supervisor when company changes
                    }}
                    placeholder="Search companies..."
                  />
                </div>
              )}
              <div className="space-y-3">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Assign Supervisor</p>
                <SearchableSelect
                  options={unassignedSupervisors.map(p => ({ id: p.id, label: p.full_name, sublabel: companies.find(c => c.id === p.company_id)?.name || 'Private' }))}
                  onSelect={id => setNewSupervisorId(id)}
                  placeholder={userRole === UserRole.SUPER_ADMIN && !selectedCompanyIdForNewSite ? "Pick company first" : "Pick supervisor (optional)"}
                />
              </div>
              <div className="flex items-center justify-end gap-4 pt-4">
                <button onClick={() => setIsCreating(false)} className="px-8 py-4 bg-slate-100 text-slate-700 font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl hover:bg-slate-200">Cancel</button>
                <button
                  onClick={() => {
                    const latNum = parseFloat(newLat);
                    const lngNum = parseFloat(newLng);
                    if (!newSiteName || Number.isNaN(latNum) || Number.isNaN(lngNum)) return;
                    if (userRole === UserRole.SUPER_ADMIN && !selectedCompanyIdForNewSite) {
                      (window as any).showNotification?.('error', 'Please select a company first.');
                      return;
                    }
                    onAddSite({
                      name: newSiteName,
                      lat: latNum,
                      lng: lngNum,
                      geofence_radius_meters: 100,
                      company_id: (userRole === UserRole.SUPER_ADMIN ? selectedCompanyIdForNewSite : undefined) as string,
                      supervisor_id: newSupervisorId,
                      incident_count: 0,
                      created_at: new Date().toISOString()
                    } as Omit<Site, 'id'>);
                    setIsCreating(false);
                    setNewSiteName('');
                    setNewLat('');
                    setNewLng('');
                    setNewSupervisorId(undefined);
                  }}
                  className="px-12 py-4 bg-primary text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
};

export default SiteManager;
