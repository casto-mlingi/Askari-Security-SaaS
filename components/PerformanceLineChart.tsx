import React from 'react';

const PerformanceLineChart: React.FC = () => {
  // Mock trend points
  const performanceData = [82, 85, 83, 88, 92, 90, 94];
  const attendanceData = [90, 88, 95, 85, 98, 92, 89];
  const incidentData = [5, 4, 5, 3, 1, 2, 1];
  
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
  const maxIncidents = Math.max(...incidentData, 10); // Scale up to at least 10
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
    <div className="w-full h-full min-h-[250px] md:min-h-[300px] relative">
      {/* Legend */}
      <div className="absolute top-0 right-0 z-10 flex flex-wrap items-center gap-4 text-[9px] font-black uppercase tracking-[0.2em]">
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

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full pt-10">
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

        {/* X-Axis Labels */}
        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day, i) => (
          <text
            key={day}
            x={getX(i)}
            y={height - padding + 20}
            textAnchor="middle"
            className="fill-slate-400 text-[9px] font-black tracking-widest uppercase"
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
