
import React, { useState } from 'react';
import { UserRole, Guard, Profile, ApplicationStatus } from '../types';
import PublicApplication from './PublicApplication';
import { MOCK_PROFILES, MOCK_GUARDS } from '../constants/mock';
import { supabase } from '../services/supabaseClient';

interface AuthProps {
  onLogin: (user: Profile | Guard) => void;
  onPublicSubmit: (data: any) => void;
  guards: Guard[];
  profiles: Profile[];
  onShowGuardApplication?: () => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin, onPublicSubmit, guards, profiles, onShowGuardApplication }) => {
  const [view, setView] = useState<'login' | 'apply'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Normalize email (trim and lowercase for comparison)
    // Note: Passwords should NOT be trimmed - compare exactly as entered
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (authError) {
        const msg = (authError.message || '').toLowerCase();
        if (msg.includes('no api key') || msg.includes('bad request')) {
          setError('Configuration error: Supabase API key missing or invalid. Set VITE_SUPABASE_ANON_KEY and restart.');
        }
      }
      if (!authError && authData?.user) {
        const userId = authData.user.id;
        const { data: dbProfileById } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (dbProfileById) {
          onLogin(dbProfileById as any);
          return;
        }
        const { data: dbProfileByEmail } = await supabase.from('profiles').select('*').eq('email', normalizedEmail).maybeSingle();
        if (dbProfileByEmail) {
          onLogin(dbProfileByEmail as any);
          return;
        }
      }
    } catch {}

    // Check staff profiles first
    const staffUser = profiles.find(p => 
      p.email.trim().toLowerCase() === normalizedEmail && p.password === password
    );
    if (staffUser) {
      onLogin(staffUser);
      return;
    }
    const mockStaffUser = MOCK_PROFILES.find(p => 
      p.email.trim().toLowerCase() === normalizedEmail && p.password === password
    );
    if (mockStaffUser) {
      onLogin(mockStaffUser);
      return;
    }

    // Check registered guards (by username or email)
    const registeredGuard = guards.find(g => {
      const guardEmail = (g.email || '').trim().toLowerCase();
      const guardUsername = (g.username || '').trim().toLowerCase();
      return (guardEmail === normalizedEmail || guardUsername === normalizedEmail) && 
             g.password === password;
    });
    if (registeredGuard) {
      onLogin(registeredGuard);
      return;
    }
    const mockGuard = MOCK_GUARDS.find(g => {
      const guardUsername = (g.username || '').trim().toLowerCase();
      return guardUsername === normalizedEmail && g.password === password;
    });
    if (mockGuard) {
      onLogin(mockGuard);
      return;
    }

    // Check for pending guard account in localStorage
    const pendingAccount = localStorage.getItem('pending_guard_account');
    if (pendingAccount) {
      try {
        const accountData = JSON.parse(pendingAccount);
        const pendingUser = accountData.user;
        const pendingGuard = accountData.guard;

        if (!pendingUser || !pendingGuard) {
          console.error('Invalid pending account structure');
          localStorage.removeItem('pending_guard_account');
        } else {
          // Check both user and guard email fields (normalized)
          const pendingUserEmail = (pendingUser.email || '').trim().toLowerCase();
          const pendingGuardEmail = (pendingGuard.email || '').trim().toLowerCase();
          
          // Check if email matches (either user.email or guard.email)
          const emailMatches = pendingUserEmail === normalizedEmail || pendingGuardEmail === normalizedEmail;
          
          // Check password (try user.password first, then guard.password as fallback)
          // Ensure passwords exist and match exactly
          const userPassword = pendingUser.password || '';
          const guardPassword = pendingGuard.password || '';
          const passwordMatches = (userPassword && userPassword === password) || 
                                 (guardPassword && guardPassword === password);
          
          if (emailMatches && passwordMatches) {
            // Login with the pending guard (will be added to guards array in App.tsx)
            onLogin(pendingGuard);
            return;
          }
        }
      } catch (e) {
        console.error('Error parsing pending account:', e);
        // Clear corrupted localStorage data
        localStorage.removeItem('pending_guard_account');
      }
    }

    setError('Invalid credentials. Check your email or password.');
  };
  
 

 

  if (view === 'apply') {
    return <PublicApplication onBack={() => setView('login')} onSubmit={onPublicSubmit} />;
  }

  const labelClass = 'text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1';
  const inputClass = 'w-full h-11 px-4 bg-surface-secondary border-2 rounded-xl font-medium outline-none transition-all text-sm border-border-light focus:border-primary';

  return (
    <div className="fixed inset-0 flex flex-col lg:flex-row min-h-screen z-[1000] overflow-hidden">
      {/* Left: Branding / Hero - same style as New Guard Application (desktop) */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-shrink-0 bg-gradient-to-br from-primary via-primary-dark to-primary-light flex flex-col justify-center px-10 xl:px-14 py-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-2xl -mr-20 -mt-20" />
        <div className="relative z-10">
          <div className="w-14 h-14 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center mb-8">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl xl:text-3xl font-black uppercase tracking-tight leading-tight mb-3">
            Sign in to AMINI
          </h1>
          <p className="text-lg font-semibold text-white/90 mb-4">
            Security Operations Management
          </p>
          <p className="text-sm text-white/80 leading-relaxed max-w-sm">
            Access your AMINI security operations dashboard. Sign in to manage personnel, sites, and operations.
          </p>
        </div>
      </div>

      {/* Right: Login form - scrollable on small viewports */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-background">
        <div className="flex-1 flex flex-col justify-center px-4 py-8 lg:py-10 lg:px-12 xl:px-20 max-w-md mx-auto w-full">
          {/* Mobile header (same style as GuardApplication mobile header) */}
          <div className="lg:hidden text-center mb-6">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-xl font-black text-primary uppercase tracking-tight">Sign in to AMINI</h1>
            <p className="text-text-muted text-xs mt-1">Security Operations Management</p>
          </div>

          <div className="bg-surface rounded-2xl border border-border shadow-sm p-6 lg:p-8">
            {error && (
              <div className="mb-6 p-4 bg-error/10 border-2 border-error/30 rounded-xl text-error text-sm font-bold animate-fade-in">
                {error}
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className={labelClass}>Password</label>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg hover:shadow-xl flex items-center justify-center gap-2 mt-6 transition-all active:scale-[0.98]"
              >
                Sign In
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-border-light space-y-4 text-center">
              {onShowGuardApplication && (
                <div className="hidden lg:block">
                  <button
                    onClick={onShowGuardApplication}
                    className="w-full py-3.5 bg-gradient-to-r from-primary to-secondary hover:from-primary-dark hover:to-secondary-dark text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 uppercase tracking-wider text-xs"
                  >
                    Create Your Account
                  </button>
                  <p className="text-xs text-text-muted mt-2">Join AMINI's professional security network</p>
                </div>
              )}

              <div className="lg:hidden">
                <button
                  onClick={() => setView('apply')}
                  className="text-text-muted hover:text-primary text-xs font-medium transition-colors uppercase tracking-wider"
                >
                  New Guard? <span className="text-primary font-semibold underline">Apply Here</span>
                </button>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-border-light">
              
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
