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
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="text-slate-200"
          stroke="currentColor"
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className={colorCls}
          stroke="currentColor"
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-black font-hud text-slate-700">{s}%</span>
      </div>
    </div>
  );
};

export default PerformanceCircle;

