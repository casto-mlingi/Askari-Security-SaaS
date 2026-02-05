import React, { useState, useMemo } from 'react';
import { Company, UserRole, Profile, Guard, ApplicationStatus, IncidentReport } from '../types';

interface CompanyRegistryProps {
  companies: Company[];
  profiles: Profile[];
  guards: Guard[];
  incidents: IncidentReport[];
  onAddCompany: (company: Omit<Company, 'id' | 'created_at' | 'is_active'>) => void;
  onUpdateCompany: (id: string, updates: Partial<Company>) => void;
  onAddStaff: (staff: Omit<Profile, 'id' | 'created_at' | 'is_active'>) => void;
  onToggleActive: (id: string) => void;
}

const CompanyRegistry: React.FC<CompanyRegistryProps> = ({ 
  companies, 
  profiles, 
  guards,
  incidents,
  onAddCompany, 
  onUpdateCompany,
  onAddStaff, 
  onToggleActive 
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState<Company | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState<Company | null>(null);
  
  // Company Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  
  // Admin Provisioning State
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  const [isSyncing, setIsSyncing] = useState(false);

  const drillDownCompany = useMemo(() => 
    companies.find(c => c.id === selectedCompanyId), 
    [companies, selectedCompanyId]
  );

  const drillDownData = useMemo(() => {
    if (!selectedCompanyId) return null;
    const companyStaff = profiles.filter(p => p.company_id === selectedCompanyId);
    const companyGuards = guards.filter(g => g.company_id === selectedCompanyId);
    
    return {
      staff: companyStaff,
      activeGuards: companyGuards.filter(g => g.application_status === ApplicationStatus.ACTIVE),
      pendingInterview: companyGuards.filter(g => g.application_status === ApplicationStatus.INTERVIEW_LOCKED),
      blacklisted: companyGuards.filter(g => g.application_status === ApplicationStatus.BLACKLISTED),
      incidentCount: incidents.filter(i => {
        const guard = guards.find(g => g.id === i.guard_id);
        return guard?.company_id === selectedCompanyId;
      }).length
    };
  }, [selectedCompanyId, profiles, guards, incidents]);

  const handleSubmitCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug || !email) return;
    setIsSyncing(true);
    await new Promise(r => setTimeout(r, 1000));
    onAddCompany({ name, slug, contact_email: email });
    setIsSyncing(false);
    setShowAdd(false);
    setName(''); setSlug(''); setEmail('');
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showSettingsModal || !name || !email) return;
    setIsSyncing(true);
    await new Promise(r => setTimeout(r, 800));
    onUpdateCompany(showSettingsModal.id, { name, contact_email: email });
    setIsSyncing(false);
    setShowSettingsModal(null);
  };

  const handleProvisionAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAdminModal || !adminName || !adminEmail || !adminPassword) return;
    setIsSyncing(true);
    await new Promise(r => setTimeout(r, 1200));
    
    onAddStaff({
      full_name: adminName,
      email: adminEmail,
      role: UserRole.COMPANY_ADMIN,
      company_id: showAdminModal.id,
      password: adminPassword, // Pass password for mock login
    });
    
    setIsSyncing(false);
    setShowAdminModal(null);
    setAdminName(''); setAdminEmail(''); setAdminPassword('');
  };

  const openSettings = (e: React.MouseEvent, company: Company) => {
    e.stopPropagation();
    setName(company.name);
    setEmail(company.contact_email);
    setShowSettingsModal(company);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-24 animate-in fade-in duration-500">
      <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-10">
        <div>
           <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Company Registry</h2>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-4">Master Tenant Management & Infrastructure</p>
        </div>
        <button 
          onClick={() => setShowAdd(true)}
          className="px-10 py-5 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-2xl hover:bg-primary transition-all active:scale-95 flex items-center gap-3"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth="3"/></svg>
          Register New Company
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {companies.map(company => {
          const companyAdmins = profiles.filter(p => p.company_id === company.id && p.role === UserRole.COMPANY_ADMIN);
          return (
            <div 
              key={company.id} 
              onClick={() => setSelectedCompanyId(company.id)}
              className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm hover:shadow-2xl transition-all group flex flex-col h-full cursor-pointer relative"
            >
              <div className="flex justify-between items-start mb-8">
                <div className="w-16 h-16 bg-slate-950 text-primary rounded-[1.5rem] flex items-center justify-center font-black text-2xl shadow-xl ring-4 ring-slate-100">
                  {company.name[0]}
                </div>
                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${company.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                  {company.is_active ? 'ACTIVE NODE' : 'OFFLINE'}
                </span>
              </div>
              
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2 leading-none">{company.name}</h3>
              <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-6">Slug: /{company.slug}</p>
              
              <div className="space-y-4 flex-grow">
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeWidth="2.5"/></svg>
                    <p className="text-xs font-bold text-slate-600 truncate">{company.contact_email}</p>
                 </div>
                 <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Primary Admin</p>
                    {companyAdmins.length > 0 ? (
                      <p className="text-xs font-bold text-slate-800">{companyAdmins[0].full_name}</p>
                    ) : (
                      <p className="text-xs font-bold text-red-400 uppercase italic">No Admin Assigned</p>
                    )}
                 </div>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                 <button 
                  onClick={(e) => { e.stopPropagation(); setShowAdminModal(company); }}
                  className="w-full py-4 bg-primary/10 text-primary font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2"
                 >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth="2.5"/></svg>
                    Provision Admin
                 </button>
                 <div className="flex gap-3">
                   <button 
                    onClick={(e) => openSettings(e, company)}
                    className="flex-grow py-3 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all active:scale-95"
                   >
                    Settings
                   </button>
                   <button 
                    onClick={(e) => { e.stopPropagation(); onToggleActive(company.id); }}
                    className={`flex-grow py-3 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95 ${company.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                   >
                     {company.is_active ? 'Suspend' : 'Activate'}
                   </button>
                 </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Drill-down Modal */}
      {selectedCompanyId && drillDownCompany && drillDownData && (
        <div className="fixed inset-0 z-[1100] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-0 md:p-8 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-6xl h-full md:h-[90vh] md:rounded-[4rem] shadow-2xl flex flex-col overflow-hidden border border-white/20">
              <div className="p-10 border-b-2 border-slate-100 flex justify-between items-center bg-slate-950 text-white shadow-xl">
                 <div className="flex items-center gap-8">
                    <div className="w-20 h-20 bg-primary text-white rounded-[2rem] flex items-center justify-center font-black text-3xl shadow-2xl">{drillDownCompany.name[0]}</div>
                    <div>
                       <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-3">Tenant Operational Audit</p>
                       <h3 className="text-3xl font-black uppercase tracking-tighter leading-none">{drillDownCompany.name}</h3>
                    </div>
                 </div>
                 <button onClick={() => setSelectedCompanyId(null)} className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center hover:bg-red-600 transition-all border border-white/10">✕</button>
              </div>

              <div className="flex-grow overflow-y-auto p-10 md:p-16 space-y-16 bg-slate-50/30">
                 {/* KPI Section */}
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm text-center">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Active Guards</p>
                       <p className="text-4xl font-black text-emerald-600 font-hud">{drillDownData.activeGuards.length}</p>
                    </div>
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm text-center">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Pending Vetting</p>
                       <p className="text-4xl font-black text-amber-500 font-hud">{drillDownData.pendingInterview.length}</p>
                    </div>
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm text-center">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Incident Registry</p>
                       <p className="text-4xl font-black text-red-600 font-hud">{drillDownData.incidentCount}</p>
                    </div>
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm text-center">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Blacklisted</p>
                       <p className="text-4xl font-black text-slate-900 font-hud">{drillDownData.blacklisted.length}</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                    {/* Staff List */}
                    <section>
                       <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.3em] mb-8 border-b-2 border-slate-100 pb-4">Internal Staff ({drillDownData.staff.length})</h4>
                       <div className="space-y-4">
                          {drillDownData.staff.map(member => (
                             <div key={member.id} className="p-6 bg-white border border-slate-100 rounded-2xl flex justify-between items-center shadow-sm">
                                <div className="flex items-center gap-4">
                                   <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400">{member.full_name[0]}</div>
                                   <div>
                                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{member.full_name}</p>
                                      <p className="text-[10px] font-bold text-slate-400">{member.email}</p>
                                   </div>
                                </div>
                                <span className="px-3 py-1 bg-slate-100 text-[8px] font-black uppercase tracking-widest rounded-lg">{member.role.replace('_', ' ')}</span>
                             </div>
                          ))}
                          {drillDownData.staff.length === 0 && <p className="text-xs text-slate-300 italic">No staff members onboarded.</p>}
                       </div>
                    </section>

                    {/* Operational Highlights */}
                    <section>
                       <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.3em] mb-8 border-b-2 border-slate-100 pb-4">Operational Snapshot</h4>
                       <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-inner space-y-6">
                          <div className="flex justify-between items-center">
                             <span className="text-xs font-black text-slate-400 uppercase">Tenant Health</span>
                             <span className="text-emerald-500 font-black text-xs uppercase">NOMINAL</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                             <div className="h-full bg-primary w-[85%]" />
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic">
                             Automated audit of the last 30 days indicates a high retention rate and low critical incident count for this tenant. 
                             Infrastructure nodes are responding within expected parameters.
                          </p>
                       </div>
                    </section>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[1200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-10 space-y-8 border border-white/20">
              <div className="text-center">
                 <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Company Settings</h3>
                 <p className="text-sm font-medium text-slate-500 mt-2">Update configuration for {showSettingsModal.name}.</p>
              </div>
              <form onSubmit={handleUpdateCompany} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Company Name</label>
                    <input value={name} onChange={e => setName(e.target.value)} required className="w-full h-14 px-6 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold uppercase outline-none focus:border-primary transition-all" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Contact Email</label>
                    <input value={email} onChange={e => setEmail(e.target.value)} required type="email" className="w-full h-14 px-6 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all" />
                 </div>
                 <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setShowSettingsModal(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all">Cancel</button>
                    <button type="submit" disabled={isSyncing} className="flex-1 py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary shadow-xl active:scale-95 transition-all">
                       {isSyncing ? 'Updating...' : 'Save Changes'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Register Company Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-[1200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-10 space-y-8 border border-white/20">
              <div className="text-center">
                 <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Register Tenant</h3>
                 <p className="text-sm font-medium text-slate-500 mt-2">Add a new company to the AMINI network.</p>
              </div>
              <form onSubmit={handleSubmitCompany} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Company Name</label>
                    <input value={name} onChange={e => setName(e.target.value)} required className="w-full h-14 px-6 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold uppercase outline-none focus:border-primary transition-all" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">URL Slug</label>
                    <input value={slug} onChange={e => setSlug(e.target.value)} required placeholder="e.g. ultimate-sec" className="w-full h-14 px-6 bg-slate-50 border-2 border-slate-100 rounded-xl font-mono font-bold outline-none focus:border-primary transition-all" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Contact Email</label>
                    <input value={email} onChange={e => setEmail(e.target.value)} required type="email" className="w-full h-14 px-6 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all" />
                 </div>
                 <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => { setShowAdd(false); setName(''); setSlug(''); setEmail(''); }} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all">Cancel</button>
                    <button type="submit" disabled={isSyncing} className="flex-1 py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary shadow-xl active:scale-95 transition-all">
                       {isSyncing ? 'Provisioning...' : 'Complete Registration'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Provision Admin Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-[1200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-10 space-y-8 border border-white/20">
              <div className="text-center">
                 <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Provision Tenant Admin</h3>
                 <p className="text-sm font-medium text-slate-500 mt-2">Grant administrative access for {showAdminModal.name}.</p>
              </div>
              <form onSubmit={handleProvisionAdmin} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Admin Full Name</label>
                    <input value={adminName} onChange={e => setAdminName(e.target.value)} required className="w-full h-14 px-6 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold uppercase outline-none focus:border-primary transition-all" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Login Email</label>
                    <input value={adminEmail} onChange={e => setAdminEmail(e.target.value)} required type="email" className="w-full h-14 px-6 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Initial Password</label>
                    <input value={adminPassword} onChange={e => setAdminPassword(e.target.value)} required type="password" placeholder="••••••••" className="w-full h-14 px-6 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-primary transition-all" />
                 </div>
                 <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => { setShowAdminModal(null); setAdminName(''); setAdminEmail(''); setAdminPassword(''); }} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all">Cancel</button>
                    <button type="submit" disabled={isSyncing} className="flex-1 py-4 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary shadow-xl active:scale-95 transition-all">
                       {isSyncing ? 'Syncing Node...' : 'Assign Credentials'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default CompanyRegistry;
