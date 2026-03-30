
import React from 'react';
import { Guard, Announcement } from '../types';

interface NoticeBoardProps {
  guard: Guard;
  announcements: Announcement[];
}

const NoticeBoard: React.FC<NoticeBoardProps> = ({ guard, announcements }) => {
  const hasHRNote = guard.dossier_data?.interviewer_notes;
  const privateNotes = guard.dossier_data?.hr_private_notes || [];
  const isLocked = String((guard as any)?.status || '').toLowerCase() === 'interviewing';
  const isPending = String((guard as any)?.status || '').toLowerCase() === 'marketplace';
  const interviewSchedule = (guard.dossier_data as any)?.interview_schedule as { date?: string; location?: string } | undefined;

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Notice Board</h2>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3">HR Communications & News</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Public SMS</p>
          <div className="space-y-3">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-sm font-black text-slate-900">New Protocol Update</p>
              <p className="text-xs text-slate-600 mt-1">All guards must review the updated incident reporting protocols by end of week.</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-sm font-black text-slate-900">Monthly Performance Review</p>
              <p className="text-xs text-slate-600 mt-1">Supervisors will be conducting individual performance reviews throughout May.</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-sm font-black text-slate-900">Global Security Alert</p>
              <p className="text-xs text-slate-600 mt-1">Increased vigilance advised due to regional instability.</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Private Notice</p>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-sm font-medium text-slate-900">{(privateNotes[privateNotes.length - 1]?.note) || 'Hakuna ujumbe binafsi kwa sasa.'}</p>
          </div>
        </div>
      </div>

      {/* Private Notices (HR direct messages) */}
      <div className="space-y-6">
        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          Private Notices
        </h3>

        {(hasHRNote || isLocked || isPending || privateNotes.length > 0) ? (
            <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                        </div>
                        <div>
                            <h4 className="text-sm font-black uppercase tracking-tight">HR Department</h4>
                            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                                {isLocked ? 'Interview Call' : isPending ? 'Deployment Update' : 'Application Update'}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                      {privateNotes.length > 0 && (
                        <div className="bg-white/10 border border-white/5 rounded-2xl p-6">
                          <p className="text-xs font-black uppercase tracking-widest text-white/70 mb-3">Messages from HR</p>
                          <div className="space-y-3">
                            {privateNotes.map(n => (
                              <div key={n.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <p className="text-sm font-medium leading-relaxed">{n.note}</p>
                                <p className="text-[10px] text-white/40 mt-2">{new Date(n.created_at).toLocaleString()}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="bg-white/10 border border-white/5 rounded-2xl p-6">
                        {guard.dossier_data?.interviewer_notes ? (
                          <p className="text-sm font-medium leading-relaxed italic">"{guard.dossier_data.interviewer_notes}"</p>
                        ) : (
                          <p className="text-sm font-medium leading-relaxed opacity-70">
                            {isLocked 
                              ? "Your profile has been shortlisted. Please report to the office for vetting." 
                              : "Your application is currently under review by our operations team."}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {interviewSchedule?.date && (
                      <div className="bg-white/10 border border-white/5 rounded-2xl p-6 mb-4">
                        <p className="text-xs font-black uppercase tracking-widest text-white/70">Interview Details</p>
                        <div className="mt-2 text-sm">
                          <p><span className="font-bold">Date:</span> {new Date(interviewSchedule.date).toLocaleString()}</p>
                          <p><span className="font-bold">Location:</span> {interviewSchedule.location || 'Company Office'}</p>
                        </div>
                      </div>
                    )}
                    
                    <p className="text-[9px] font-mono text-white/30 text-right">
                        REF: {guard.id.toUpperCase()}
                    </p>
                </div>
            </div>
        ) : (
            <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2rem] text-center">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No new messages from HR</p>
            </div>
        )}
      </div>

      {/* Public Notices */}
      <div className="space-y-6">
        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 bg-primary rounded-full"></span>
          Public Notices
        </h3>
        <div className="space-y-4">
          {announcements.length === 0 ? (
            <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2rem] text-center">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No public notices</p>
            </div>
          ) : (
            announcements.map(a => (
              <div key={a.id} className="bg-white p-6 rounded-2xl border border-slate-200">
                <p className="text-sm font-black text-slate-900">{a.title}</p>
                <p className="text-xs text-slate-600 mt-2">{a.body}</p>
                <p className="text-[10px] text-slate-400 mt-2">{new Date(a.created_at).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </div>
      {/* General News */}
      <div className="space-y-6">
        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Company News</h3>
        {announcements.length > 0 ? (
            announcements.map(ann => (
                <div key={ann.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-md uppercase tracking-widest">General</span>
                        <span className="text-[9px] font-mono text-slate-400">{new Date(ann.created_at).toLocaleDateString()}</span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-2">{ann.title}</h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">{ann.content}</p>
                </div>
            ))
        ) : (
            <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2rem] text-center">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No public announcements</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default NoticeBoard;
