
import React, { useState } from 'react';
import { UserRole, Guard, Profile, ApplicationStatus } from '../types';
import PublicApplication from './PublicApplication';

interface AuthProps {
  onLogin: (user: Profile | Guard) => void;
  onPublicSubmit: (data: any) => void;
  guards: Guard[];
  profiles: Profile[];
}

const DEMO_BUTTONS = [
  { email: 'admin@askari.com', label: 'Super Admin' },
  { email: 'manager@ultimate.com', label: 'Company Admin' },
  { email: 'hr@askari.com', label: 'HR Officer' },
  { email: 'supply@askari.com', label: 'Procurement' },
  { email: 'field@askari.com', label: 'Supervisor' },
  { email: 'guard@askari.com', label: 'Guard' },
];

const Auth: React.FC<AuthProps> = ({ onLogin, onPublicSubmit, guards, profiles }) => {
  const [view, setView] = useState<'login' | 'apply'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showDemo, setShowDemo] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const staffUser = profiles.find(p => p.email === email && p.password === password);
    if (staffUser) {
      onLogin(staffUser);
      return;
    }

    const registeredGuard = guards.find(g => g.username === email && g.password === password);
    if (registeredGuard) {
      onLogin(registeredGuard);
      return;
    }

    setError('Invalid credentials. Check your email or password.');
  };
  
  const handleDemoClick = (email: string) => {
    const user = profiles.find(p => p.email === email) || guards.find(g => g.username === email);
    if (user) {
        onLogin(user);
    } else {
        // Fallback for the default guard which is not in the profiles list
        if (email === 'guard@askari.com') {
            const mockGuard: Guard = {
                id: 'g-demo-001',
                full_name: 'John Doe (Demo)',
                nida_number: '19900101-00000-00001-01',
                dob: '1990-01-01',
                phone: '+255712345678',
                username: 'guard@askari.com',
                password: 'pass123',
                application_status: ApplicationStatus.ACTIVE,
                profile_score: 95,
                performance_score: 98,
                dossier_data: {}, // Initialized as empty object
                education_history: [
                    { id: 'edu-mock-1', guard_id: 'g-demo-001', level: 'secondary', year: '2008', certificate_url: 'https://via.placeholder.com/150.png?text=Mock+Edu+Cert' }
                ],
                guarantors: [
                    { id: 'gua-mock-1', guard_id: 'g-demo-001', name: 'Jane Doe', phone: '0712345678', relationship: 'Sister', letter_url: 'https://via.placeholder.com/150.png?text=Mock+Gua+Letter', residence_letter_url: 'https://via.placeholder.com/150.png?text=Mock+Gua+Res+Letter' }
                ],
                next_of_kin_name: 'Peter Doe',
                next_of_kin_phone: '0799887766',
                next_of_kin_relationship: 'Spouse',
                nida_front_url: 'https://via.placeholder.com/150.png?text=Mock+NIDA',
                birth_cert_url: 'https://via.placeholder.com/150.png?text=Mock+Birth+Cert',
                application_letter_url: 'https://via.placeholder.com/150.png?text=Mock+App+Letter',
                residence_letter_url: 'https://via.placeholder.com/150.png?text=Mock+Res+Letter',
                consecutive_absences: 0,
                is_armed: true,
                created_at: new Date().toISOString()
            };
            onLogin(mockGuard);
        } else {
             alert(`Demo user with email ${email} not found in current data.`);
        }
    }
  };

  const handleForgot = () => {
    if (!email) {
      alert("Please enter your email address to request a password reset.");
      return;
    }
    setIsResetting(true);
    setTimeout(() => {
      alert(`A password reset link has been sent to ${email}. Please check your inbox.`);
      setIsResetting(false);
    }, 1500);
  };

  if (view === 'apply') {
    return <PublicApplication onBack={() => setView('login')} onSubmit={onPublicSubmit} />;
  }

  return (
    <div className="fixed inset-0 bg-slate-50 flex items-center justify-center p-6 z-[1000] overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-2xl p-10 md:p-12 shadow-xl border border-slate-200">
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-blue-900/10">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Sign in to Askari</h1>
          <p className="text-slate-500 text-sm mt-2">Security Operations Management</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm font-bold animate-in slide-in-from-top-1">
            {error}
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com" 
              className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all text-base"
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center px-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Password</label>
              <button 
                type="button" 
                onClick={handleForgot}
                disabled={isResetting}
                className="text-xs font-bold text-primary hover:underline uppercase tracking-wider"
              >
                {isResetting ? 'Processing...' : 'Forgot?'}
              </button>
            </div>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" 
              className="w-full h-14 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all text-base"
              required
            />
          </div>

          <button 
            type="submit" 
            className="w-full h-14 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-primary transition-all active:scale-[0.98] mt-4 uppercase text-sm tracking-widest"
          >
            Sign In
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setView('apply')}
            className="text-xs font-bold text-slate-500 hover:text-primary transition-colors uppercase tracking-widest"
          >
            New Guard? <span className="text-primary underline">Apply Here</span>
          </button>
        </div>

        <div className="mt-10 pt-8 border-t border-slate-100">
           <button 
            onClick={() => setShowDemo(!showDemo)}
            className="w-full flex items-center justify-between text-slate-400 hover:text-slate-600 font-bold text-xs uppercase tracking-widest"
           >
             Demo Logins (Dev)
             <svg className={`w-4 h-4 transition-transform ${showDemo ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="3"/></svg>
           </button>
           
           {showDemo && (
             <div className="mt-4 grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2">
               {DEMO_BUTTONS.map((user) => (
                 <button 
                  key={user.email}
                  onClick={() => handleDemoClick(user.email)}
                  className="p-3 text-left bg-slate-50 hover:bg-white hover:border-primary/20 rounded-xl border border-slate-100 transition-all group"
                 >
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest group-hover:text-primary">{user.label}</p>
                   <p className="text-xs text-slate-500 font-medium truncate">{user.email}</p>
                 </button>
               ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
