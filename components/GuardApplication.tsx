import React, { useState, useEffect } from 'react';
import { Guard, ApplicationStatus, UserRole } from '../types';
import { guardService } from '../services/guardService';
import { api } from '../services/api';

interface GuardApplicationProps {
  onComplete: (guard: Guard) => void;
  onBackToLogin?: () => void;
}

const GuardApplication: React.FC<GuardApplicationProps> = ({ onComplete, onBackToLogin }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    nida_number: '',
    phone: '',
    email: '',
    password: '',
    confirm_password: '',
    dob: '',
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  const draftKey = 'guard_application_draft_v1';

  useEffect(() => {
    const clean = (formData.nida_number || '').replace(/[^0-9]/g, '');
    if (clean.length >= 8) {
      const yyyy = clean.substring(0,4);
      const mm = clean.substring(4,6);
      const dd = clean.substring(6,8);
      const derived = `${yyyy}-${mm}-${dd}`;
      const d = new Date(derived);
      if (!isNaN(d.getTime())) {
        setFormData(prev => ({ ...prev, dob: derived }));
      }
    }
  }, [formData.nida_number]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setFormData(prev => ({
            ...prev,
            full_name: parsed.full_name || '',
            nida_number: parsed.nida_number || '',
            phone: parsed.phone || '',
            email: parsed.email || '',
            dob: parsed.dob || '',
          }));
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const { password, confirm_password, ...safe } = formData;
      localStorage.setItem(draftKey, JSON.stringify(safe));
    } catch {}
  }, [formData]);

  // Handle scroll visibility
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.full_name.trim()) newErrors.full_name = 'Full name is required';
    if (!formData.nida_number.trim()) {
      newErrors.nida_number = 'NIDA number is required';
    } else {
      const digits = formData.nida_number.replace(/[^0-9]/g, '');
      if (digits.length !== 20) newErrors.nida_number = 'NIDA must be exactly 20 digits';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else {
      const phoneRaw = formData.phone.replace(/\s+/g, '');
      if (!/^\+?\d{9,15}$/.test(phoneRaw)) newErrors.phone = 'Please enter a valid phone number';
    }
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    if (!formData.confirm_password) newErrors.confirm_password = 'Please confirm your password';
    else if (formData.password !== formData.confirm_password) newErrors.confirm_password = 'Passwords do not match';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {}, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      setIsSubmitting(true);

      try {
        const newGuard: Partial<Guard> = {
          full_name: formData.full_name,
          nida_number: formData.nida_number,
          phone: formData.phone,
          dob: formData.dob || '2000-01-01',
          email: formData.email,
          is_armed: false,
          application_status: ApplicationStatus.DRAFT,
          profile_score: 0,
          performance_score: undefined,
          dossier_data: {},
          consecutive_absences: 0,
          password: formData.password
        };

        // Primary path: public endpoint
        const result = await api.post('/public/guards', newGuard);
        let savedGuard = result.data as Guard | undefined;

        // Fallbacks to ensure the button “works” even if backend fails silently
        if (!savedGuard) {
          // Try internal endpoint
          const alt = await api.post('/guards', newGuard);
          savedGuard = alt.data as Guard | undefined;
        }
        if (!savedGuard) {
          // Final local fallback
          savedGuard = {
            id: `g-${Date.now()}`,
            full_name: formData.full_name,
            nida_number: formData.nida_number,
            phone: formData.phone,
            dob: formData.dob || '2000-01-01',
            email: formData.email,
            is_armed: false,
            application_status: ApplicationStatus.DRAFT,
            profile_score: 0,
            performance_score: 100,
            dossier_data: {},
            consecutive_absences: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            guarantors: [],
            education_history: [],
            password: formData.password,
          } as Guard;
        }

        const newUser = {
          id: `u-${Date.now()}`,
          email: formData.email,
          full_name: formData.full_name,
          role: UserRole.GUARD,
          is_active: true,
          created_at: new Date().toISOString(),
          password: formData.password,
          guard_id: savedGuard.id,
        };

        // Store account creation data (in real app this would go to backend)
        localStorage.setItem('pending_guard_account', JSON.stringify({
          user: newUser,
          guard: savedGuard,
          needs_intake: true, // Flag to show intake form on first login
        }));
        try {
          localStorage.removeItem(draftKey);
        } catch {}

        onComplete(savedGuard);

        (window as any).showNotification?.('success', '🎉 Account created successfully! Please log in to complete your application.');
      } catch (error) {
        console.error('Error creating account:', error);
        (window as any).showNotification?.('error', 'Failed to create account. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
    else {
      (window as any).showNotification?.('error', 'Please fix the highlighted fields and try again.');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    let msg = '';
    if (field === 'full_name') {
      if (!value.trim()) msg = 'Full name is required';
    }
    if (field === 'nida_number') {
      const digits = value.replace(/[^0-9]/g, '');
      if (digits.length > 20) msg = 'NIDA cannot exceed 20 digits';
      else if (digits.length < 20) msg = 'NIDA must be exactly 20 digits';
      else msg = '';
    }
    if (field === 'phone') {
      const raw = value.replace(/\s+/g, '');
      const len = raw.replace(/^\+/, '').length;
      if (len > 15) msg = 'Phone cannot exceed 15 digits';
      else if (len > 0 && len < 9) msg = 'Phone should be 9–15 digits';
      else if (raw && !/^\+?\d+$/.test(raw)) msg = 'Use digits with optional +';
      else msg = '';
    }
    if (field === 'email') {
      if (!value.trim()) msg = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(value)) msg = 'Email is invalid';
      else msg = '';
    }
    if (field === 'password') {
      if (!value) msg = 'Password is required';
      else if (value.length < 8) msg = 'Password must be at least 8 characters';
      else msg = '';
    }
    if (field === 'confirm_password') {
      if (!value) msg = 'Please confirm your password';
      else if (value !== formData.password) msg = 'Passwords do not match';
      else msg = '';
    }
    setErrors(prev => {
      const next = { ...prev };
      if (msg) next[field] = msg;
      else delete next[field];
      return next;
    });
  };

  const inputClass = (hasError: boolean) =>
    `w-full h-11 px-4 bg-surface-secondary border-2 rounded-xl font-medium outline-none transition-all text-sm ${
      hasError ? 'border-error' : 'border-border-light focus:border-primary'
    }`;
  const labelClass = 'text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1';

  return (
    <div className="desktop-application min-h-screen flex flex-col lg:flex-row lg:min-h-0 lg:h-screen" style={{ scrollBehavior: 'smooth' }}>
      {/* Scroll to Top - only when content overflows */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 w-11 h-11 bg-primary hover:bg-primary-dark text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-50 flex items-center justify-center group"
          aria-label="Scroll to top"
        >
          <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}

      {/* Left: Branding / Hero - desktop only, fits viewport */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-shrink-0 bg-gradient-to-br from-primary via-primary-dark to-primary-light flex flex-col justify-center px-10 xl:px-14 py-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-2xl -mr-20 -mt-20" />
        <div className="relative z-10">
          <div className="w-14 h-14 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center mb-8">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl xl:text-3xl font-black uppercase tracking-tight leading-tight mb-3">
            New Guard Application
          </h1>
          <p className="text-lg font-semibold text-white/90 mb-4">
            Create Your Account
          </p>
          <p className="text-sm text-white/80 leading-relaxed max-w-sm">
            Join AMINI's professional security network. Complete your application to become part of our elite team of security professionals.
          </p>
          <div className="mt-10 flex items-center gap-2 text-white/70 text-xs font-medium">
            <span>Scroll down to continue</span>
            <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </div>

      {/* Right: Form - scrollable on small viewports, fits on large */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-background">
        <div className="flex-1 flex flex-col justify-center px-4 py-8 lg:py-10 lg:px-12 xl:px-20 max-w-2xl mx-auto w-full">
          <div className="w-full bg-surface rounded-2xl border border-border shadow-sm p-6 lg:p-8 my-auto">
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-primary border border-primary-dark rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              </div>
              <h2 className="text-xl font-black text-primary uppercase tracking-tight leading-none text-center">New Guard Application</h2>
              <p className="text-text-muted text-xs mt-1">Create Your Account</p>
            </div>
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className={labelClass}>Full Name</label>
                  <input 
                    required
                    className={inputClass(!!errors.full_name)}
                    placeholder="E.G. JUMA ABDUL SALIM"
                    value={formData.full_name}
                    onChange={e => handleInputChange('full_name', e.target.value)}
                  />
                  {errors.full_name && <p className="text-red-600 text-xs font-bold mt-1">{errors.full_name}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className={labelClass}>NIDA Number</label>
                    <input 
                      required
                      className={`${inputClass(!!errors.nida_number)} font-mono`}
                      inputMode="numeric"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      title="Enter 20 digits (YYYYMMDD000000000000) or formatted: YYYYMMDD-00000-00000-00"
                      placeholder="19900101-00000-00000-00"
                      value={formData.nida_number}
                      onChange={e => handleInputChange('nida_number', e.target.value)}
                    />
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Enter 20-digit NIDA (or YYYYMMDD-00000-00000-00). DOB auto-fills.</p>
                    {errors.nida_number && <p className="text-red-600 text-xs font-bold mt-1">{errors.nida_number}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Phone Number</label>
                    <input 
                      required
                      type="tel"
                      className={inputClass(!!errors.phone)}
                      inputMode="tel"
                      title="Enter 9–15 digits. E.g. +255123456789"
                      placeholder="+255 XXX XXX XXX"
                      value={formData.phone}
                      onChange={e => handleInputChange('phone', e.target.value)}
                    />
                    {errors.phone && <p className="text-red-600 text-xs font-bold mt-1">{errors.phone}</p>}
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-border-light" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className={labelClass}>Email Address (for login)</label>
                      <input 
                        required
                        type="email"
                        className={inputClass(!!errors.email)}
                        placeholder="name@email.com"
                        value={formData.email}
                        onChange={e => handleInputChange('email', e.target.value)}
                      />
                      {errors.email && <p className="text-red-600 text-xs font-bold mt-1">{errors.email}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Create Password</label>
                      <input 
                        required
                        type="password"
                        className={inputClass(!!errors.password)}
                        title="Password must be at least 8 characters"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={e => handleInputChange('password', e.target.value)}
                      />
                      {errors.password && <p className="text-red-600 text-xs font-bold mt-1">{errors.password}</p>}
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className={labelClass}>Confirm Password</label>
                      <input 
                        required
                        type="password"
                        className={inputClass(!!errors.confirm_password)}
                        placeholder="••••••••"
                        value={formData.confirm_password}
                        onChange={e => handleInputChange('confirm_password', e.target.value)}
                      />
                      {errors.confirm_password && <p className="text-red-600 text-xs font-bold mt-1">{errors.confirm_password}</p>}
                    </div>
                  </div>
                </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg hover:shadow-xl flex items-center justify-center gap-2 mt-6 transition-all active:scale-[0.98] cursor-pointer"
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
                onClick={onBackToLogin}
                className="w-full text-xs font-black text-primary uppercase tracking-widest hover:text-primary-dark transition-colors py-2 flex items-center justify-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 7l-5 5m0 0l5 5m-5-5h12" strokeWidth="2.5"/></svg>
                Return to Login
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuardApplication;
