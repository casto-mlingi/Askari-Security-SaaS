import React from 'react';
import { Guard, IncidentReport, AttendanceLog, UserRole } from '../types';

type Props = {
  guards: Guard[];
  incidents: IncidentReport[];
  attendanceLogs: AttendanceLog[];
  userRole: UserRole;
  companyId?: string;
};

const PerformanceLineChart: React.FC<Props> = ({ guards, incidents, attendanceLogs, userRole, companyId }) => {
  const isSuperAdmin = userRole === UserRole.SUPER_ADMIN;
  const scopedGuardIds = (isSuperAdmin || !companyId)
    ? guards.map(g => g.id)
    : guards.filter(g => g.company_id === companyId).map(g => g.id);
  const scopedAttendance = attendanceLogs.filter(a => scopedGuardIds.includes(a.guard_id));
  const scopedIncidents = incidents.filter(i => scopedGuardIds.includes(i.guard_id));

  const days = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const getDowIndex = (dateStr: string) => {
    const d = new Date(dateStr);
    const jsDow = d.getDay(); // 0=Sun..6=Sat
    return jsDow === 0 ? 6 : jsDow - 1; // 0->6, 1->0, ... align to MON first
  };

  const avgProfileScore = guards.length
    ? Math.round(guards.reduce((sum, g) => sum + (g.performance_score ?? g.profile_score ?? 0), 0) / guards.length)
    : 0;

  const attendancePercentByDay = Array(7).fill(0).map((_, i) => {
    const logsForDay = scopedAttendance.filter(a => getDowIndex(a.checked_in_at) === i);
    const total = logsForDay.length;
    if (!total) return 0;
    const present = logsForDay.filter(l => l.status === 'present').length;
    return Math.round((present / total) * 100);
  });

  const incidentsByDay = Array(7).fill(0).map((_, i) =>
    scopedIncidents.filter(inc => getDowIndex(inc.created_at) === i).length
  );

  const performanceByDay = incidentsByDay.map(inc => {
    const penalty = inc * 5;
    const val = Math.max(0, Math.min(100, avgProfileScore - penalty));
    return val;
  });

  const performanceData = performanceByDay;
  const attendanceData = attendancePercentByDay;
  const incidentData = incidentsByDay;
  const width = 600;
  const height = 240;
  const padding = 40;
  const chartWidth = width - (padding * 2);
  const chartHeight = height - (padding * 2);
  
  // --- Scaling Calculations ---
  // Bars (Percentage 0-100)
  const getY = (val: number) => {
    return padding + chartHeight - (val / 100) * chartHeight;
  };

  // Incident Line (0 to max incident count)
  const maxIncidents = Math.max(...incidentData, 10);
  const getIncY = (val: number) => {
    return padding + chartHeight - (val / maxIncidents) * chartHeight;
  };

  const getX = (index: number) => {
    return padding + (index * (chartWidth / (performanceData.length - 1)));
  };

  // --- Path Generation for the Line ---
  const linePath = incidentData.map((val, i) => {
    const x = getX(i);
    const y = getIncY(val);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Bar dimensions
  const barGroupWidth = (chartWidth / performanceData.length) * 0.8;
  const individualBarWidth = barGroupWidth / 2.2;

  return (
    <div className="w-full h-full min-h-[300px] md:min-h-[340px] relative">
      {/* Legend */}
      <div className="static md:absolute md:top-0 md:right-0 z-10 flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] mb-3 md:mb-0 px-1">
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-primary rounded-sm" />
            <span className="text-slate-500">Performance</span>
        </div>
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
            <span className="text-slate-500">Attendance</span>
        </div>
        <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-red-500 rounded-full" />
            <span className="text-slate-500">Incidents (Trend)</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full pt-12 md:pt-10">
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0017AD" stopOpacity="1" />
            <stop offset="100%" stopColor="#000E6B" stopOpacity="0.8" />
          </linearGradient>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.2"/>
          </filter>
        </defs>
        
        {/* Background Grid Lines */}
        {[0, 25, 50, 75, 100].map((v) => {
          const y = getY(v);
          return (
            <g key={v}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#f1f4f9" strokeWidth="1" />
              <text x={padding - 10} y={y + 3} textAnchor="end" className="fill-slate-300 text-[8px] font-black font-hud">{v}%</text>
            </g>
          );
        })}

        {/* Clustered Columns (Bars) */}
        {performanceData.map((perf, i) => {
          const groupCenterX = getX(i);
          const bar1X = groupCenterX - individualBarWidth - 1;
          const bar2X = groupCenterX + 1;
          
          const perfY = getY(perf);
          const attenY = getY(attendanceData[i]);
          const baseLine = padding + chartHeight;

          return (
            <g key={`group-${i}`} className="group cursor-crosshair">
              {/* Performance Bar */}
              <rect
                x={bar1X}
                y={perfY}
                width={individualBarWidth}
                height={baseLine - perfY}
                fill="url(#barGrad)"
                rx="4"
                className="animate-grow-bar"
                style={{ transformOrigin: `0 ${baseLine}px` }}
              >
                <title>Performance: {perf}%</title>
              </rect>
              
              {/* Attendance Bar */}
              <rect
                x={bar2X}
                y={attenY}
                width={individualBarWidth}
                height={baseLine - attenY}
                fill="#10b981"
                rx="4"
                className="animate-grow-bar opacity-80 group-hover:opacity-100 transition-opacity"
                style={{ transformOrigin: `0 ${baseLine}px`, animationDelay: '0.2s' }}
              >
                <title>Attendance: {attendanceData[i]}%</title>
              </rect>

              {/* Tooltip Hover Overlay */}
              <rect 
                x={groupCenterX - barGroupWidth/2} 
                y={padding} 
                width={barGroupWidth} 
                height={chartHeight} 
                fill="transparent" 
                className="hover:fill-slate-400/5 transition-colors"
              />
            </g>
          );
        })}

        {/* Incident Line (Dashed) */}
        <path
          d={linePath}
          fill="none"
          stroke="#ef4444"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="8 6"
          filter="url(#shadow)"
          className="animate-draw-line"
        />

        {/* Incident Points */}
        {incidentData.map((val, i) => {
          const x = getX(i);
          const y = getIncY(val);
          return (
            <circle
              key={`inc-pt-${i}`}
              cx={x}
              cy={y}
              r="5"
              fill="white"
              stroke="#ef4444"
              strokeWidth="3"
              className="hover:scale-150 transition-transform cursor-pointer"
            >
              <title>Incidents: {val}</title>
            </circle>
          );
        })}

        {/* X-Axis Labels (mobile: rotated for readability) */}
        {days.map((day, i) => (
          <text
            key={`m-${day}`}
            x={getX(i)}
            y={height - padding + 20}
            textAnchor="middle"
            transform={`rotate(-45 ${getX(i)} ${height - padding + 20})`}
            className="md:hidden fill-slate-400 text-[10px] font-black tracking-widest uppercase"
          >
            {day}
          </text>
        ))}
        {/* X-Axis Labels (desktop: standard) */}
        {days.map((day, i) => (
          <text
            key={`d-${day}`}
            x={getX(i)}
            y={height - padding + 20}
            textAnchor="middle"
            className="hidden md:block fill-slate-400 text-[9px] font-black tracking-widest uppercase"
          >
            {day}
          </text>
        ))}
      </svg>
      
      <style>{`
        @keyframes grow-bar {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
        @keyframes draw-line {
          from { stroke-dashoffset: 1000; }
          to { stroke-dashoffset: 0; }
        }
        .animate-grow-bar {
          animation: grow-bar 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-draw-line {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: draw-line 2.5s ease-out forwards;
          animation-delay: 0.5s;
        }
      `}</style>
    </div>
  );
};
export default PerformanceLineChart;
