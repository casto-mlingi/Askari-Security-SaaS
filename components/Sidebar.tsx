
import React from 'react';
import { UserRole } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: UserRole;
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

const getNavItems = (role: UserRole): NavItem[] => {
  const all: NavItem[] = [
    { label: 'Dashboard', icon: 'Dashboard', tab: 'overview' },
    { label: 'Intake', icon: 'Register', tab: 'intake' },
    { label: 'Vetting', icon: 'Applicants', tab: 'vetting' },
    { label: 'Interview Report', icon: 'Report', tab: 'interview-report' },
    { label: 'Procurement', icon: 'Procurement', tab: 'procurement' },
    { label: 'Operations', icon: 'Operations', tab: 'operations' },
    { label: 'Tactical Monitor', icon: 'Monitor', tab: 'tactical-monitor' },
    { label: 'Disciplinary', icon: 'Disciplinary', tab: 'disciplinary' },
    { label: 'Sites', icon: 'Sites', tab: 'sites' },
    { label: 'Blacklist', icon: 'Blacklist', tab: 'blacklist' },
    { label: 'Personnel', icon: 'Registry', tab: 'registry' },
    { label: 'Companies', icon: 'Companies', tab: 'companies' },
  ];

  switch (role) {
    case UserRole.SUPER_ADMIN:
      return all;
    case UserRole.COMPANY_ADMIN:
      return all.filter(item => item.tab !== 'companies');
    case UserRole.HR_OFFICER:
      return all.filter(item => ['overview', 'intake', 'vetting', 'interview-report', 'disciplinary', 'blacklist', 'registry'].includes(item.tab));
    case UserRole.PROCUREMENT:
      return all.filter(item => ['overview', 'procurement'].includes(item.tab));
    case UserRole.SUPERVISOR:
      return all.filter(item => ['overview', 'operations', 'tactical-monitor'].includes(item.tab));
    default:
      return [];
  }
};

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, userRole }) => {
  const navItems = getNavItems(userRole);
  const isAdmin = [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN].includes(userRole);

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
        className={`flex items-center gap-4 px-6 py-4 rounded-xl transition-all font-bold ${
          isActive
            ? 'bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
            : 'text-slate-400 hover:text-white hover:bg-white/5'
        }`}
      >
        <Icon className="w-6 h-6" />
        <span className="text-sm tracking-tight">{item.label}</span>
      </a>
    );
  };

  return (
    <aside className="h-full sidebar-gradient flex flex-col p-6 text-white no-scrollbar">
      <div className="flex items-center gap-3 mb-12 shrink-0">
        <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/10">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
        </div>
        <div>
          <h1 className="font-black text-xl leading-none tracking-tight">ASKARI</h1>
          <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">SaaS</p>
        </div>
      </div>

      <nav className="flex-grow space-y-2 overflow-y-auto pr-2 -mr-2">
        {navItems.map(renderNavItem)}
      </nav>

      {isAdmin && (
        <div className="mt-12 pt-8 border-t border-white/10 shrink-0">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">System</p>
          <div className="space-y-2">
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setActiveTab('architecture'); }}
              className={`flex items-center gap-4 px-6 py-4 rounded-xl transition-all font-bold ${
                activeTab === 'architecture'
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ICONS.Registry className="w-6 h-6" />
              <span className="text-sm">Architecture</span>
            </a>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setActiveTab('erd-view'); }}
              className={`flex items-center gap-4 px-6 py-4 rounded-xl transition-all font-bold ${
                activeTab === 'erd-view'
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ICONS.Database className="w-6 h-6" />
              <span className="text-sm">ERD View</span>
            </a>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setActiveTab('sql-schema'); }}
              className={`flex items-center gap-4 px-6 py-4 rounded-xl transition-all font-bold ${
                activeTab === 'sql-schema'
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ICONS.Operations className="w-6 h-6" />
              <span className="text-sm">SQL Schema</span>
            </a>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
