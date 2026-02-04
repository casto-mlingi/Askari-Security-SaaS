import React, { useMemo, useState } from 'react';
import { Guard, ApplicationStatus, IncidentReport, DisciplinaryCode, UserRole } from '../types';
import ForensicDisclosure from './ForensicDisclosure';

interface BlacklistManagerProps {
  guards: Guard[];
  incidents: IncidentReport[];
  disciplinaryCodes: DisciplinaryCode[];
  userRole: UserRole;
  onReinstateGuard: (guardId: string) => void;
}

const BlacklistManager: React.FC<BlacklistManagerProps> = ({ guards, incidents, disciplinaryCodes, userRole, onReinstateGuard }) => {
  const [reportGuard, setReportGuard] = useState<Guard | null>(null);

  const blacklistedGuards = useMemo(() => 
    guards.filter(g => g.application_status === ApplicationStatus.BLACKLISTED),
    [guards]
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Blacklist</h2>
          <p className="text-slate-500 text-xs font-medium">Guards who cannot be hired by any company.</p>
        </div>
        <div className="bg-red-50 text-red-600 px-4 py-2 rounded-xl border border-red-100 flex items-center gap-3 shadow-sm self-start">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest leading-none">System Protected</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {blacklistedGuards.length > 0 ? blacklistedGuards.map((g) => {
          const guardIncidents = incidents.filter(i => i.guard_id === g.id);
          return (
            <div key={g.id} className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all group flex flex-col">
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-lg group-hover:bg-red-600 transition-colors">
                    !
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg leading-none">{g.full_name}</h3>
                    <p className="font-mono text-[10px] text-red-500 font-black mt-1 uppercase tracking-widest">NIDA: {g.nida_number.slice(0, 10)}...</p>
                  </div>
                </div>
                <div className="text-right">
                   <p className="text-xl font-black text-slate-900 font-hud leading-none">{g.performance_score || 0}%</p>
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Final Score</p>
                </div>
              </div>
              <div className="p-6 flex-grow">
                 <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Incidents</span>
                    <span className="text-[10px] font-bold text-slate-600">{guardIncidents.length} Total</span>
                 </div>
                 <div className="space-y-2">
                    {guardIncidents.slice(0, 2).map(inc => (
                      <div key={inc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-700 truncate mr-4">{disciplinaryCodes.find(c => c.code === inc.code)?.label}</span>
                        <span className="text-[10px] font-black text-red-600 font-hud">-{disciplinaryCodes.find(c => c.code === inc.code)?.points}</span>
                      </div>
                    ))}
                    {guardIncidents.length > 2 && <p className="text-center text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] pt-2">+ {guardIncidents.length - 2} More Incidents</p>}
                 </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                 <button 
                  onClick={() => setReportGuard(g)}
                  className="w-full py-4 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-700 transition-colors active:scale-95 shadow-lg"
                 >
                    View Details
                 </button>
                 {userRole === UserRole.HR_OFFICER && (
                    <button
                        onClick={() => onReinstateGuard(g.id)}
                        className="w-full py-4 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition-colors active:scale-95 shadow-lg"
                    >
                        Reinstate
                    </button>
                 )}
              </div>
            </div>
          );
        }) : (
          <div className="col-span-full py-32 text-center border-2 border-dashed border-slate-200 rounded-[3rem] bg-slate-50/50 flex flex-col items-center justify-center">
             <p className="text-slate-400 font-black uppercase tracking-widest text-xs italic">Blacklist is empty.</p>
          </div>
        )}
      </div>

      {/* FORENSIC DISCLOSURE MODAL */}
      {reportGuard && (
        <ForensicDisclosure 
          guard={reportGuard} 
          incidents={incidents} 
          disciplinaryCodes={disciplinaryCodes} 
          onClose={() => setReportGuard(null)} 
        />
      )}
    </div>
  );
};

export default BlacklistManager;