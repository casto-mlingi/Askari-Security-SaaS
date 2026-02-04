
import React from 'react';
import { Guard, Announcement, ApplicationStatus } from '../types';

interface NoticeBoardProps {
  guard: Guard;
  announcements: Announcement[];
}

const NoticeBoard: React.FC<NoticeBoardProps> = ({ guard, announcements }) => {
  const hasHRNote = guard.dossier_data?.interviewer_notes;
  const isLocked = guard.application_status === ApplicationStatus.INTERVIEW_LOCKED;
  const isPending = guard.application_status === ApplicationStatus.PROCUREMENT_PENDING;

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Notice Board</h2>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3">HR Communications & News</p>
      </div>

      {/* HR Directives / Interview Calls */}
      <div className="space-y-6">
        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
          Direct Messages
        </h3>

        {(hasHRNote || isLocked || isPending) ? (
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

                    <div className="bg-white/10 border border-white/5 rounded-2xl p-6 mb-4">
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
