
import React, { useMemo, useEffect, useState } from 'react';
import { Guard } from '../types';
import { api } from '../services/api';

interface InterviewReportProps {
  guards: Guard[];
  companyId?: string;
}

type InterviewLog = {
  id?: string;
  guard_id: string;
  company_id?: string;
  outcome: 'passed' | 'failed' | 'blacklisted' | string;
  rejection_reason?: string;
  interview_date?: string;
  interview_notes?: string;
  deployment_contract_url?: string;
  created_at?: string;
};

const InterviewReport: React.FC<InterviewReportProps> = ({ guards, companyId }) => {
  const [logs, setLogs] = useState<InterviewLog[]>([]);
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    let isMounted = true;
    const fetchLogs = async () => {
      try {
        const path = companyId ? `/interview-logs?company_id=${companyId}` : '/interview-logs';
        const result = await api.get<InterviewLog[]>(path);
        if (isMounted) setLogs((result.data as InterviewLog[]) || []);
      } catch (e) {
        console.error('Failed to fetch interview_logs', e);
      }
    };
    fetchLogs();
    return () => { isMounted = false; };
  }, [companyId]);

  const reportData = useMemo(() => {
    const totalInterviewsConducted = logs.length;
    const passedInterviews = logs.filter(l => l.outcome === 'passed').length;
    const failedInterviews = logs.filter(l => l.outcome === 'failed').length;
    const passRate = totalInterviewsConducted > 0 
      ? ((passedInterviews / totalInterviewsConducted) * 100).toFixed(1) 
      : '0.0';

    return {
      totalInterviewsConducted,
      passedInterviews,
      failedInterviews,
      passRate,
      failedLogs: logs.filter(l => l.outcome === 'failed'),
      passedLogs: logs.filter(l => l.outcome === 'passed'),
    };
  }, [logs, guards]);

  const handleExportCsv = () => {
    try {
      setExporting(true);
      const headers = ['Guard ID','Guard Name','Outcome','Reason','Interview Date','Interview Notes','Contract URL','Created At'];
      const rows = logs.map(l => {
        const g = guards.find(x => x.id === l.guard_id);
        return [
          l.guard_id,
          (g?.full_name || ''),
          l.outcome,
          (l.rejection_reason || ''),
          (l.interview_date || ''),
          (l.interview_notes || ''),
          (l.deployment_contract_url || ''),
          (l.created_at || '')
        ].map(v => {
          const s = String(v ?? '');
          const needQuote = s.includes(',') || s.includes('"') || s.includes('\n');
          const escaped = s.replace(/"/g, '""');
          return needQuote ? `"${escaped}"` : escaped;
        }).join(',');
      });
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `interview_report_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-24 animate-in fade-in duration-500">
      <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-slate-200 shadow-sm">
        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Interview & Vetting Report</h2>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-4">Analysis of the personnel acquisition pipeline.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Interviews</p>
            <p className="text-5xl font-black text-primary font-hud">{reportData.totalInterviewsConducted}</p>
        </div>
         <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Passed</p>
            <p className="text-5xl font-black text-emerald-600 font-hud">{reportData.passedInterviews}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Failed</p>
            <p className="text-5xl font-black text-red-600 font-hud">{reportData.failedInterviews}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pass Rate</p>
            <p className="text-5xl font-black text-slate-900 font-hud">{reportData.passRate}%</p>
        </div>
      </div>
      
      <div className="flex items-center justify-end">
        <button onClick={handleExportCsv} disabled={exporting} className="px-4 py-2 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary transition-all">
          {exporting ? 'Exporting…' : 'Export to CSV'}
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Applicants Returned to Pool</h3>
            <p className="text-xs font-medium text-slate-500 mt-1">These applicants were interviewed but did not pass. They are available for reconsideration.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Applicant</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Reason for Rejection</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Interview Date</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Interview Notes</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Date Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {reportData.failedLogs.length > 0 ? reportData.failedLogs.map(log => {
                    const guard = guards.find(g => g.id === log.guard_id);
                    return (
                    <tr key={log.id || `${log.guard_id}-${log.created_at}`}>
                        <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              {guard?.passport_photo_url ? (
                                <img src={guard.passport_photo_url} alt={guard?.full_name || log.guard_id} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                              ) : (
                                <div className="w-8 h-8 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center font-black text-xs">
                                  {(guard?.full_name || log.guard_id)[0]}
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-sm text-slate-900">{guard?.full_name || log.guard_id}</p>
                                {guard?.nida_number && <p className="text-xs text-slate-500 font-mono">{guard.nida_number}</p>}
                              </div>
                            </div>
                        </td>
                        <td className="px-8 py-6">
                            <p className="text-sm text-red-600 italic">"{log.rejection_reason || guard?.dossier_data?.rejection_reason || '—'}"</p>
                        </td>
                        <td className="px-8 py-6">
                            <p className="text-sm text-slate-700">{log.interview_date ? new Date(log.interview_date).toLocaleString() : '—'}</p>
                        </td>
                        <td className="px-8 py-6">
                            <p className="text-sm text-slate-700 truncate">{log.interview_notes || '—'}</p>
                        </td>
                        <td className="px-8 py-6 text-right font-mono text-xs text-slate-500">
                            {new Date(log.created_at || guard?.updated_at || guard?.created_at || Date.now()).toLocaleDateString()}
                        </td>
                    </tr>
                )}) : (
                    <tr>
                        <td colSpan={5} className="text-center py-20">
                            <p className="text-slate-400 font-black uppercase tracking-widest text-sm">No failed interview records found.</p>
                        </td>
                    </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Successful Deployments</h3>
            <p className="text-xs font-medium text-slate-500 mt-1">Interviewed and deployed personnel with deployment contract links.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Applicant</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Interview Date</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Interview Notes</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Deployment Contract</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Date Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {reportData.passedLogs.length > 0 ? reportData.passedLogs.map(log => {
                    const guard = guards.find(g => g.id === log.guard_id);
                    return (
                    <tr key={log.id || `${log.guard_id}-${log.created_at}`}>
                        <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              {guard?.passport_photo_url ? (
                                <img src={guard.passport_photo_url} alt={guard?.full_name || log.guard_id} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                              ) : (
                                <div className="w-8 h-8 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center font-black text-xs">
                                  {(guard?.full_name || log.guard_id)[0]}
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-sm text-slate-900">{guard?.full_name || log.guard_id}</p>
                                {guard?.nida_number && <p className="text-xs text-slate-500 font-mono">{guard.nida_number}</p>}
                              </div>
                            </div>
                        </td>
                        <td className="px-8 py-6">
                            <p className="text-sm text-slate-700">{log.interview_date ? new Date(log.interview_date).toLocaleString() : '—'}</p>
                        </td>
                        <td className="px-8 py-6">
                            <p className="text-sm text-slate-700 truncate">{log.interview_notes || '—'}</p>
                        </td>
                        <td className="px-8 py-6">
                          {log.deployment_contract_url ? (
                            <a href={log.deployment_contract_url} target="_blank" rel="noreferrer" className="text-xs font-black text-primary underline">View Contract</a>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-8 py-6 text-right font-mono text-xs text-slate-500">
                            {new Date(log.created_at || guard?.updated_at || guard?.created_at || Date.now()).toLocaleDateString()}
                        </td>
                    </tr>
                )}) : (
                    <tr>
                        <td colSpan={5} className="text-center py-20">
                            <p className="text-slate-400 font-black uppercase tracking-widest text-sm">No passed interview records found.</p>
                        </td>
                    </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InterviewReport;
