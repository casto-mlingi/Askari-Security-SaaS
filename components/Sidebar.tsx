
import React from 'react';
import { UserRole, Profile, Guard, ApplicationStatus } from '../types';
import AvatarImage from './AvatarImage';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: UserRole;
  currentUser?: Profile | Guard | null;
  noticesPublicCount?: number;
}

const ICONS = {
  Dashboard: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  Applicants: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  Register: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>,
  Operations: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  Procurement: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
  Blacklist: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  Sites: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Monitor: (props: any) => <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  Disciplinary: (props: any) => <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Database: (props: any) => <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>,
  Registry: (props: any) => <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7v8a2 2 0 002 2h4M8 7a2 2 0 012-2h4a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2v-4" /><path d="M16 4h2a2 2 0 012 2v4M4 16v2a2 2 0 002 2h4" /></svg>,
  Companies: (props: any) => <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m-1 4h1m4-8h1m-1 4h1m-1 4h1M9 3v1m6-1v1" /></svg>,
  Report: (props: any) => <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
};

type NavItem = {
  label: string;
  icon: keyof typeof ICONS;
  tab: string;
};

const getNavItems = (role: UserRole, currentUser?: Profile | Guard | null): NavItem[] => {
  const all: NavItem[] = [
    { label: 'Dashboard', icon: 'Dashboard', tab: 'overview' },
    { label: 'Intake', icon: 'Register', tab: 'intake' },
    { label: 'Vetting', icon: 'Applicants', tab: 'vetting' },
    { label: 'Interview Report', icon: 'Report', tab: 'interview-report' },
    { label: 'Procurement', icon: 'Procurement', tab: 'procurement' },
    { label: 'Stock In', icon: 'Procurement', tab: 'stock-in' },
    { label: 'Operations', icon: 'Operations', tab: 'operations' },
    { label: 'Roster', icon: 'Operations', tab: 'roster' },
    { label: 'Tactical Monitor', icon: 'Monitor', tab: 'tactical-monitor' },
    { label: 'Disciplinary', icon: 'Disciplinary', tab: 'disciplinary' },
    { label: 'Sites', icon: 'Sites', tab: 'sites' },
    { label: 'Blacklist', icon: 'Blacklist', tab: 'blacklisted' },
    { label: 'Personnel', icon: 'Registry', tab: 'registry' },
    { label: 'Companies', icon: 'Companies', tab: 'companies' },
  ];

  // Applicant-specific navigation (e.g., sara@amini.co.tz)
  if ((role as unknown as string)?.toLowerCase?.() === 'applicant') {
    return [
      { label: 'Continue With Application', icon: 'Register', tab: 'profile-update' },
      { label: 'Application Status', icon: 'Applicants', tab: 'application-status' },
      { label: 'Notices', icon: 'Monitor', tab: 'notice-board' },
    ];
  }
  // Show applicant-style navigation for Guard accounts that are not ACTIVE yet
  if (currentUser && !('role' in (currentUser as any))) {
    const g = currentUser as Guard;
    if (String((g as any)?.status || '').toLowerCase() !== 'active') {
      return [
        { label: 'Continue With Application', icon: 'Register', tab: 'profile-update' },
        { label: 'Application Status', icon: 'Applicants', tab: 'application-status' },
        { label: 'Notices', icon: 'Monitor', tab: 'notice-board' },
      ];
    }
  }

  // System HR role
  if (role === UserRole.SYSTEM_HR) {
    return [
      { label: 'Dashboard', icon: 'Dashboard', tab: 'overview' },
      { label: 'Wait for Approval', icon: 'Applicants', tab: 'wait-approval' },
      { label: 'Vetting', icon: 'Applicants', tab: 'vetting' },
      { label: 'Interview Report', icon: 'Report', tab: 'interview-report' },
      { label: 'Blacklist', icon: 'Blacklist', tab: 'blacklisted' },
      { label: 'Personnel', icon: 'Registry', tab: 'registry' },
    ];
  }
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return [
        ...all,
        { label: 'Wait for Approval', icon: 'Applicants', tab: 'wait-approval' },
      ];
    case UserRole.COMPANY_ADMIN:
      return all.filter(item => item.tab !== 'companies');
    case UserRole.HR_OFFICER:
      return [
        { label: 'Dashboard', icon: 'Dashboard', tab: 'overview' },
        { label: 'Intake', icon: 'Register', tab: 'intake' },
        { label: 'Vetting', icon: 'Applicants', tab: 'vetting' },
        { label: 'Interview Report', icon: 'Report', tab: 'interview-report' },
        { label: 'Roster', icon: 'Operations', tab: 'roster' },
        { label: 'Disciplinary', icon: 'Disciplinary', tab: 'disciplinary' },
        { label: 'Blacklist', icon: 'Blacklist', tab: 'blacklisted' },
        { label: 'Personnel', icon: 'Registry', tab: 'registry' },
      ];
    case UserRole.PROCUREMENT:
      return all.filter(item => ['overview', 'procurement', 'stock-in'].includes(item.tab));
    case UserRole.SUPERVISOR:
      return all.filter(item => ['overview', 'operations', 'roster', 'tactical-monitor', 'blacklisted'].includes(item.tab));
    case UserRole.REG_OFFICER:
      return [
        { label: 'Intake', icon: 'Register', tab: 'intake' },
        { label: 'Interview Report', icon: 'Report', tab: 'interview-report' },
      ];
    default:
      return [];
  }
};

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, userRole, currentUser, noticesPublicCount }) => {
  const navItems = getNavItems(userRole, currentUser);
  const isAdmin = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN].includes(userRole);
  const guardUser = currentUser && !('role' in (currentUser as any)) ? (currentUser as Guard) : undefined;
  const privateNotesCount = guardUser ? ((guardUser.dossier_data as any)?.hr_private_notes?.length || 0) : 0;

  const renderNavItem = (item: NavItem) => {
    const Icon = ICONS[item.icon];
    const isActive = activeTab === item.tab;
    return (
      <a
        key={item.tab}
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setActiveTab(item.tab);
        }}
        className={`flex items-center gap-4 px-6 py-4 rounded-xl transition-all duration-200 font-semibold group relative overflow-hidden ${isActive
            ? 'bg-white/15 text-white shadow-lg shadow-white/10 border border-white/20'
            : 'text-white/80 hover:text-white hover:bg-white/10 hover:shadow-md'
          }`}
      >
        <Icon className="w-6 h-6" />
        <span className="text-sm tracking-tight">{item.label}</span>
        {item.tab === 'notice-board' && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/10 border border-white/20">
              {`Public ${typeof noticesPublicCount === 'number' ? (noticesPublicCount > 99 ? '99+' : noticesPublicCount) : 3}`}
            </span>
            <span className={`relative text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${privateNotesCount > 0 ? 'bg-red-500/20 text-white border border-red-500/30' : 'bg-white/10 border border-white/20'}`}>
              {`Private ${privateNotesCount}`}
              {privateNotesCount > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
            </span>
          </div>
        )}
      </a>
    );
  };

  return (
    <aside className="h-full sidebar-gradient flex flex-col p-8 text-white relative overflow-y-auto">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none"></div>
      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-16 shrink-0">
          <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-xl border border-white/20 group-hover:scale-105 transition-transform duration-200">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="font-black text-2xl leading-none tracking-tight bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">AMINI</h1>
            <p className="text-white/70 text-xs font-semibold tracking-wider uppercase mt-1">Security Platform</p>
          </div>
        </div>
        {currentUser && (
          <div className="flex items-center gap-3 mb-6">
            {guardUser ? (
              <AvatarImage filename={guardUser.passport_photo_url} alt={guardUser.full_name} fallbackLetter={guardUser.full_name?.[0] || 'G'} className="w-10 h-10 rounded-full object-cover border border-white/20" />
            ) : (
              <AvatarImage filename={(currentUser as Profile).avatar_url as string} alt={(currentUser as Profile).full_name} fallbackLetter={(currentUser as Profile).full_name?.[0] || 'U'} className="w-10 h-10 rounded-full object-cover border border-white/20" />
            )}
            <div>
              <p className="text-sm font-bold">{(currentUser as any).full_name || 'User'}</p>
              <p className="text-[10px] uppercase tracking-widest text-white/60">{('role' in (currentUser as any)) ? (currentUser as Profile).role : 'applicant'}</p>
            </div>
          </div>
        )}

        <nav className="flex-grow space-y-3 overflow-y-auto pr-3 -mr-3">
          <div className="space-y-2">
            {navItems.map((item, index) => (
              <div key={item.tab} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                {renderNavItem(item)}
              </div>
            ))}
          </div>
        </nav>



        {isAdmin && (
          <div className="mt-16 pt-8 border-t border-white/20 shrink-0">
            <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-6 px-2">System Tools</p>
            <div className="space-y-2">
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveTab('architecture'); }}
                className={`flex items-center gap-4 px-6 py-4 rounded-xl transition-all duration-200 font-semibold group ${activeTab === 'architecture'
                    ? 'bg-white/15 text-white shadow-lg shadow-white/10 border border-white/20'
                    : 'text-white/80 hover:text-white hover:bg-white/10 hover:shadow-md'
                  }`}
              >
                <ICONS.Registry className="w-6 h-6 group-hover:scale-110 transition-transform" />
                <span className="text-sm tracking-tight">Architecture</span>
              </a>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveTab('erd-view'); }}
                className={`flex items-center gap-4 px-6 py-4 rounded-xl transition-all duration-200 font-semibold group ${activeTab === 'erd-view'
                    ? 'bg-white/15 text-white shadow-lg shadow-white/10 border border-white/20'
                    : 'text-white/80 hover:text-white hover:bg-white/10 hover:shadow-md'
                  }`}
              >
                <ICONS.Database className="w-6 h-6 group-hover:scale-110 transition-transform" />
                <span className="text-sm tracking-tight">ERD View</span>
              </a>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setActiveTab('sql-schema'); }}
                className={`flex items-center gap-4 px-6 py-4 rounded-xl transition-all duration-200 font-semibold group ${activeTab === 'sql-schema'
                    ? 'bg-white/15 text-white shadow-lg shadow-white/10 border border-white/20'
                    : 'text-white/80 hover:text-white hover:bg-white/10 hover:shadow-md'
                  }`}
              >
                <ICONS.Operations className="w-6 h-6 group-hover:scale-110 transition-transform" />
                <span className="text-sm tracking-tight">SQL Schema</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
