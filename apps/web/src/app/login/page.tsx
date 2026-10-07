'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Ticket } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('alice@example.com');
  const [password, setPassword] = useState('password123');
  const [role, setRole] = useState<'CUSTOMER' | 'ORGANIZER' | 'STAFF'>('CUSTOMER');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { email, password } : { email, password, role };
      await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(body) });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      router.push('/');
    } catch (err: any) {
      setError(err.message || `${mode === 'login' ? 'Login' : 'Registration'} failed`);
    } finally {
      setIsLoading(false);
    }
  }

  async function quickLogin(userEmail: string) {
    setIsLoading(true);
    setError(null);
    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: userEmail, password: 'password123' }),
      });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-16 space-y-6">
      {/* Brand */}
      <div className="text-center space-y-1">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center mx-auto mb-3">
          <Ticket className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-xl font-bold text-white">
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="text-sm text-slate-400">
          {mode === 'login'
            ? 'Sign in to access your tickets.'
            : 'Register to start booking seats.'}
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-6 space-y-5">
        {/* Tab switcher */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-900 border border-slate-800 gap-1">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); }}
              className={`py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                mode === m
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {mode === 'register' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-400">Account Role</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'CUSTOMER', label: 'Customer' },
                  { value: 'ORGANIZER', label: 'Organizer' },
                  { value: 'STAFF', label: 'Staff' },
                ].map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value as any)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      role === r.value
                        ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500 shadow-sm'
                        : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-colors"
          >
            {isLoading
              ? 'Please wait...'
              : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Demo accounts */}
        <div className="pt-2 border-t border-slate-800 space-y-3">
          <p className="text-xs text-slate-500 text-center">
            Quick demo login (password: password123)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Alice', sub: 'Customer', email: 'alice@example.com' },
              { label: 'Bob', sub: 'Customer', email: 'bob@example.com' },
              { label: 'Organizer', sub: 'Dashboard', email: 'organizer@eventseat.com' },
              { label: 'Staff Gate', sub: 'Scanner', email: 'staff@eventseat.com' },
            ].map((acc) => (
              <button
                key={acc.email}
                type="button"
                disabled={isLoading}
                onClick={() => quickLogin(acc.email)}
                className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-left transition-colors disabled:opacity-50"
              >
                <span className="block text-xs font-semibold text-white">{acc.label}</span>
                <span className="text-[11px] text-slate-500">{acc.sub}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
