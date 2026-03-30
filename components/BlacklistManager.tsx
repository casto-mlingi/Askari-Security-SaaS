import React, { useMemo, useState } from 'react';
import { Guard, IncidentReport, DisciplinaryCode, UserRole, Company } from '../types';
import ForensicDisclosure from './ForensicDisclosure';
import { guardService } from '../services/guardService';

interface BlacklistManagerProps {
  guards: Guard[];
  incidents: IncidentReport[];
  disciplinaryCodes: DisciplinaryCode[];
  userRole: UserRole;
  companies: Company[];
  onReinstateGuard: (guardId: string) => void;
}

const BlacklistCard: React.FC<{ guard: Guard; onOpen: () => void }> = ({ guard, onOpen }) => {
  const score = Math.max(Number(guard?.performance_score ?? 0), 0);
  const pct = Math.max(score, 2);
  const initial = (guard?.full_name || 'G')?.[0] || 'G';
  const statusText = String((guard as any)?.status || '').toUpperCase();
  const reason = ((guard as any)?.dossier_data?.rejection_reason || 'Performance Below Threshold') as string;
  const blacklistedDate = (guard as any)?.updated_at || (guard as any)?.created_at || new Date().toISOString();
  return (
    <div className="bg-white border-l-4 border-red-600 shadow-lg rounded-lg overflow-hidden mb-4 transition-all hover:shadow-xl cursor-pointer" onClick={onOpen}>
      <div className="flex flex-col md:flex-row">
        <div className="relative w-full md:w-32 bg-gray-200 flex items-center justify-center p-4">
          <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center border-2 border-red-200">
            <span className="text-gray-500 font-bold text-xl">{initial}</span>
          </div>
          <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-2 py-1 uppercase rotate-12 translate-x-1 -translate-y-1 shadow">
            Banned
          </div>
        </div>
        <div className="p-4 flex-grow">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-lg font-bold text-gray-900 uppercase tracking-tight leading-none">
                {guard.full_name}
              </h3>
              <p className="text-xs text-gray-500 mt-1">ID: {String(guard.id).substring(0, 8)}...</p>
            </div>
            <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-black rounded uppercase border border-red-200">
              {statusText}
            </span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[10px] font-bold text-gray-600 mb-1">
              <span>PERFORMANCE SCORE</span>
              <span className="text-red-600">{score}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-red-600 h-1.5 rounded-full" style={{ width: `${pct}%` }}></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] text-gray-600 border-t pt-3 border-gray-50">
            <div>
              <span className="block font-bold text-gray-400 uppercase">Reason</span>
              <span className="text-red-700 font-medium">{reason}</span>
            </div>
            <div>
              <span className="block font-bold text-gray-400 uppercase">Blacklisted Date</span>
              <span>{new Date(blacklistedDate).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 p-3 hidden md:flex md:flex-col justify-around border-t md:border-t-0 md:border-l border-gray-100">
          <button className="text-gray-400 hover:text-red-600 transition-colors p-2" title="View Dossier" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 20l9-7-9-7-9 7 9 7z" /></svg>
          </button>
          <button className="text-gray-400 hover:text-blue-600 transition-colors p-2" title="Appeal History" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3M12 2a10 10 0 100 20 10 10 0 000-20z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

const BlacklistManager: React.FC<BlacklistManagerProps> = ({ guards, incidents, disciplinaryCodes, userRole, companies, onReinstateGuard }) => {
  const [reportGuard, setReportGuard] = useState<Guard | null>(null);

  const blacklistedGuards = useMemo(() => 
    guards.filter(g => {
      const s = String((g as any)?.status || '').toLowerCase();
      const score = Number((g as any)?.performance_score ?? 100);
      return s === 'blacklisted' || (!Number.isNaN(score) && score < 5);
    }),
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

      <div className="grid grid-cols-1 gap-4">
        {blacklistedGuards.length > 0 ? blacklistedGuards.map((g) => {
          return (
            <BlacklistCard
              key={g.id}
              guard={g}
              onOpen={async () => {
                try {
                  const res = await guardService.getGuardById(g.id);
                  if (res?.data) setReportGuard(res.data);
                  else setReportGuard(g);
                } catch {
                  setReportGuard(g);
                }
              }}
            />
          );
        }) : (guards && guards.length > 0 ? guards.map((g) => (
          <BlacklistCard
            key={g.id}
            guard={g as Guard}
            onOpen={async () => {
              try {
                const res = await guardService.getGuardById(g.id);
                if (res?.data) setReportGuard(res.data);
                else setReportGuard(g as Guard);
              } catch {
                setReportGuard(g as Guard);
              }
            }}
          />
        )) : (
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
