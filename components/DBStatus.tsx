import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

const DBStatus: React.FC = () => {
  const [status, setStatus] = useState<'online' | 'weak' | 'offline'>('online');
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      const start = Date.now();
      try {
        const res = await api.get<{ status: string; latency?: number }>('/health');
        if (!res.error && res.data?.status === 'ok') {
          setStatus('online');
          setLatency(res.data.latency || (Date.now() - start));
        } else {
          setStatus('weak');
        }
      } catch {
        setStatus('offline');
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 10000); // Pulse every 10s
    return () => clearInterval(interval);
  }, []);

  const colorMap = {
    online: 'bg-emerald-500',
    weak: 'bg-amber-500',
    offline: 'bg-rose-500'
  };

  const shadowMap = {
    online: 'shadow-[0_0_12px_rgba(16,185,129,0.4)]',
    weak: 'shadow-[0_0_12px_rgba(245,158,11,0.4)]',
    offline: 'shadow-[0_0_12px_rgba(244,63,94,0.4)]'
  };

  const labelMap = {
    online: 'DB Live',
    weak: 'Weak Link',
    offline: 'Disconnected'
  };

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full transition-all duration-500">
      <div className="relative">
        <div className={`w-2 h-2 rounded-full ${colorMap[status]} ${shadowMap[status]} animate-pulse`} />
        {status === 'online' && (
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-20" />
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 leading-none">
          {labelMap[status]}
        </span>
        {status === 'online' && latency !== null && (
          <span className="text-[8px] font-bold text-slate-400 leading-none mt-0.5">
            {latency}ms
          </span>
        )}
      </div>
    </div>
  );
};

export default DBStatus;
