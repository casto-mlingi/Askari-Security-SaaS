import React from 'react';

interface PerformanceCircleProps {
  score?: number;
  size?: number;
}

const getColorClass = (v: number) => {
  if (v >= 82) return 'text-emerald-500';
  if (v >= 61) return 'text-blue-500';
  if (v >= 51) return 'text-amber-500';
  return 'text-red-500';
};

const PerformanceCircle: React.FC<PerformanceCircleProps> = ({ score = 0, size = 56 }) => {
  const s = Math.max(0, Math.min(100, score || 0));
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (s / 100) * circumference;
  const colorCls = getColorClass(s);

  return (
    <div className="relative group/perf animate-in fade-in zoom-in duration-700" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg] drop-shadow-[0_0_8px_rgba(0,0,0,0.05)]">
        {/* Background Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="text-slate-100"
          stroke="currentColor"
          fill="transparent"
        />
        {/* Progress Fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className={`${colorCls} transition-all duration-1000 ease-out`}
          stroke="currentColor"
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[11px] font-black font-hud text-slate-900 tracking-tighter shadow-sm">{s}</span>
        <span className="text-[6px] font-black text-slate-400 uppercase tracking-tighter">PTS</span>
      </div>
    </div>
  );
};

export default PerformanceCircle;

