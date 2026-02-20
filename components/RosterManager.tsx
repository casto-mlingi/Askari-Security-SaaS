import React, { useEffect, useMemo, useState } from 'react';
import { Guard, Profile, Site, UserRole, Roster } from '../types';
import { rosterService } from '../services/rosterService';

type ShiftType = 'day' | 'night' | 'swing';
type StatusType = 'scheduled' | 'present' | 'absent' | 'on_leave';

function fmt(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function rangeDays(start: Date, days: number) {
  const out: Date[] = [];
  for (let i = 0; i < days; i++) {
    const t = new Date(start);
    t.setDate(start.getDate() + i);
    out.push(t);
  }
  return out;
}

interface RosterManagerProps {
  guards: Guard[];
  sites: Site[];
  currentUser: Profile | Guard | null;
  userRole: UserRole | string | null;
}

const RosterManager: React.FC<RosterManagerProps> = ({ guards, sites, currentUser, userRole }) => {
  const isSupervisor = String(userRole || '').toLowerCase() === 'supervisor';
  const isAdmin = ['super_admin','company_admin','hr_officer','system_hr'].includes(String(userRole || '').toLowerCase());
  const mySiteId = (currentUser as Profile)?.current_site_id || undefined;
  const [siteId, setSiteId] = useState<string | undefined>(() => isSupervisor ? mySiteId : undefined);
  const [anchorDate, setAnchorDate] = useState<Date>(() => {
    const now = new Date();
    now.setHours(0,0,0,0);
    return now;
  });
  const [daysCount, setDaysCount] = useState(7);
  const days = useMemo(() => rangeDays(anchorDate, daysCount), [anchorDate, daysCount]);
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  const companyId = useMemo(() => {
    if (!currentUser) return undefined;
    if ('role' in (currentUser as any)) return (currentUser as Profile).company_id || undefined;
    return (currentUser as Guard).company_id || undefined;
  }, [currentUser]);

  const eligibleGuards = useMemo(() => {
    const companyGuards = guards.filter(g => (companyId ? g.company_id === companyId : true));
    const notBlacklisted = companyGuards.filter(g => String((g as any)?.status || '').toLowerCase() !== 'blacklisted');
    return notBlacklisted;
  }, [guards, companyId]);

  const rosterByKey = useMemo(() => {
    const map = new Map<string, Roster>();
    for (const r of rosters) {
      map.set(`${r.guard_id}:${r.shift_date}`, r);
    }
    return map;
  }, [rosters]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const start = fmt(days[0]);
        const end = fmt(days[days.length - 1]);
        const resp = await rosterService.get({ site_id: siteId, start, end });
        setRosters((resp.data as Roster[]) || []);
      } catch {
        setRosters([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [siteId, daysCount, anchorDate]);

  const guardsForView = useMemo(() => {
    if (isSupervisor && siteId) {
      return eligibleGuards.filter(g => g.current_site_id === siteId);
    }
    return eligibleGuards;
  }, [eligibleGuards, isSupervisor, siteId]);

  const alreadyScheduledOn = (dateStr: string) => {
    const set = new Set<string>();
    for (const r of rosters) {
      if (r.shift_date === dateStr) set.add(r.guard_id);
    }
    return set;
  };

  const onAssign = async (guardId: string, dateStr: string, shift: ShiftType, status: StatusType = 'scheduled') => {
    setAssigning(`${guardId}:${dateStr}`);
    try {
      const payload: any = { guard_id: guardId, shift_date: dateStr, shift_type: shift, status };
      if (companyId) payload.company_id = companyId;
      if (siteId) payload.site_id = siteId;
      const resp = await rosterService.assign(payload);
      const row = resp.data as Roster | undefined;
      if (row) {
        setRosters(prev => {
          const others = prev.filter(x => !(x.guard_id === guardId && x.shift_date === dateStr));
          return [...others, row];
        });
      }
    } finally {
      setAssigning(null);
    }
  };

  const onStatus = async (guardId: string, dateStr: string, status: StatusType) => {
    const r = rosterByKey.get(`${guardId}:${dateStr}`);
    if (!r) return;
    await onAssign(guardId, dateStr, r.shift_type as ShiftType, status);
  };

  const dayLabel = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tight">Roster Management</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mt-2">Discipline-first scheduling</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <select
              value={siteId || ''}
              onChange={e => setSiteId(e.target.value || undefined)}
              className="h-12 px-4 rounded-xl border border-slate-200 bg-white text-[11px] font-black uppercase tracking-widest"
            >
              <option value="">All Sites</option>
              {sites
                .filter(s => !companyId || s.company_id === companyId)
                .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <div className="flex items-center gap-2">
            <button onClick={() => setAnchorDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysCount))} className="px-4 py-2 bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest">Prev</button>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{fmt(days[0])} → {fmt(days[days.length - 1])}</span>
            <button onClick={() => setAnchorDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysCount))} className="px-4 py-2 bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest">Next</button>
          </div>
          <select value={String(daysCount)} onChange={e => setDaysCount(Number(e.target.value))} className="h-12 px-4 rounded-xl border border-slate-200 bg-white text-[11px] font-black uppercase tracking-widest">
            <option value="7">7 Days</option>
            <option value="14">14 Days</option>
            <option value="28">28 Days</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto bg-white border border-slate-200 rounded-3xl shadow-sm">
        <table className="min-w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Guard</th>
              {days.map(d => (
                <th key={d.toISOString()} className="text-center p-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                  <div>{dayLabel(d)}</div>
                  <div className="text-[9px] text-slate-400 mt-1">{fmt(d)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guardsForView.map(g => (
              <tr key={g.id} className="border-t border-slate-100">
                <td className="p-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 font-black">{g.full_name?.[0] || 'G'}</div>
                    <div className="text-[11px] font-black uppercase tracking-widest">{g.full_name}</div>
                  </div>
                </td>
                {days.map(d => {
                  const dateStr = fmt(d);
                  const key = `${g.id}:${dateStr}`;
                  const r = rosterByKey.get(key);
                  const scheduledSet = alreadyScheduledOn(dateStr);
                  const conflict = scheduledSet.has(g.id) && (!r || r.shift_date !== dateStr);
                  const label = r ? `${r.shift_type}${r.status && r.status !== 'scheduled' ? ` • ${r.status}` : ''}` : '';
                  return (
                    <td key={key} className="p-2 text-center align-middle">
                      <div className="flex flex-col items-center gap-2">
                        <button
                          disabled={assigning === key}
                          onClick={() => {
                            const next: ShiftType = r?.shift_type ? r.shift_type : 'day';
                            const options: ShiftType[] = ['day','night','swing'];
                            const idx = options.indexOf(next);
                            const newShift = options[(idx + 1) % options.length];
                            onAssign(g.id, dateStr, newShift);
                          }}
                          className={`min-w-[90px] px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border ${r ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'} ${conflict ? 'opacity-60' : ''}`}
                          title="Click to cycle Day/Night/Swing"
                        >
                          {label || 'Assign'}
                        </button>
                        {isSupervisor && r && (
                          <div className="flex items-center gap-2">
                            <button onClick={() => onStatus(g.id, dateStr, 'present')} className="px-2 py-1 rounded bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest">Present</button>
                            <button onClick={() => onStatus(g.id, dateStr, 'absent')} className="px-2 py-1 rounded bg-red-600 text-white text-[9px] font-black uppercase tracking-widest">Absent</button>
                            <button onClick={() => onStatus(g.id, dateStr, 'on_leave')} className="px-2 py-1 rounded bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest">On Leave</button>
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {!loading && guardsForView.length === 0 && (
              <tr>
                <td colSpan={days.length + 1} className="p-8 text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">No guards available</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RosterManager;
