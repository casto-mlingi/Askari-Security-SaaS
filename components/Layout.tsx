
import React, { useState } from 'react';
import { UserRole, Profile, Guard, ApplicationStatus } from '../types';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: UserRole | null;
  onLogout: () => void;
  companyName?: string;
  currentUser?: Profile | Guard | null;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, userRole, onLogout, companyName, currentUser }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isGuard = userRole === UserRole.GUARD;
  const isSuperAdmin = userRole === UserRole.SUPER_ADMIN;
  
  // Define what the "Home" tab is for different roles to decide when to show the Back button
  // For a guard, if they are active, home is 'overview'. If applicant, 'application-status'.
  const homeTab = isGuard 
    ? (currentUser as Guard)?.application_status === ApplicationStatus.ACTIVE ? 'overview' : 'application-status' 
    : 'overview';
    
  const showBackButton = activeTab !== homeTab;

  const handleBack = () => {
    setActiveTab(homeTab);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop Sidebar */}
      {!isGuard && userRole && (
        <div className={`fixed lg:static inset-y-0 left-0 w-72 z-[110] transform transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <Sidebar activeTab={activeTab} setActiveTab={(t) => { setActiveTab(t); setIsSidebarOpen(false); }} userRole={userRole} />
        </div>
      )}

      {/* Mobile Drawer Overlay */}
      {isSidebarOpen && !isGuard && (
        <div className="fixed inset-0 bg-slate-900/40 z-[100] lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <div className="flex flex-col flex-grow min-w-0">
        <header className="h-24 bg-white border-b border-slate-200 flex items-center justify-between px-6 md:px-10 shrink-0 z-20">
          <div className="flex items-center gap-4">
            {!isGuard && (
              <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            )}
            
            {showBackButton ? (
              <button 
                onClick={handleBack}
                className="flex items-center gap-3 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-all group animate-in slide-in-from-left-2"
              >
                <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
                <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
              </button>
            ) : (
              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <span className={`hidden md:block w-2 h-2 rounded-full animate-pulse ${isSuperAdmin ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                    {isSuperAdmin ? 'SYSTEM OVERWATCH' : 'OPERATIONAL SECTOR'}
                  </p>
                </div>
                <h2 className="font-black text-lg md:text-xl uppercase tracking-tighter text-primary truncate leading-none mt-1">
                  {companyName || 'Askari System'}
                </h2>
              </div>
            )}
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Access Clearance</span>
              <span className="text-sm font-black text-slate-900 uppercase mt-1 tracking-tight">{userRole?.replace?.('_', ' ') || 'NONE'}</span>
            </div>
            <div className="h-10 w-px bg-slate-100 hidden md:block" />
            <button onClick={onLogout} className="w-12 h-12 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all flex items-center justify-center border border-slate-100" title="Secure Sign Out">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </header>

        <main className={`flex-grow overflow-y-auto p-6 md:p-10 ${isGuard ? 'pb-24' : ''}`}>
          <div className="mb-8 md:hidden">
             <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{activeTab?.replace(/-/g, ' ') || 'DASHBOARD'}</h2>
          </div>
          {children}
        </main>

        {isGuard && <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} currentUser={currentUser} />}
      </div>
    </div>
  );
};

export default Layout;
