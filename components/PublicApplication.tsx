
import React, { useState, useEffect } from 'react';
import { ApplicationStatus, Guard } from '../types';

interface PublicApplicationProps {
  onBack: () => void;
  onSubmit?: (data: Guard) => void;
}

const PublicApplication: React.FC<PublicApplicationProps> = ({ onBack, onSubmit }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: '',
    nida_number: '',
    phone: '',
    username: '', // This is the Email/Username for login
    password: '',
    dob: ''
  });

  // Auto-extract DOB from NIDA number (YYYYMMDD format)
  useEffect(() => {
    const cleanNida = formData.nida_number.replace(/[^0-9]/g, '');
    if (cleanNida.length >= 8) {
      const yyyy = cleanNida.substring(0, 4);
      const mm = cleanNida.substring(4, 6);
      const dd = cleanNida.substring(6, 8);
      const derivedDob = `${yyyy}-${mm}-${dd}`;
      const d = new Date(derivedDob);
      if (!isNaN(d.getTime())) {
        setFormData(prev => ({ ...prev, dob: derivedDob }));
      }
    }
  }, [formData.nida_number]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.nida_number || !formData.phone || !formData.username || !formData.password) {
      alert("Please fill in all fields.");
      return;
    }

    setIsSubmitting(true);
    // Simulate registry commitment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Construct a valid initial Guard object to prevent crashes
    const newGuard: Guard = {
        id: `g-${Date.now()}`,
        full_name: formData.full_name,
        nida_number: formData.nida_number,
        phone: formData.phone,
        username: formData.username,
        password: formData.password,
        dob: formData.dob || '2000-01-01',
        application_status: ApplicationStatus.DRAFT,
        profile_score: 15,
        performance_score: 100,
        is_armed: false,
        consecutive_absences: 0,
        education_history: [],
        guarantors: [],
        dossier_data: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    if (onSubmit) {
      onSubmit(newGuard);
    }
    
    setIsSubmitting(false);
    // Note: The parent component (App.tsx) handles the auto-login upon submission, 
    // which will unmount this component.
  };

  return (
    <div className="fixed inset-0 bg-primary flex flex-col items-center justify-center p-4 md:p-6 z-[1000] overflow-y-auto custom-scrollbar">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 md:p-12 my-auto animate-in zoom-in-95 duration-500">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
            <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none text-center">New Guard Application</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Create Your Account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
              <input 
                required
                className="w-full h-14 px-5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none font-bold uppercase transition-all text-base placeholder:text-base placeholder:text-slate-400"
                placeholder="E.G. JUMA ABDUL SALIM"
                value={formData.full_name}
                onChange={e => setFormData({...formData, full_name: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">NIDA Number</label>
                <input 
                  required
                  className="w-full h-14 px-5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none font-mono font-bold transition-all text-base placeholder:text-base placeholder:text-slate-400"
                  placeholder="19900101-00000-00000-00"
                  value={formData.nida_number}
                  onChange={e => setFormData({...formData, nida_number: e.target.value})}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                <input 
                  required
                  type="tel"
                  className="w-full h-14 px-5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none font-bold transition-all text-base placeholder:text-base placeholder:text-slate-400"
                  placeholder="+255 XXX XXX XXX"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                />
              </div>
            </div>

            <div className="h-px bg-slate-100 my-2" />

            <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-4">
              <p className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth="2.5"/></svg>
                Account Login Details
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-blue-400 uppercase tracking-widest ml-1">Email Address (for login)</label>
                  <input 
                    required
                    type="email"
                    className="w-full h-14 px-4 bg-white border border-blue-100 rounded-lg text-base font-bold focus:border-primary outline-none transition-all placeholder:text-base placeholder:text-slate-400"
                    placeholder="name@email.com"
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-blue-400 uppercase tracking-widest ml-1">Create Password</label>
                  <input 
                    required
                    type="password"
                    className="w-full h-14 px-4 bg-white border border-blue-100 rounded-lg text-base font-bold focus:border-primary outline-none transition-all placeholder:text-base placeholder:text-slate-400"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full h-16 bg-primary text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-2xl shadow-blue-900/20 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Create Account
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 7l5 5m0 0l-5 5m5-5H6" strokeWidth="3"/></svg>
              </>
            )}
          </button>

          <button 
            type="button"
            onClick={onBack}
            className="w-full text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors py-2"
          >
            Return to Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default PublicApplication;
