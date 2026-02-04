
import React, { useMemo } from 'react';
import { Guard, ApplicationStatus } from '../types';

interface InterviewReportProps {
  guards: Guard[];
}

const InterviewReport: React.FC<InterviewReportProps> = ({ guards }) => {

  const reportData = useMemo(() => {
    const passedStatuses = [
      ApplicationStatus.PROCUREMENT_PENDING,
      ApplicationStatus.ACTIVE,
      ApplicationStatus.HIRED,
    ];

    const passedInterviews = guards.filter(g => passedStatuses.includes(g.application_status));
    
    const failedInterviews = guards.filter(g => 
        g.application_status === ApplicationStatus.POOL_APPLICANT && 
        g.dossier_data?.rejection_reason
    );
    
    const totalInterviewsConducted = passedInterviews.length + failedInterviews.length;
    
    const passRate = totalInterviewsConducted > 0 
      ? ((passedInterviews.length / totalInterviewsConducted) * 100).toFixed(1) 
      : '0.0';

    return {
      totalInterviewsConducted,
      passedInterviews: passedInterviews.length,
      failedInterviews: failedInterviews.length,
      passRate,
      failedApplicantsDetails: failedInterviews,
    };
  }, [guards]);

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
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Date Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {reportData.failedApplicantsDetails.length > 0 ? reportData.failedApplicantsDetails.map(guard => (
                    <tr key={guard.id}>
                        <td className="px-8 py-6">
                            <p className="font-bold text-sm text-slate-900">{guard.full_name}</p>
                            <p className="text-xs text-slate-500 font-mono">{guard.nida_number}</p>
                        </td>
                        <td className="px-8 py-6">
                            <p className="text-sm text-red-600 italic">"{guard.dossier_data?.rejection_reason}"</p>
                        </td>
                        <td className="px-8 py-6 text-right font-mono text-xs text-slate-500">
                            {new Date(guard.updated_at || guard.created_at).toLocaleDateString()}
                        </td>
                    </tr>
                )) : (
                    <tr>
                        <td colSpan={3} className="text-center py-20">
                            <p className="text-slate-400 font-black uppercase tracking-widest text-sm">No failed interview records found.</p>
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
