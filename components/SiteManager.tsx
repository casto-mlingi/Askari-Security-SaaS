import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Site, Profile, Guard, UserRole } from '../types';

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
  const filtered = useMemo(() => options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase())), [options, searchTerm]);

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
  onAddSite: (site: Omit<Site, 'id' | 'company_id'>) => void;
  onShiftPersonnel: (personId: string, targetSiteId: string, type: 'guard' | 'supervisor') => void;
}

const SiteManager: React.FC<SiteManagerProps> = ({ sites, profiles, guards, onAddSite, onShiftPersonnel }) => {
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const selectedSite = sites.find(s => s.id === selectedSiteId);
  const siteSupervisor = profiles.find(p => p.id === selectedSite?.supervisor_id);
  const activeGuards = useMemo(() => guards.filter(g => g.application_status === 'active'), [guards]);

  const unassignedSupervisors = useMemo(() => profiles.filter(p => p.role === UserRole.SUPERVISOR && !sites.some(s => s.supervisor_id === p.id)), [profiles, sites]);
  const assignableGuards = useMemo(() => activeGuards.filter(g => g.current_site_id !== selectedSiteId), [activeGuards, selectedSiteId]);

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Site Management</h2>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-4 ml-1">Assign guards and supervisors to sites</p>
        </div>
        <button onClick={() => alert("Creating new site...")} className="px-12 py-5 bg-primary text-white font-black text-xs uppercase tracking-[0.2em] rounded-[1.5rem] shadow-2xl shadow-blue-900/20 active:scale-95 transition-all hover:bg-blue-700 self-start md:self-center">+ Add New Site</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {sites.map(site => (
          <div key={site.id} className="bg-white p-8 md:p-10 rounded-[3.5rem] border border-slate-200 shadow-sm hover:shadow-2xl hover:border-primary/10 transition-all duration-500 group flex flex-col">
            <div className="flex justify-between mb-10">
              <div className="w-16 h-16 bg-slate-900 text-primary rounded-[1.5rem] flex items-center justify-center font-black shadow-xl group-hover:scale-110 transition-all duration-500 ring-4 ring-slate-100">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeWidth="2.5"/></svg>
              </div>
              <span className="text-[10px] font-mono font-black text-slate-300 uppercase bg-slate-50 px-4 py-2 rounded-xl self-start border border-slate-100">{site.lat.toFixed(4)} / {site.lng.toFixed(4)}</span>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight mb-8 leading-none">{site.name}</h3>
            <div className="space-y-5 flex-grow">
              <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 flex items-center gap-6 group/item hover:bg-white hover:shadow-md transition-all">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm group-hover/item:text-primary transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeWidth="2.5" /></svg></div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5">Supervisor</p>
                  <p className="text-[11px] font-black text-slate-800 uppercase truncate">{profiles.find(p => p.id === site.supervisor_id)?.full_name || 'NOT ASSIGNED'}</p>
                </div>
              </div>
              <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 flex items-center gap-6 group/item hover:bg-white hover:shadow-md transition-all">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary font-black text-[12px] shadow-sm">{activeGuards.filter(g => g.current_site_id === site.id).length}</div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5">Guards on Site</p>
                  <p className="text-[11px] font-black text-slate-800 uppercase">View Roster</p>
                </div>
              </div>
            </div>
            <button onClick={() => setSelectedSiteId(site.id)} className="mt-10 w-full py-5 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.3em] rounded-[1.2rem] shadow-xl active:scale-95 transition-all hover:bg-primary shadow-slate-900/20">Manage Site</button>
          </div>
        ))}
      </div>

      {selectedSiteId && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-0 md:p-10 overflow-hidden">
          <div className="bg-white w-full max-w-5xl h-full md:h-[90vh] md:rounded-[4rem] shadow-2xl flex flex-col animate-in zoom-in-95 duration-500 overflow-hidden border border-white/20">
            <div className="p-10 border-b-2 border-slate-100 flex justify-between items-center bg-slate-900 text-white shadow-xl">
              <div>
                <p className="text-[9px] font-black text-primary uppercase tracking-[0.4em] mb-3">Manage Site Assignments</p>
                <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter leading-none">{selectedSite?.name}</h3>
              </div>
              <button onClick={() => setSelectedSiteId(null)} className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center hover:bg-red-600 transition-all border border-white/10 shadow-lg">✕</button>
            </div>
            <div className="flex-grow overflow-y-auto p-6 md:p-20 grid grid-cols-1 lg:grid-cols-2 gap-20 custom-scrollbar bg-slate-50/20">
               <div className="space-y-14">
                  <section>
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] border-b-2 border-slate-100 pb-5 mb-10 flex items-center gap-3"><div className="w-2 h-2 bg-primary rounded-full" />Supervisor</h4>
                    {siteSupervisor ? (
                      <div className="p-8 bg-slate-900 rounded-[2rem] text-white flex justify-between items-center shadow-2xl border-l-8 border-primary animate-in slide-in-from-left-5">
                        <div>
                          <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-2">Current Supervisor</p>
                          <p className="text-xl font-black uppercase tracking-tight">{siteSupervisor.full_name}</p>
                        </div>
                        <button onClick={() => onShiftPersonnel(siteSupervisor.id, '', 'supervisor')} className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center hover:bg-red-600 transition-all text-red-300 hover:text-white">✕</button>
                      </div>
                    ) : (
                      <SearchableSelect options={unassignedSupervisors.map(p => ({ id: p.id, label: p.full_name, sublabel: 'Available for assignment' }))} onSelect={id => onShiftPersonnel(id, selectedSiteId, 'supervisor')} placeholder="Assign a supervisor..." />
                    )}
                  </section>
                  <section>
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] border-b-2 border-slate-100 pb-5 mb-10 flex items-center gap-3"><div className="w-2 h-2 bg-slate-900 rounded-full" />Assign Guards</h4>
                    <SearchableSelect options={assignableGuards.map(g => ({ id: g.id, label: g.full_name, sublabel: sites.find(s => s.id === g.current_site_id)?.name || 'UNASSIGNED', isOccupied: !!g.current_site_id }))} onSelect={id => onShiftPersonnel(id, selectedSiteId, 'guard')} placeholder="Add guards to this site..." theme="dark" />
                  </section>
               </div>
               <div className="space-y-10">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] border-b-2 border-slate-100 pb-5 mb-5 flex items-center gap-3"><div className="w-2 h-2 bg-emerald-500 rounded-full" />Current Roster</h4>
                  <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-4 -mr-4 custom-scrollbar">
                    {activeGuards.filter(g => g.current_site_id === selectedSiteId).map(guard => (
                      <div key={guard.id} className="p-6 bg-white border border-slate-100 rounded-2xl flex justify-between items-center shadow-sm animate-in fade-in slide-in-from-right-5">
                         <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400">{guard.full_name[0]}</div>
                           <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{guard.full_name}</p>
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
