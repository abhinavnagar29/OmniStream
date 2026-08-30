import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Radio, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import SpectrumBar from '../components/SpectrumBar';
import { toast } from '../components/AppToaster';

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname || '/';

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      toast.success('Welcome back');
      navigate(from, { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) setError("That email and password don't match.");
      else setError(err?.response?.data?.error?.message || 'Could not sign in. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-950 text-paper flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="h-9 w-9 rounded-full bg-ink-800 border border-ink-600 grid place-items-center text-signal">
            <Radio className="h-4 w-4" />
          </div>
          <div className="font-display text-xl">OmniStream</div>
        </div>

        <div className="rounded-2xl bg-ink-900 border border-ink-700 overflow-hidden">
          <SpectrumBar />
          <div className="p-7">
            <h1 className="font-display text-2xl mb-1">Welcome back</h1>
            <p className="text-paper-dim text-sm mb-6">Sign in to pick up where your signal left off.</p>

            {error ? (
              <div className="mb-4 rounded-lg bg-domain-video/10 border border-domain-video/30 text-domain-video px-3 py-2.5 text-sm">
                {error}
              </div>
            ) : null}

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs text-paper-dim mb-1.5">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg bg-ink-800 border border-ink-600 text-paper placeholder:text-paper-dim/50 focus:outline-none focus:border-signal transition-colors"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-xs text-paper-dim mb-1.5">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 px-3.5 pr-11 rounded-lg bg-ink-800 border border-ink-600 text-paper placeholder:text-paper-dim/50 focus:outline-none focus:border-signal transition-colors"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-0 top-0 h-11 w-11 grid place-items-center text-paper-dim hover:text-paper"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-lg bg-signal text-ink-950 font-medium hover:bg-signal-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-sm text-paper-dim mt-6">
          New here?{' '}
          <Link to="/signup" className="text-signal hover:text-signal-bright transition-colors">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
