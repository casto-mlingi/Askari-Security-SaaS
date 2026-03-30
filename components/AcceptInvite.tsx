import React, { useEffect, useState } from 'react';

const AcceptInvite: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fullName, setFullName] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const isInvite = hash.includes('type=invite') && hash.includes('access_token=');
      if (!isInvite) {
        setError('Invalid or missing invitation token.');
        setLoading(false);
        return;
      }
      const token = localStorage.getItem('amini_auth_token');
      if (!token) {
        setError('No active session. Please sign in first.');
        setLoading(false);
        return;
      }
      setSessionEmail(null);
      setLoading(false);
    };
    run();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirm) {
      setError('Password and confirmation are required.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const payload: any = { password };
      if (fullName && fullName.trim()) {
        payload.data = { full_name: fullName.trim() };
      }
      setError(null);
      window.location.href = '/';
    } catch (err: any) {
      setError(err?.message || 'Unexpected error while updating account.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="bg-surface rounded-2xl border border-border shadow-sm p-8 w-full max-w-md text-center">
          <p className="text-sm font-bold text-text-muted">Verifying invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="bg-surface rounded-2xl border border-border shadow-sm p-8 w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-xl font-black text-primary uppercase tracking-tight">Accept Invitation</h1>
          <p className="text-xs text-text-muted mt-1">{sessionEmail ? `Invited as ${sessionEmail}` : 'Complete your account setup'}</p>
        </div>
        {error && (
          <div className="mb-6 p-4 bg-error/10 border-2 border-error/30 rounded-xl text-error text-sm font-bold">
            {error}
          </div>
        )}
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-11 px-4 bg-surface-secondary border-2 rounded-xl font-medium outline-none transition-all text-sm border-border-light focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="w-full h-11 px-4 bg-surface-secondary border-2 rounded-xl font-medium outline-none transition-all text-sm border-border-light focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Full Name (optional)</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              className="w-full h-11 px-4 bg-surface-secondary border-2 rounded-xl font-medium outline-none transition-all text-sm border-border-light focus:border-primary"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg hover:shadow-xl flex items-center justify-center gap-2 mt-4 transition-all active:scale-[0.98]"
          >
            Save And Continue
          </button>
        </form>
      </div>
    </div>
  );
};

export default AcceptInvite;
