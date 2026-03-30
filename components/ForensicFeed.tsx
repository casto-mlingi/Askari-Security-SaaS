import React, { useEffect, useRef } from 'react';
import { AttendanceLog, IncidentReport, DisciplinaryCode } from '../types';

interface ForensicFeedProps {
  logs: AttendanceLog[];
  incidents: IncidentReport[];
  codes: DisciplinaryCode[];
}

const ForensicFeed: React.FC<ForensicFeedProps> = ({ logs, incidents, codes }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, incidents]);

  const allEvents = [
    ...logs.map(l => ({ ...l, type: 'ATTENDANCE' as const })),
    ...incidents.map(i => ({ ...i, type: 'INCIDENT' as const }))
  ].sort((a, b) => new Date(a.created_at || (a as any).checked_in_at).getTime() - new Date(b.created_at || (b as any).checked_in_at).getTime());

  return (
    <div className="bg-slate-900 rounded-[2rem] border-4 border-slate-800 shadow-2xl flex flex-col h-[500px] overflow-hidden">
      <div className="p-6 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <h4 className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Forensic Data Stream</h4>
        </div>
        <span className="text-[9px] font-mono text-slate-500 uppercase font-bold tracking-widest">Live Uptime: 99.9%</span>
      </div>

      <div 
        ref={scrollRef}
        className="flex-grow p-6 overflow-y-auto space-y-3 font-mono text-[10px] custom-scrollbar bg-slate-900/50"
      >
        {allEvents.length > 0 ? allEvents.map((event, i) => {
          const timestamp = new Date(event.type === 'ATTENDANCE' ? (event as any).checked_in_at : (event as any).created_at).toLocaleTimeString();
          const isIncident = event.type === 'INCIDENT';
          const isBreach = !isIncident && (event as any).status === 'rejected';

          return (
            <div key={i} className={`flex items-start gap-4 p-2 rounded-lg border border-transparent hover:border-slate-700 transition-colors animate-in slide-in-from-left-4 duration-300 ${isIncident ? 'text-red-400 bg-red-900/5' : isBreach ? 'text-amber-400 bg-amber-900/5' : 'text-slate-400'}`}>
              <span className="text-slate-600 shrink-0">[{timestamp}]</span>
              <span className={`font-black shrink-0 ${isIncident ? 'text-red-500' : isBreach ? 'text-amber-500' : 'text-emerald-500'}`}>
                {event.type}
              </span>
              <p className="flex-grow leading-relaxed">
                {isIncident ? (
                  <>
                    <span className="text-white font-bold">DISCIPLINARY:</span> {codes.find(c => c.code === (event as any).code)?.label} - ID: {(event as any).guard_id.slice(0, 8)} - Site: {(event as any).site_id?.slice(0, 4)}
                  </>
                ) : (
                  <>
                    <span className="text-slate-300">PULSE:</span> {(event as any).status.toUpperCase()} - LAT: {(event as any).lat.toFixed(4)} - DIST: {Math.round((event as any).distance_meters)}M
                  </>
                )}
              </p>
            </div>
          );
        }) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-700">
            <svg className="w-10 h-10 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="2" /></svg>
            <p className="uppercase tracking-[0.5em] font-black">Scanning Frequency...</p>
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-950 border-t border-slate-800 text-center">
        <div className="flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Nominal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Warn</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Incident</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForensicFeed;