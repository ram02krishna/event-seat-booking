'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, User, KeyRound, Sparkles, UserPlus, LogIn, CheckCircle2 } from 'lucide-react';

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

      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

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
      setError(err.message || 'Quick login failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto px-4 py-12 sm:py-16 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Authentication Portal</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          {mode === 'login' ? 'Welcome Back' : 'Create an Account'}
        </h1>
        <p className="text-xs text-slate-400">
          {mode === 'login'
            ? 'Sign in to hold seats, checkout, and view your tickets.'
            : 'Register to access live venue maps and booking privileges.'}
        </p>
      </div>

      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 sm:p-7 shadow-2xl space-y-6 backdrop-blur-xl">
        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === 'login'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === 'register'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Account Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="CUSTOMER">Customer (Attendee)</option>
                <option value="ORGANIZER">Organizer (Host & Analytics)</option>
                <option value="STAFF">Staff (Gate Turnstile Scanner)</option>
              </select>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-xs tracking-wide transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50"
          >
            {isLoading
              ? mode === 'login'
                ? 'Authenticating...'
                : 'Creating Account...'
              : mode === 'login'
              ? 'Sign In to Account'
              : 'Create New Account'}
          </button>
        </form>

        {/* Quick Demo Login Chips */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">
            1-Click Demo Profiles (password: password123)
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => quickLogin('alice@example.com')}
              className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 text-left transition-all hover:border-slate-700 disabled:opacity-50"
            >
              <span className="block font-bold text-white">Alice</span>
              <span className="text-[10px] text-slate-400">Customer</span>
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => quickLogin('bob@example.com')}
              className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 text-left transition-all hover:border-slate-700 disabled:opacity-50"
            >
              <span className="block font-bold text-white">Bob</span>
              <span className="text-[10px] text-slate-400">Customer</span>
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => quickLogin('organizer@eventseat.com')}
              className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 border border-indigo-500/30 text-left transition-all hover:border-indigo-500/50 disabled:opacity-50"
            >
              <span className="block font-bold text-indigo-300">Organizer</span>
              <span className="text-[10px] text-indigo-400">Dashboard & Stats</span>
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => quickLogin('staff@eventseat.com')}
              className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 border border-emerald-500/30 text-left transition-all hover:border-emerald-500/50 disabled:opacity-50"
            >
              <span className="block font-bold text-emerald-300">Staff Gate</span>
              <span className="text-[10px] text-emerald-400">Camera Scanner</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
