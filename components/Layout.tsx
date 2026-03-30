
import React, { useEffect, useState } from 'react';
import { UserRole, Profile, Guard } from '../types';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import DBStatus from './DBStatus';
import { api } from '../services/api';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: UserRole | null;
  onLogout: () => void;
  companyName?: string;
  currentUser?: Profile | Guard | null;
  unreadAlertsCount?: number;
  noticesPublicCount?: number;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, userRole, onLogout, companyName, currentUser, unreadAlertsCount, noticesPublicCount }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    const s = String(((currentUser as any)?.status) || '').toLowerCase();
    const guardInactive = userRole === UserRole.GUARD && s !== 'active';
    return guardInactive || (!!currentUser && 'role' in (currentUser as any) && String((currentUser as Profile)?.role || '').toLowerCase() === 'applicant');
  });
  const isGuard = userRole === UserRole.GUARD;
  const isSuperAdmin = userRole === UserRole.SUPER_ADMIN;
  const isApplicant = !!currentUser && 'role' in (currentUser as any) && String((currentUser as Profile)?.role || '').toLowerCase() === 'applicant';
  
  
  // Define what the "Home" tab is for different roles to decide when to show the Back button
  // For a guard, if they are active, home is 'overview'. If applicant, 'application-status'.
  const homeTab = isGuard 
    ? (String(((currentUser as any)?.status) || '').toLowerCase() === 'active') ? 'overview' : 'application-status' 
    : (isApplicant ? 'application-status' : 'overview');
    
  const showBackButton = activeTab !== homeTab;

  const handleBack = () => {
    setActiveTab(homeTab);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden mobile-scroll">
      {/* Desktop Sidebar */}
      {((!isGuard && userRole) || (isGuard && String(((currentUser as any)?.status) || '').toLowerCase() !== 'active')) && (
        <div className={`fixed lg:static inset-y-0 left-0 w-72 z-[110] transform transition-all duration-300 ease-out lg:translate-x-0 shadow-2xl lg:shadow-none ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <Sidebar activeTab={activeTab} setActiveTab={(t) => { setActiveTab(t); setIsSidebarOpen(false); }} userRole={userRole as UserRole} currentUser={currentUser} noticesPublicCount={noticesPublicCount} />
        </div>
      )}

      {/* Mobile Drawer Overlay */}
      {isSidebarOpen && ((!isGuard && userRole) || (isGuard && String(((currentUser as any)?.status) || '').toLowerCase() !== 'active')) && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="flex flex-col flex-grow min-w-0">
        <header className="h-16 md:h-20 bg-white/95 backdrop-blur-xl border-b border-border-light flex items-center justify-between px-4 md:px-8 lg:px-12 shrink-0 z-20 shadow-sm">
          <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
            {(!isGuard || (String(((currentUser as any)?.status) || '').toLowerCase() !== 'active')) && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-3 text-text-secondary hover:text-text hover:bg-surface-secondary rounded-xl transition-all duration-200 active:scale-95 mobile-optimized"
                aria-label="Open navigation menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            {/* end mobile menu button */}

            {showBackButton ? (

              <button
                onClick={handleBack}
                className="flex items-center gap-2 md:gap-3 px-4 py-2.5 bg-surface-secondary hover:bg-background-secondary text-text-secondary hover:text-text rounded-xl border border-border transition-all duration-200 group animate-in slide-in-from-left-2 shadow-sm hover:shadow-md active:scale-95"
              >
                <svg className="w-4 h-4 md:w-5 md:h-5 group-hover:-translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Back</span>
              </button>
            ) : (
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className={`hidden md:flex w-2.5 h-2.5 rounded-full animate-pulse ${isSuperAdmin ? 'bg-secondary' : 'bg-success'}`} />
                  <p className="text-[10px] md:text-xs font-bold text-text-muted uppercase tracking-wider hidden sm:block">
                    {isSuperAdmin ? 'System Overwatch' : 'Operational Sector'}
                  </p>
                </div>
                <h2 className="font-black text-lg md:text-xl lg:text-2xl uppercase tracking-tight text-primary truncate leading-none mt-0.5 md:mt-1">
                  {isApplicant || (!('role' in (currentUser as any)) && !(currentUser as Guard)?.company_id) ? 'Marketplace Applicant' : (companyName || 'AMINI System')}
                </h2>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 md:gap-8">
            <div className="hidden lg:block">
              <DBStatus />
            </div>
            
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider leading-none">Access Level</span>
              <span className="text-base font-bold text-text uppercase mt-1 tracking-tight">{userRole?.replace?.('_', ' ') || 'NONE'}</span>
            </div>

            {/* Mobile user indicator */}
            <div className="md:hidden flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${isSuperAdmin ? 'bg-secondary' : 'bg-success'}`} />
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                {userRole?.split('_')[0] || 'USER'}
              </span>
            </div>

            <button
              onClick={() => setActiveTab(isGuard ? 'notice-board' : (isApplicant ? 'application-status' : 'overview'))}
              className="relative w-10 h-10 md:w-12 md:h-12 bg-surface-secondary text-text-muted hover:text-primary hover:bg-primary/5 rounded-xl transition-all duration-200 flex items-center justify-center border border-border hover:border-primary/20 shadow-sm hover:shadow-md group active:scale-95"
              title="Notifications"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {typeof unreadAlertsCount === 'number' && unreadAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-white text-[10px] font-black leading-[18px] text-center border border-white">
                  {unreadAlertsCount > 99 ? '99+' : unreadAlertsCount}
                </span>
              )}
            </button>
            <div className="h-8 md:h-12 w-px bg-border hidden md:block" />
            <button
              onClick={onLogout}
              className="w-10 h-10 md:w-12 md:h-12 bg-surface-secondary text-text-muted hover:text-error hover:bg-error/5 rounded-xl transition-all duration-200 flex items-center justify-center border border-border hover:border-error/20 shadow-sm hover:shadow-md group active:scale-95"
              title="Secure Sign Out"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m-4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        <main className={`flex-grow overflow-y-auto p-4 md:p-8 lg:p-12 ${isGuard ? 'pb-20' : ''} bg-background`}>
          <div className="mb-6 md:mb-10 md:hidden">
             <h2 className="text-2xl md:text-3xl font-black text-text uppercase tracking-tight">{activeTab?.replace(/-/g, ' ') || 'DASHBOARD'}</h2>
          </div>
          {children}
        </main>

        {isGuard && <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} currentUser={currentUser} />}
      </div>
    </div>
  );
};

export default Layout;
