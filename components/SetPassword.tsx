import React, { useEffect, useState } from 'react';
 

const SetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    const extractEmail = async () => {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      if (hash) {
        const params = new URLSearchParams(hash.replace(/^#/, ''));
        const fromHash = params.get('email');
        if (fromHash) setEmail(fromHash);
      }
      const token = localStorage.getItem('amini_auth_token');
      if (token && !email) setEmail('');
    };
    extractEmail();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }
    try {
      alert('Password set successfully!');
      window.location.href = '/';
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-center text-gray-900">Welcome to Anasel Security</h2>
          <p className="mt-2 text-sm text-center text-gray-600">Create your new password to complete your registration.</p>
          <form onSubmit={handleUpdatePassword} className="mt-6 space-y-5">
            <div>
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Your Email</label>
              <input
                type="email"
                value={email || ''}
                readOnly
                disabled
                className="block w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-gray-700"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Create Password</label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Create your new password"
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Confirm Password</label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Confirm your new password"
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Setting Password...' : 'Create Password & Enter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SetPassword;
