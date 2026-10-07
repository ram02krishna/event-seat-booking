'use client';

import { Suspense, useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Ticket, Eye, EyeOff, Mail, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';

type AuthMode = 'login' | 'register' | 'register-otp' | 'forgot' | 'forgot-otp';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  function switchMode(newMode: AuthMode) {
    setMode(newMode);
    setError(null);
    setSuccessMessage(null);
    setOtp('');
  }

  // 1. Handle Login
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      router.push(redirectTo);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  }

  // 2. Handle Register Step 1: Send OTP
  async function handleSendRegisterOtp(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/auth/register/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setSuccessMessage(res.message || 'Verification code sent to your email.');
      setCountdown(30);
      setMode('register-otp');
    } catch (err: any) {
      setError(err.message || 'Could not send verification code.');
    } finally {
      setIsLoading(false);
    }
  }

  // 3. Handle Register Step 2: Verify OTP
  async function handleVerifyRegisterOtp(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await apiFetch('/api/auth/register/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp: otp.trim() }),
      });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      router.push(redirectTo);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired verification code.');
    } finally {
      setIsLoading(false);
    }
  }

  // 4. Handle Forgot Password Step 1: Send Reset OTP
  async function handleSendForgotOtp(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSuccessMessage(res.message || 'Password reset code sent to your email.');
      setCountdown(30);
      setMode('forgot-otp');
    } catch (err: any) {
      setError(err.message || 'Could not send reset code.');
    } finally {
      setIsLoading(false);
    }
  }

  // 5. Handle Forgot Password Step 2: Verify OTP & Reset Password
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email,
          otp: otp.trim(),
          newPassword,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      router.push(redirectTo);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please check the code.');
    } finally {
      setIsLoading(false);
    }
  }

  // Resend OTP helper
  async function handleResendOtp() {
    if (countdown > 0) return;
    setIsLoading(true);
    setError(null);
    try {
      if (mode === 'register-otp') {
        await apiFetch('/api/auth/register/send-otp', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
      } else if (mode === 'forgot-otp') {
        await apiFetch('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
      }
      setSuccessMessage('A fresh verification code has been sent to your email.');
      setCountdown(30);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-16 space-y-6">
      {/* Brand Icon & Heading */}
      <div className="text-center space-y-1">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-md shadow-indigo-600/30">
          <Ticket className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          {mode === 'login' && 'Welcome back'}
          {mode === 'register' && 'Create your account'}
          {mode === 'register-otp' && 'Verify your email'}
          {mode === 'forgot' && 'Reset your password'}
          {mode === 'forgot-otp' && 'Choose new password'}
        </h1>
        <p className="text-sm text-slate-400">
          {mode === 'login' && 'Sign in to access your tickets and bookings.'}
          {mode === 'register' && 'Register to hold and book live event seats.'}
          {mode === 'register-otp' && `Enter the 6-digit code sent to ${email}`}
          {mode === 'forgot' && "Enter your email to receive a password reset code."}
          {mode === 'forgot-otp' && `Enter the 6-digit code sent to ${email}`}
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-800/30 p-6 space-y-5">
        {/* Tab switcher for Login / Register */}
        {(mode === 'login' || mode === 'register') && (
          <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-900 border border-slate-800 gap-1">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'login' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'register' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>
        )}

        {/* Success message banner */}
        {successMessage && (
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3.5 py-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error message banner */}
        {error && (
          <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3.5 py-2.5">
            {error}
          </p>
        )}

        {/* VIEW 1: LOGIN */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
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
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-400">Password</label>
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-colors shadow-md shadow-indigo-600/20"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* VIEW 2: REGISTER (STEP 1) */}
        {mode === 'register' && (
          <form onSubmit={handleSendRegisterOtp} className="space-y-4">
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
              <label className="block text-xs font-medium text-slate-400">Password (min. 6 characters)</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-colors shadow-md shadow-indigo-600/20"
            >
              {isLoading ? 'Sending Code...' : 'Continue to Verification'}
            </button>
          </form>
        )}

        {/* VIEW 3: REGISTER OTP (STEP 2) */}
        {mode === 'register-otp' && (
          <form onSubmit={handleVerifyRegisterOtp} className="space-y-4">
            <div className="space-y-1 text-center">
              <label className="block text-xs font-medium text-slate-400">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
                placeholder="123456"
                className="w-full text-center font-mono text-2xl tracking-[0.4em] py-3 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || otp.length !== 6}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-colors shadow-md shadow-indigo-600/20"
            >
              {isLoading ? 'Verifying...' : 'Verify & Create Account'}
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="text-slate-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                Change email
              </button>

              <button
                type="button"
                disabled={countdown > 0 || isLoading}
                onClick={handleResendOtp}
                className="text-indigo-400 hover:text-indigo-300 disabled:text-slate-500 transition-colors"
              >
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        {/* VIEW 4: FORGOT PASSWORD (STEP 1) */}
        {mode === 'forgot' && (
          <form onSubmit={handleSendForgotOtp} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-400">Account Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-colors shadow-md shadow-indigo-600/20"
            >
              {isLoading ? 'Sending Code...' : 'Send Reset Code'}
            </button>

            <button
              type="button"
              onClick={() => switchMode('login')}
              className="w-full text-center text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1.5 pt-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sign In
            </button>
          </form>
        )}

        {/* VIEW 5: FORGOT PASSWORD OTP & NEW PASSWORD (STEP 2) */}
        {mode === 'forgot-otp' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-400 text-center">
                6-Digit Reset Code
              </label>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
                placeholder="123456"
                className="w-full text-center font-mono text-xl tracking-[0.3em] py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-400">New Password (min. 6 characters)</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  title={showNewPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none transition-colors"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || otp.length !== 6 || newPassword.length < 6}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-colors shadow-md shadow-indigo-600/20"
            >
              {isLoading ? 'Resetting Password...' : 'Reset Password & Sign In'}
            </button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-slate-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                Back to Sign In
              </button>

              <button
                type="button"
                disabled={countdown > 0 || isLoading}
                onClick={handleResendOtp}
                className="text-indigo-400 hover:text-indigo-300 disabled:text-slate-500 transition-colors"
              >
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="max-w-sm mx-auto px-4 py-16 text-center text-slate-400 text-sm">
          Loading sign in...
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}


