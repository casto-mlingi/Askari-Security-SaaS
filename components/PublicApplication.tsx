
import React, { useState, useEffect } from 'react';
import { Guard } from '../types';

interface PublicApplicationProps {
  onBack: () => void;
  onSubmit?: (data: Guard) => void;
}

const PublicApplication: React.FC<PublicApplicationProps> = ({ onBack, onSubmit }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    username: '', // This is the Email/Username for login
    password: '',
    dob: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.phone || !formData.username || !formData.password) {
      (window as any).showNotification?.('error', 'Please fill in all fields.');
      return;
    }
    const phoneRaw = formData.phone.replace(/\s+/g, '');
    if (!/^\+?\d{9,15}$/.test(phoneRaw)) {
      (window as any).showNotification?.('error', 'Please enter a valid phone number (9–15 digits).');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(formData.username)) {
      (window as any).showNotification?.('error', 'Please enter a valid email address.');
      return;
    }
    if (formData.password.length < 8) {
      (window as any).showNotification?.('error', 'Password must be at least 8 characters.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        full_name: formData.full_name,
        nida_number: '', // Removed from signup, collected during intake
        phone: formData.phone,
        dob: formData.dob || '2000-01-01',
        email: formData.username,
        password: formData.password,
        dossier_data: { signup_at: new Date().toISOString() }
      };
      const { api } = await import('../services/api');
      const res = await api.post<any>('/public/signup', payload);
      const out = res.data as any;
      let guard: Guard | undefined = out?.guard;
      // Fallback 2: local record
      if (!guard) {
        guard = {
          id: `g-${Date.now()}`,
          full_name: payload.full_name,
          nida_number: '',
          phone: payload.phone,
          dob: payload.dob,
          email: payload.email,
          is_armed: false,
          status: 'draft',
          profile_score: 0,
          performance_score: 100,
          dossier_data: payload.dossier_data,
          consecutive_absences: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          guarantors: [],
          education_history: [],
          password: payload.password,
        } as Guard;
      }
      try {
        localStorage.setItem('pending_guard_account', JSON.stringify({
          user: { id: guard.id, full_name: guard.full_name, role: 'guard', is_active: true },
          guard,
          needs_intake: true
        }));
        localStorage.setItem('amini_pending_guard', JSON.stringify({
          full_name: guard.full_name,
          nida_number: ''
        }));
      } catch { }
      (window as any).showNotification?.('success', 'Usajili Umekamilika!');
      setShowSuccessDialog(true);
    } catch (error) {
      (window as any).showNotification?.('error', 'Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    let msg = '';
    if (field === 'full_name') {
      if (!value.trim()) msg = 'Full name is required';
    }
    if (field === 'phone') {
      const raw = value.replace(/\s+/g, '');
      const len = raw.replace(/^\+/, '').length;
      if (len > 15) msg = 'Phone cannot exceed 15 digits';
      else if (len > 0 && len < 9) msg = 'Phone should be 9–15 digits';
      else if (raw && !/^\+?\d+$/.test(raw)) msg = 'Use digits with optional +';
      else msg = '';
    }
    if (field === 'username') {
      if (!value.trim()) msg = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(value)) msg = 'Email is invalid';
      else msg = '';
    }
    if (field === 'password') {
      if (!value) msg = 'Password is required';
      else if (value.length < 8) msg = 'Password must be at least 8 characters';
      else msg = '';
    }
    setErrors(prev => {
      const next = { ...prev };
      if (msg) next[field] = msg;
      else delete next[field];
      return next;
    });
  };

  return (
    <div className="fixed inset-0 flex flex-col lg:flex-row min-h-screen z-[1000] overflow-hidden">
      {showSuccessDialog && (
        <div className="fixed inset-0 z-[1100]">
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest mb-3">Usajili Umefanikiwa</h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                Asante kwa kutengeneza account nasi. Sasa kuendelea na hatua nyingine ya kutengeneza account, tafadhali rudi nyuma na u-login kwa kutumia email na password uliyotengeneza.
              </p>
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={onBack}
                  className="px-5 py-2.5 bg-primary text-white rounded-lg font-bold text-xs uppercase tracking-widest shadow hover:bg-primary-dark active:scale-95 transition-all"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="hidden lg:flex lg:w-[440px] xl:w-[520px] flex-shrink-0 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[420px] h-[420px] bg-primary/20 rounded-full blur-3xl -mr-40 -mt-40 pointer-events-none" />
        <div className="flex flex-col justify-center px-10 xl:px-14 py-12 relative z-10">
          <div className="w-14 h-14 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl flex items-center justify-center mb-8 shadow-xl">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight leading-tight">
            New Guard Application
          </h1>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/70 mt-2">
            Create Your Account
          </p>
          <div className="mt-8 bg-white rounded-[2rem] p-6 text-slate-900 shadow-lg">
            <h3 className="text-sm font-black uppercase tracking-widest">Welcome</h3>
            <p className="text-sm mt-2">
              Complete your account setup to access the AMINI applicant dashboard and continue your application.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-background p-4 md:p-6">
        <div className="w-full max-w-lg lg:max-w-xl xl:max-w-2xl bg-white rounded-[2.5rem] shadow-2xl p-8 md:p-12 mx-auto animate-in fade-in duration-500">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
              <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none text-center">New Guard Application</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Create Your Account</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                <input
                  required
                  className="w-full h-14 px-5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none font-bold uppercase transition-all text-base placeholder:text-base placeholder:text-slate-400"
                  placeholder="E.G. JUMA ABDUL SALIM"
                  value={formData.full_name}
                  onChange={e => handleFieldChange('full_name', e.target.value)}
                />
                {errors.full_name && <p className="text-red-600 text-xs font-bold mt-1">{errors.full_name}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">NIDA Number</label>
                  <input
                    required
                    className={`w-full h-14 px-5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none font-mono font-bold transition-all text-base placeholder:text-base placeholder:text-slate-400 ${errors.nida_number ? 'border-red-500' : ''}`}
                    inputMode="numeric"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    title="Enter 20 digits (YYYYMMDD000000000000) or formatted: YYYYMMDD-00000-00000-00"
                    placeholder="19900101-00000-00000-00"
                    value={formData.nida_number}
                    onChange={e => handleFieldChange('nida_number', e.target.value)}
                  />
                  {errors.nida_number && <p className="text-red-600 text-xs font-bold mt-1">{errors.nida_number}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                  <input
                    required
                    type="tel"
                    className={`w-full h-14 px-5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none font-bold transition-all text-base placeholder:text-base placeholder:text-slate-400 ${errors.phone ? 'border-red-500' : ''}`}
                    inputMode="tel"
                    title="Enter 9–15 digits. E.g. +255123456789"
                    placeholder="+255 XXX XXX XXX"
                    value={formData.phone}
                    onChange={e => handleFieldChange('phone', e.target.value)}
                  />
                  {errors.phone && <p className="text-red-600 text-xs font-bold mt-1">{errors.phone}</p>}
                </div>
              </div>

              <div className="h-px bg-slate-100 my-2" />

              <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-4">
                <p className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth="2.5" /></svg>
                  Account Login Details
                </p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-blue-400 uppercase tracking-widest ml-1">Email Address (for login)</label>
                    <input
                      required
                      type="email"
                      className={`w-full h-14 px-4 bg-white border border-blue-100 rounded-lg text-base font-bold focus:border-primary outline-none transition-all placeholder:text-base placeholder:text-slate-400 ${errors.username ? 'border-red-500' : ''}`}
                      placeholder="name@email.com"
                      value={formData.username}
                      onChange={e => handleFieldChange('username', e.target.value)}
                    />
                    {errors.username && <p className="text-red-600 text-xs font-bold mt-1">{errors.username}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-blue-400 uppercase tracking-widest ml-1">Create Password</label>
                    <input
                      required
                      type="password"
                      className={`w-full h-14 px-4 bg-white border border-blue-100 rounded-lg text-base font-bold focus:border-primary outline-none transition-all placeholder:text-base placeholder:text-slate-400 ${errors.password ? 'border-red-500' : ''}`}
                      title="Password must be at least 8 characters"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={e => handleFieldChange('password', e.target.value)}
                    />
                    {errors.password && <p className="text-red-600 text-xs font-bold mt-1">{errors.password}</p>}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-16 bg-primary text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-2xl shadow-blue-900/20 active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Create Account
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 7l5 5m0 0l-5 5m5-5H6" strokeWidth="3" /></svg>
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
    </div>
  );
};

export default PublicApplication;
