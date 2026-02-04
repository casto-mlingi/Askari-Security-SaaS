
import React, { useState, useMemo } from 'react';
import { Profile, Company, UserRole, Guard, ApplicationStatus, Site } from '../types';

interface PersonnelRegistryProps {
  profiles: Profile[];
  guards: Guard[];
  companies: Company[];
  sites: Site[];
  onUpdateStaff: (staffId: string, updates: Partial<Profile>) => void;
  onAddStaff: (staffData: Omit<Profile, 'id' | 'created_at' | 'is_active'>) => void;
  onViewGuardAudit: (guard: Guard) => void;
  currentUser: Profile;
}

const getRoleBadge = (role: UserRole) => {
    const styles: Record<string, string> = {
      [UserRole.SUPER_ADMIN]: 'bg-slate-900 text-white border-slate-700',
      [UserRole.COMPANY_ADMIN]: 'bg-slate-800 text-white border-slate-600',
      [UserRole.HR_OFFICER]: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      [UserRole.PROCUREMENT]: 'bg-amber-50 text-amber-700 border-amber-100',
      [UserRole.SUPERVISOR]: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      [UserRole.GUARD]: 'bg-slate-50 text-slate-500 border-slate-200',
    };
    return (
      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${styles[role] || styles[UserRole.GUARD]}`}>
        {role.replace('_', ' ')}
      </span>
    );
};

const PersonnelRegistry: React.FC<PersonnelRegistryProps> = ({
  profiles,
  guards,
  companies,
  sites,
  onUpdateStaff,
  onAddStaff,
  onViewGuardAudit,
  currentUser
}) => {
  const [view, setView] = useState<'staff' | 'guards'>('staff');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form State
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.SUPERVISOR);
  const [newPassword, setNewPassword] = useState('');
  const [selectedCompanyForStaff, setSelectedCompanyForStaff] = useState<string>('');

  const isSuperAdmin = currentUser.role === UserRole.SUPER_ADMIN;
  // If Super Admin, company_id is undefined/null. If Tenant Admin, it is their company ID.
  const currentCompanyId = currentUser.company_id;

  // Filter Data based on Tenant Isolation logic
  const filteredProfiles = useMemo(() => {
    let data = profiles;
    
    // Strict isolation: if not super admin, filter by the current user's company_id
    if (!isSuperAdmin && currentCompanyId) {
      data = data.filter(p => p.company_id === currentCompanyId);
    }
    // If Super Admin, 'data' remains all profiles (cross-company visibility)

    return data.filter(p => 
      p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [profiles, isSuperAdmin, currentCompanyId, searchTerm]);

  const filteredGuards = useMemo(() => {
    let data = guards;
    
    // Strict isolation for guards as well
    if (!isSuperAdmin && currentCompanyId) {
      data = data.filter(g => g.company_id === currentCompanyId);
    }
    // If Super Admin, 'data' includes all guards

    return data.filter(g => 
      g.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      g.nida_number.includes(searchTerm)
    );
  }, [guards, isSuperAdmin, currentCompanyId, searchTerm]);

  const availableRoles = useMemo(() => {
    if (isSuperAdmin) {
       // Super Admins can create Company Admins or other staff types
       return [UserRole.COMPANY_ADMIN, UserRole.HR_OFFICER, UserRole.PROCUREMENT, UserRole.SUPERVISOR];
    }
    // Tenant Admins can only provision operational roles for their own company
    return [UserRole.SUPERVISOR, UserRole.PROCUREMENT, UserRole.HR_OFFICER];
  }, [isSuperAdmin]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPassword) {
        alert("All fields including password are required.");
        return;
    }
    
    // Determine the target company for the new staff member
    // If Super Admin, use the selected company from dropdown.
    // If Tenant Admin, use their own company ID.
    const targetCompanyId = isSuperAdmin ? selectedCompanyForStaff : currentCompanyId;

    if (!targetCompanyId && !isSuperAdmin) {
        // Should not happen for Tenant Admin due to schema constraints, but good for safety
        alert("System Error: Tenant Context ID missing.");
        return;
    }
    
    if (isSuperAdmin && !targetCompanyId) {
        alert("Please select a company to assign this staff member to.");
        return;
    }

    setIsSyncing(true);
    await new Promise(r => setTimeout(r, 1000));

    onAddStaff({
        full_name: newName,
        email: newEmail,
        role: newRole,
        company_id: targetCompanyId || undefined,
        password: newPassword
    });

    setIsSyncing(false);
    setIsAddModalOpen(false);
    
    // Reset form
    setNewName(''); 
    setNewEmail(''); 
    setNewPassword(''); 
    setNewRole(UserRole.SUPERVISOR); 
    setSelectedCompanyForStaff('');
  };

  const getSiteName = (siteId?: string) => sites.find(s => s.id === siteId)?.name || 'Unassigned';
  const getCompanyName = (companyId?: string) => companies.find(c => c.id === companyId)?.name || 'System';

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-24 animate-in fade-in duration-500">
      <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-10">
        <div>
           <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Personnel Registry</h2>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-4">Manage Staff Access & Security Roster</p>
        </div>
        
        <div className="flex gap-4">
            <div className="bg-slate-100 p-1.5 rounded-2xl flex border border-slate-200 shadow-inner">
                <button onClick={() => setView('staff')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'staff' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Staff</button>
                <button onClick={() => setView('guards')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'guards' ? 'bg-white text-primary shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Guards</button>
            </div>
            {view === 'staff' && (
                <button onClick={() => setIsAddModalOpen(true)} className="px-6 py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-primary transition-all active:scale-95 shadow-xl">
                    + Add Staff
                </button>
            )}
        </div>
      </div>

      <div className="relative">
          <svg className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="3"/></svg>
          <input 
            type="text" 
            placeholder={view === 'staff' ? "Search administrative staff..." : "Search security guards..."}
            className="w-full h-16 pl-16 pr-8 bg-white border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest outline-none focus:border-primary transition-all shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
      </div>

      {view === 'staff' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProfiles.map(profile => (
                <div key={profile.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                             <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center font-black text-xl group-hover:bg-slate-900 group-hover:text-white transition-colors duration-300">
                                {profile.full_name[0]}
                             </div>
                             <div>
                                <h4 className="font-black text-slate-900 uppercase tracking-tight text-lg leading-none">{profile.full_name}</h4>
                                <p className="text-[10px] font-bold text-slate-400 mt-1 lowercase">{profile.email}</p>
                             </div>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-slate-50">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Role</span>
                            {getRoleBadge(profile.role)}
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-50">
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Company</span>
                             <span className="text-xs font-bold text-slate-700">{getCompanyName(profile.company_id)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</span>
                             <span className={`text-[10px] font-black uppercase tracking-widest ${profile.is_active ? 'text-emerald-500' : 'text-red-500'}`}>{profile.is_active ? 'Active' : 'Inactive'}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredGuards.map(guard => (
                 <div key={guard.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                             <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-black text-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
                                {guard.full_name[0]}
                             </div>
                             <div>
                                <h4 className="font-black text-slate-900 uppercase tracking-tight text-lg leading-none">{guard.full_name}</h4>
                                <p className="text-[10px] font-mono font-bold text-slate-400 mt-1">{guard.nida_number.slice(0, 15)}...</p>
                             </div>
                        </div>
                    </div>
                    
                    <div className="space-y-4 mb-6">
                        <div className="flex justify-between items-center py-2 border-b border-slate-50">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</span>
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                                guard.application_status === ApplicationStatus.ACTIVE ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                'bg-slate-50 text-slate-500 border-slate-200'
                            }`}>{guard.application_status.replace('_', ' ')}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-50">
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Site</span>
                             <span className="text-xs font-bold text-slate-700">{getSiteName(guard.current_site_id)}</span>
                        </div>
                        {isSuperAdmin && (
                            <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Company</span>
                                <span className="text-xs font-bold text-slate-700">{getCompanyName(guard.company_id)}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center py-2">
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reliability</span>
                             <span className={`text-sm font-black font-hud ${guard.performance_score! < 80 ? 'text-amber-500' : 'text-emerald-600'}`}>{guard.performance_score || 0}%</span>
                        </div>
                    </div>
                    
                    <button onClick={() => onViewGuardAudit(guard)} className="w-full py-4 bg-slate-50 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-900 hover:text-white transition-all">
                        View Dossier
                    </button>
                 </div>
            ))}
        </div>
      )}

      {/* Add Staff Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[1200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-10 space-y-8 border border-white/20">
              <div className="text-center">
                 <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">New Staff Member</h3>
                 <p className="text-sm font-medium text-slate-500 mt-2">Provision access for administrative personnel.</p>
              </div>
              <form onSubmit={handleAddSubmit} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Full Name</label>
                    <input value={newName} onChange={e => setNewName(e.target.value)} required className="w-full h-14 px-6 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold uppercase outline-none focus:border-primary transition-all" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Email Address</label>
                    <input value={newEmail} onChange={e => setNewEmail(e.target.value)} required type="email" className="w-full h-14 px-6 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all" />
                 </div>
                 
                 {isSuperAdmin && (
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Assign Company</label>
                        <select 
                            value={selectedCompanyForStaff} 
                            onChange={e => setSelectedCompanyForStaff(e.target.value)}
                            className="w-full h-14 px-6 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all appearance-none"
                        >
                            <option value="">-- Select Tenant --</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                 )}

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">System Role</label>
                    <select 
                        value={newRole} 
                        onChange={e => setNewRole(e.target.value as UserRole)}
                        className="w-full h-14 px-6 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold uppercase outline-none focus:border-primary transition-all appearance-none"
                    >
                        {availableRoles.map(role => (
                            <option key={role} value={role}>{role.replace('_', ' ')}</option>
                        ))}
                    </select>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Temporary Password</label>
                    <input value={newPassword} onChange={e => setNewPassword(e.target.value)} required type="password" placeholder="••••••••" className="w-full h-14 px-6 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all" />
                 </div>

                 <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all">Cancel</button>
                    <button type="submit" disabled={isSyncing} className="flex-1 py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary shadow-xl active:scale-95 transition-all">
                       {isSyncing ? 'Provisioning...' : 'Create Account'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelRegistry;
