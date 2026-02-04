
import React, { useState } from 'react';
import { Guard, Site, Profile, Announcement, LeaveRequest } from '../types';
import FileUploader from './FileUploader';

interface GuardOperationsProps {
  guard: Guard;
  site?: Site;
  supervisor?: Profile;
  announcements: Announcement[];
  leaveRequests: LeaveRequest[];
  onReportProblem: (description: string, evidence?: string) => void;
  onRequestLeave: (type: 'short' | 'long', start: string, end: string, reason: string) => void;
}

const GuardOperations: React.FC<GuardOperationsProps> = ({
  guard,
  site,
  supervisor,
  announcements,
  leaveRequests,
  onReportProblem,
  onRequestLeave
}) => {
  const [activeTab, setActiveTab] = useState<'report' | 'leave' | 'announcements'>('report');
  
  const [reportText, setReportText] = useState('');
  const [evidence, setEvidence] = useState<string>('');
  const [isSyncingReport, setIsSyncingReport] = useState(false);

  const [leaveType, setLeaveType] = useState<'short' | 'long'>('short');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [isSyncingLeave, setIsSyncingLeave] = useState(false);

  const handleSubmitReport = async () => {
    if (!reportText) {
      alert("Please provide a description of the issue.");
      return;
    }
    setIsSyncingReport(true);
    await new Promise(r => setTimeout(r, 1500));
    onReportProblem(reportText, evidence);
    setIsSyncingReport(false);
    setReportText('');
    setEvidence('');
    alert("Your report has been sent to your supervisor.");
  };
  
  const handleSubmitLeave = async () => {
    if (!leaveStart || !leaveEnd || !leaveReason) {
      alert("Please complete all fields for your leave request.");
      return;
    }
    setIsSyncingLeave(true);
    await new Promise(r => setTimeout(r, 1500));
    onRequestLeave(leaveType, leaveStart, leaveEnd, leaveReason);
    setIsSyncingLeave(false);
    setLeaveStart('');
    setLeaveEnd('');
    setLeaveReason('');
    alert("Your leave request has been submitted to HR for review.");
  };
  
  const renderContent = () => {
    switch (activeTab) {
      case 'report':
        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Report a Site Issue</h3>
            <textarea
              className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary transition-colors text-sm font-medium"
              placeholder="Describe the incident or issue..."
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
            />
            <FileUploader 
              label="Attach Photo Evidence"
              fileUrl={evidence}
              onUpload={setEvidence}
              onRemove={() => setEvidence('')}
              className="!h-32"
            />
            <button 
              onClick={handleSubmitReport}
              disabled={isSyncingReport}
              className="w-full h-16 bg-slate-900 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:bg-slate-200"
            >
              {isSyncingReport && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
              {isSyncingReport ? 'Sending...' : 'Send Report'}
            </button>
          </div>
        );
      case 'leave':
        return (
          <div className="space-y-8 animate-in fade-in duration-300">
             <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Request Leave</h3>
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                  <select value={leaveType} onChange={e => setLeaveType(e.target.value as any)} className="w-full h-12 px-4 bg-white border border-slate-200 rounded-lg text-xs font-bold uppercase">
                    <option value="short">Short Leave</option>
                    <option value="long">Long Leave</option>
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="date" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} className="w-full h-12 px-4 bg-white border border-slate-200 rounded-lg text-xs font-bold uppercase"/>
                    <input type="date" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} className="w-full h-12 px-4 bg-white border border-slate-200 rounded-lg text-xs font-bold uppercase"/>
                  </div>
                  <textarea value={leaveReason} onChange={e => setLeaveReason(e.target.value)} placeholder="Reason for leave..." className="w-full h-24 p-4 bg-white border border-slate-200 rounded-lg text-sm font-medium"/>
                  <button onClick={handleSubmitLeave} disabled={isSyncingLeave} className="w-full h-14 bg-primary text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg active:scale-95 transition-all">Submit Request</button>
                </div>
             </div>
             <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Leave History</h3>
                 <div className="space-y-3">
                    {leaveRequests.length > 0 ? leaveRequests.map(req => (
                        <div key={req.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center">
                            <div>
                                <p className="text-xs font-black text-slate-800 uppercase">{req.start_date} to {req.end_date}</p>
                                <p className="text-[10px] font-medium text-slate-400 italic truncate max-w-[150px]">"{req.reason}"</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${
                                req.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                req.status === 'rejected' ? 'bg-red-50 text-red-600 border-red-100' :
                                'bg-amber-50 text-amber-600 border-amber-100'
                            }`}>{req.status}</span>
                        </div>
                    )) : <p className="text-xs text-slate-400 italic">No previous leave requests.</p>}
                 </div>
             </div>
          </div>
        );
      case 'announcements':
        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            {announcements.map(ann => (
              <div key={ann.id} className="p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                 <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{ann.title}</h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">From: {ann.author_name}</p>
                    </div>
                    <span className="text-[9px] font-mono text-slate-400">{new Date(ann.created_at).toLocaleDateString()}</span>
                 </div>
                 <p className="text-sm text-slate-600 font-medium leading-relaxed">{ann.content}</p>
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-24">
      {/* Site Info Card */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-6">
        <div className="w-16 h-16 bg-slate-900 text-primary rounded-2xl flex items-center justify-center shadow-lg shrink-0">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeWidth="2.5" /></svg>
        </div>
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Current Assignment</p>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">{site?.name || 'Unassigned'}</h2>
          <p className="text-xs font-bold text-slate-500 mt-2">Supervisor: {supervisor?.full_name || 'N/A'}</p>
        </div>
      </div>

      {/* Operations Panel */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-2 bg-slate-100 flex">
          <button onClick={() => setActiveTab('report')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'report' ? 'bg-white text-primary shadow' : 'text-slate-500'}`}>Report Issue</button>
          <button onClick={() => setActiveTab('leave')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'leave' ? 'bg-white text-primary shadow' : 'text-slate-500'}`}>Leave</button>
          <button onClick={() => setActiveTab('announcements')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'announcements' ? 'bg-white text-primary shadow' : 'text-slate-500'}`}>Notices</button>
        </div>
        <div className="p-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default GuardOperations;
