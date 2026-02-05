import React, { useState, useEffect } from 'react';
import { Guard, ApplicationStatus, UserRole } from '../types';
import { guardService } from '../services/guardService';

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
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [showScrollTop, setShowScrollTop] = useState(false);

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
    if (!formData.nida_number.trim()) newErrors.nida_number = 'NIDA number is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email is invalid';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    if (!formData.confirm_password) newErrors.confirm_password = 'Please confirm your password';
    else if (formData.password !== formData.confirm_password) newErrors.confirm_password = 'Passwords do not match';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      setIsSubmitting(true);

      try {
        // Create a basic guard profile for account creation
        // This will be updated with full details during the intake process
        const newGuard: Guard = {
          full_name: formData.full_name,
          nida_number: formData.nida_number,
          phone: formData.phone,
          // Note: email is not stored in guards table - it's in profiles for login
          dob: '', // Will be filled in intake form (required field, empty for now)
          // Basic fields - full application will be completed in intake form
          application_letter_url: '',
          nida_front_url: '',
          birth_cert_url: '',
          guarantors: [],
          next_of_kin_name: '',
          next_of_kin_phone: '',
          next_of_kin_relationship: '',
          residence_lat: undefined,
          residence_lng: undefined,
          residence_letter_url: '',
          education_history: [],
          is_armed: false,
          application_status: ApplicationStatus.DRAFT, // Will be updated during intake
          profile_score: 0, // Will be calculated during intake
          performance_score: 100,
          dossier_data: {},
          consecutive_absences: 0,
        };

        // Save guard to database
        const { data: savedGuard, error } = await guardService.createGuard(newGuard);
        if (error || !savedGuard) {
          throw new Error(error || 'Failed to create guard record');
        }

        // Create a user profile for login (this would normally be in profiles table)
        const newUser = {
          id: `u-${Date.now()}`,
          email: formData.email,
          full_name: formData.full_name,
          role: UserRole.GUARD,
          is_active: true,
          created_at: new Date().toISOString(),
          // Store password (in real app this would be hashed)
          password: formData.password,
          // Link to guard profile
          guard_id: savedGuard.id,
        };

        // Store account creation data (in real app this would go to backend)
        localStorage.setItem('pending_guard_account', JSON.stringify({
          user: newUser,
          guard: savedGuard,
          needs_intake: true, // Flag to show intake form on first login
        }));

        onComplete(savedGuard);

        // Show success notification
        (window as any).showNotification?.('success', '🎉 Account created successfully! Please log in to complete your application.');
      } catch (error) {
        console.error('Error creating account:', error);
        (window as any).showNotification?.('error', 'Failed to create account. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
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
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        <div className="flex-1 flex flex-col justify-center px-4 py-8 lg:py-10 lg:px-12 xl:px-20 max-w-lg mx-auto w-full">
          {/* Mobile header (only when not side-by-side) */}
          <div className="lg:hidden text-center mb-6">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-xl font-black text-primary uppercase tracking-tight">New Guard Application</h1>
            <p className="text-text-muted text-xs mt-1">Create Your Account</p>
          </div>

          <div className="bg-surface rounded-2xl border border-border shadow-sm p-6 lg:p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Personal info - 2 cols on desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Full Name</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => handleInputChange('full_name', e.target.value)}
                    className={inputClass(!!errors.full_name)}
                    placeholder="Full name"
                  />
                  {errors.full_name && <p className="text-xs text-error mt-1">{errors.full_name}</p>}
                </div>
                <div>
                  <label className={labelClass}>NIDA Number</label>
                  <input
                    type="text"
                    value={formData.nida_number}
                    onChange={(e) => handleInputChange('nida_number', e.target.value)}
                    className={inputClass(!!errors.nida_number)}
                    placeholder="19900101-XXXXX-XX-XX-XX"
                  />
                  {errors.nida_number && <p className="text-xs text-error mt-1">{errors.nida_number}</p>}
                </div>
              </div>
              <div>
                <label className={labelClass}>Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className={inputClass(!!errors.phone)}
                  placeholder="+255 XXX XXX XXX"
                />
                {errors.phone && <p className="text-xs text-error mt-1">{errors.phone}</p>}
              </div>

              {/* Account login */}
              <div className="border-t border-border-light pt-4 mt-4">
                <h3 className="text-xs font-bold text-text uppercase tracking-wider mb-3">Account Login Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className={inputClass(!!errors.email)}
                      placeholder="your.email@example.com"
                    />
                    {errors.email && <p className="text-xs text-error mt-1">{errors.email}</p>}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Create Password</label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        className={inputClass(!!errors.password)}
                        placeholder="Min. 8 characters"
                      />
                      {errors.password && <p className="text-xs text-error mt-1">{errors.password}</p>}
                    </div>
                    <div>
                      <label className={labelClass}>Confirm Password</label>
                      <input
                        type="password"
                        value={formData.confirm_password}
                        onChange={(e) => handleInputChange('confirm_password', e.target.value)}
                        className={inputClass(!!errors.confirm_password)}
                        placeholder="Confirm password"
                      />
                      {errors.confirm_password && <p className="text-xs text-error mt-1">{errors.confirm_password}</p>}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-wait flex items-center justify-center gap-2 mt-6 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            <div className="text-center mt-5 pt-4 border-t border-border-light">
              <button
                type="button"
                onClick={onBackToLogin}
                className="text-text-muted hover:text-text-secondary text-xs font-medium transition-colors"
              >
                Return to Login
              </button>
            </div>
          </div>
        </div>
        <div className="h-8 flex-shrink-0" />
      </div>
    </div>
  );
};

export default GuardApplication;