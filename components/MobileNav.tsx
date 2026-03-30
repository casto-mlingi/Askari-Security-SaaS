
import React from 'react';
import { Guard, Profile } from '../types';

interface MobileNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: Profile | Guard | null;
}

const MobileNav: React.FC<MobileNavProps> = ({ activeTab, setActiveTab, currentUser }) => {
  if (!currentUser) return null;

  const isGuard = !('role' in currentUser); // Check if it's a Guard object
  if (!isGuard) return null; // Staff uses desktop sidebar structure mostly, or different mobile nav if needed

  const guard = currentUser as Guard;
  const isActiveGuard = String((guard as any)?.status || '').toLowerCase() === 'active';

  // Tabs for "Hold Applicant"
  const applicantTabs = [
    { 
      id: 'application-status', 
      label: 'Status', 
      icon: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> 
    },
    { 
      id: 'profile-update', 
      label: 'My Profile', 
      icon: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> 
    },
    { 
      id: 'notice-board', 
      label: 'Notices', 
      icon: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg> 
    },
  ];

  // Tabs for "Active Guard"
  const activeGuardTabs = [
    { 
      id: 'overview', 
      label: 'Profile', 
      icon: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> 
    },
    { 
      id: 'operations', 
      label: 'Operations', 
      icon: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> 
    },
    { 
      id: 'support', 
      label: 'Help', 
      icon: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg> 
    },
  ];

  const tabs = isActiveGuard ? activeGuardTabs : applicantTabs;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-white/95 backdrop-blur-xl border-t border-border-light flex items-center justify-around px-4 z-[120] safe-bottom shadow-[0_-8px_32px_rgba(0,0,0,0.12)] mobile-optimized">
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex flex-col items-center gap-1.5 transition-all duration-300 relative group flex-1 max-w-20 mobile-optimized ${
            activeTab === tab.id ? 'text-primary' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          {/* Active indicator */}
          <div className={`absolute -top-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-primary rounded-full transition-all duration-300 ${
            activeTab === tab.id ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
          }`} />

          {/* Icon container */}
          <div className={`p-2.5 rounded-2xl transition-all duration-300 relative ${
            activeTab === tab.id
              ? 'bg-primary/15 shadow-lg shadow-primary/20 scale-110'
              : 'bg-surface-secondary hover:bg-background-secondary group-active:scale-95'
          }`}>
            <tab.icon className={`w-6 h-6 transition-all duration-300 ${
              activeTab === tab.id ? 'scale-110' : 'group-hover:scale-105'
            }`} />

            {/* Active glow effect */}
            {activeTab === tab.id && (
              <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-pulse" />
            )}
          </div>

          {/* Label */}
          <span className={`text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${
            activeTab === tab.id ? 'text-primary' : 'text-text-muted group-hover:text-text-secondary'
          }`}>
            {tab.label}
          </span>

          {/* Ripple effect on touch */}
          <div className="absolute inset-0 rounded-lg opacity-0 group-active:opacity-20 bg-primary transition-opacity duration-150" />
        </button>
      ))}
    </div>
  );
};

export default MobileNav;
