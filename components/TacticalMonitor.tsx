import React, { useMemo } from 'react';
import { Site, Guard, AttendanceLog } from '../types';

interface TacticalMonitorProps {
  sites: Site[];
  guards: Guard[];
  attendanceLogs: AttendanceLog[];
}

const TacticalMonitor: React.FC<TacticalMonitorProps> = ({ sites, guards, attendanceLogs }) => {
  const siteStats = useMemo(() => {
    return sites.map(site => {
      const siteGuards = guards.filter(g => g.current_site_id === site.id && String((g as any)?.status || '').toLowerCase() === 'active');
      const siteLogs = attendanceLogs.filter(l => l.site_id === site.id);
      const latestLogs = siteGuards.map(g => siteLogs.filter(l => l.guard_id === g.id).sort((a, b) => new Date(b.checked_in_at).getTime() - new Date(a.checked_in_at).getTime())[0]);
      
      const presentGuards = latestLogs.filter(l => l && l.status === 'present');
      const breachGuards = latestLogs.filter(l => l && l.status === 'rejected');
      
      return {
        ...site,
        activeCount: siteGuards.length,
        presentCount: presentGuards.length,
        breachCount: breachGuards.length,
        missingCount: siteGuards.length - presentGuards.length - breachGuards.length,
      };
    });
  }, [sites, guards, attendanceLogs]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-700">
      {siteStats.map(site => (
        <div key={site.id} className="bg-white rounded-[3.5rem] border border-slate-200 p-8 shadow-sm relative overflow-hidden group min-h-[400px]">
          {/* Radar Grid Background */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, #0ea5e9 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-primary/20 rounded-full animate-ping" style={{ animationDuration: '6s' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-primary/10 rounded-full" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-1 bg-primary/20 animate-radar-sweep origin-left" style={{ transformOrigin: 'center' }} />
          </div>

          <div className="relative z-10 flex flex-col h-full">
            <div className="flex justify-between items-start mb-8">
              <div>
                <p className="text-[9px] font-black text-primary uppercase tracking-[0.4em] mb-2">Sector Monitoring</p>
                <h3 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">{site.name}</h3>
                <p className="text-[10px] font-mono font-bold text-slate-400 mt-2 uppercase tracking-widest">{site.geofence_radius_meters}M GEOFENCE ACTIVE</p>
              </div>
              <div className="flex gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
                <div className="w-3 h-3 bg-primary/30 rounded-full" />
              </div>
            </div>

            <div className="flex-grow flex items-center justify-center relative my-10">
              {/* Geofence Perimeter */}
              <div className="w-64 h-64 border-4 border-slate-100 rounded-full flex items-center justify-center relative shadow-[inset_0_0_50px_rgba(14,165,233,0.05)]">
                <div className="w-full h-full border border-slate-100 rounded-full scale-[0.7]" />
                <div className="w-full h-full border border-slate-100 rounded-full scale-[0.4]" />
                
                {/* Simulated Blips */}
                {Array.from({ length: site.activeCount }).map((_, i) => {
                  const isPresent = i < site.presentCount;
                  const isBreach = !isPresent && i < (site.presentCount + site.breachCount);
                  const angle = (i * 137.5) % 360;
                  const radius = isPresent ? (30 + (i * 5)) : 90; // Blips inside vs outside
                  
                  return (
                    <div 
                      key={i}
                      className={`absolute w-3 h-3 rounded-full shadow-lg transition-all duration-1000 ${
                        isPresent ? 'bg-emerald-500 shadow-emerald-500/30' : 
                        isBreach ? 'bg-red-500 shadow-red-500/30 animate-bounce' : 
                        'bg-slate-300'
                      }`}
                      style={{ 
                        transform: `rotate(${angle}deg) translate(${radius}px) rotate(-${angle}deg)`
                      }}
                    />
                  );
                })}
                
                <div className="w-4 h-4 bg-primary rounded-full shadow-[0_0_20px_rgba(14,165,233,0.5)]" />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mt-auto">
              {[
                { label: 'Deployed', value: site.activeCount, color: 'text-slate-900' },
                { label: 'Present', value: site.presentCount, color: 'text-emerald-600' },
                { label: 'Breached', value: site.breachCount, color: 'text-red-600' },
                { label: 'Missing', value: site.missingCount, color: 'text-slate-400' },
              ].map(stat => (
                <div key={stat.label} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                  <p className={`text-2xl font-black font-hud ${stat.color}`}>{stat.value}</p>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes radar-sweep {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .animate-radar-sweep {
            animation: radar-sweep 4s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default TacticalMonitor;
