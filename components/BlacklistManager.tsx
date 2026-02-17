import React, { useMemo, useState } from 'react';
import { Guard, ApplicationStatus, IncidentReport, DisciplinaryCode, UserRole, Company } from '../types';
import ForensicDisclosure from './ForensicDisclosure';
import PerformanceCircle from './PerformanceCircle';
import { guardService } from '../services/guardService';

interface BlacklistManagerProps {
  guards: Guard[];
  incidents: IncidentReport[];
  disciplinaryCodes: DisciplinaryCode[];
  userRole: UserRole;
  companies: Company[];
  onReinstateGuard: (guardId: string) => void;
}

const BlacklistManager: React.FC<BlacklistManagerProps> = ({ guards, incidents, disciplinaryCodes, userRole, companies, onReinstateGuard }) => {
  const [reportGuard, setReportGuard] = useState<Guard | null>(null);

  const blacklistedGuards = useMemo(() => 
    guards.filter(g => String((g as any)?.status).toLowerCase() === 'blacklisted'),
    [guards]
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-20 px-4 sm:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Blacklist</h2>
          <p className="text-slate-500 text-xs font-medium">Guards who cannot be hired by any company.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {blacklistedGuards.length > 0 ? blacklistedGuards.map((g) => {
          const totalIncidents = typeof (g as any).incident_count === 'number' ? (g as any).incident_count : 0;
          return (
            <div 
              key={g.id} 
              className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all group flex flex-col cursor-pointer"
              onClick={async () => {
                try {
                  const res = await guardService.getGuardById(g.id);
                  if (res?.data) {
                    setReportGuard(res.data);
                  } else {
                    setReportGuard(g);
                  }
                } catch {
                  setReportGuard(g);
                }
              }}
            >
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-lg group-hover:bg-red-600 transition-colors">
                    !
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg leading-none">{g.full_name}</h3>
                    <p className="font-mono text-[10px] text-red-500 font-black mt-1 uppercase tracking-widest">NIDA: {g.nida_number.slice(0, 10)}...</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {(companies.find(c => c.id === g.company_id)?.name || 'Marketplace')}{companies.find(c => c.id === g.company_id)?.slug ? ` • ${companies.find(c => c.id === g.company_id)!.slug}` : ''}
                    </p>
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
              <div className="p-6 flex-grow">
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Incidents</span>
                    <span className="text-[10px] font-bold text-slate-600">{totalIncidents} Total</span>
                 </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                 {userRole === UserRole.HR_OFFICER && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onReinstateGuard(g.id); }}
                        className="no-print w-full py-4 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition-colors active:scale-95 shadow-lg"
                    >
                        Reinstate
                    </button>
                 )}
              </div>
            </div>
          );
        }) : (guards && guards.length > 0 ? guards.map((g) => {
          const totalIncidents = typeof (g as any).incident_count === 'number' ? (g as any).incident_count : 0;
          return (
            <div 
              key={g.id} 
              className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all group flex flex-col cursor-pointer"
              onClick={async () => {
                try {
                  const res = await guardService.getGuardById(g.id);
                  if (res?.data) {
                    setReportGuard(res.data);
                  } else {
                    setReportGuard(g as Guard);
                  }
                } catch {
                  setReportGuard(g as Guard);
                }
              }}
            >
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-lg group-hover:bg-red-600 transition-colors">
                    !
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg leading-none">{g.full_name}</h3>
                    <p className="font-mono text-[10px] text-red-500 font-black mt-1 uppercase tracking-widest">NIDA: {(g.nida_number || '').slice(0, 10)}...</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {(companies.find(c => c.id === g.company_id)?.name || 'Marketplace')}{companies.find(c => c.id === g.company_id)?.slug ? ` • ${companies.find(c => c.id === g.company_id)!.slug}` : ''}
                    </p>
                  </div>
                </div>
                <div className="self-start sm:self-auto">
                  <div className="block sm:hidden">
                    <PerformanceCircle score={Number((g as any)?.performance_score) || 0} size={48} />
                  </div>
                  <div className="hidden sm:block">
                    <PerformanceCircle score={Number((g as any)?.performance_score) || 0} size={64} />
                  </div>
                </div>
              </div>
              <div className="p-6 flex-grow">
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Incidents</span>
                    <span className="text-[10px] font-bold text-slate-600">{totalIncidents} Total</span>
                 </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                 {userRole === UserRole.HR_OFFICER && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onReinstateGuard((g as Guard).id); }}
                        className="no-print w-full py-4 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition-colors active:scale-95 shadow-lg"
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
        ))}
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
