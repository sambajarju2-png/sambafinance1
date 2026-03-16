'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Shield, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

type AuthMode = 'login' | 'signup';

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (signUpError) {
          if (signUpError.message.includes('already registered')) {
            setError(t('errorAlreadyRegistered'));
          } else {
            setError(signUpError.message);
          }
          return;
        }

        setSuccess(t('checkEmail'));
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          if (signInError.message.includes('Invalid login credentials')) {
            setError(t('errorInvalidCredentials'));
          } else {
            setError(signInError.message);
          }
          return;
        }

        // Redirect to dashboard on successful login
        window.location.href = '/';
      }
    } catch {
      setError(tCommon('error'));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    setError(null);
    setGoogleLoading(true);

    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (googleError) {
        setError(googleError.message);
        setGoogleLoading(false);
      }
      // If no error, the page will redirect to Google
    } catch {
      setError(tCommon('error'));
      setGoogleLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-pw-bg px-6 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-pw-blue">
            <Shield className="h-7 w-7 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-heading text-pw-navy">
            {mode === 'login' ? t('signIn') : t('signUp')}
          </h1>
          <p className="mt-1 text-body text-pw-muted">
            {mode === 'login' ? t('signInSubtitle') : t('signUpSubtitle')}
          </p>
        </div>

        {/* Google Button */}
        <button
          onClick={handleGoogleAuth}
          disabled={googleLoading || loading}
          className="btn-press flex w-full items-center justify-center gap-3 rounded-button border border-pw-border bg-pw-surface px-4 py-3 text-body font-medium text-pw-text transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          {googleLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-pw-muted" strokeWidth={1.5} />
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          {t('continueWithGoogle')}
        </button>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-pw-border" />
          <span className="text-label text-pw-muted">{t('or')}</span>
          <div className="h-px flex-1 bg-pw-border" />
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="email" className="mb-1.5 block text-label text-pw-text">
              {t('email')}
            </label>
            <div className="relative">
              <Mail
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pw-muted"
                strokeWidth={1.5}
              />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="naam@voorbeeld.nl"
                className="w-full rounded-input border border-pw-border bg-pw-surface py-2.5 pl-10 pr-4 text-body text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="mb-1.5 block text-label text-pw-text">
              {t('password')}
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pw-muted"
                strokeWidth={1.5}
              />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder={mode === 'signup' ? t('passwordMinLength') : '••••••••'}
                className="w-full rounded-input border border-pw-border bg-pw-surface py-2.5 pl-10 pr-12 text-body text-pw-text placeholder:text-pw-muted/50 focus:border-pw-blue focus:outline-none focus:ring-1 focus:ring-pw-blue"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-pw-muted hover:text-pw-text"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>

          {/* Forgot password link (login only) */}
          {mode === 'login' && (
            <div className="text-right">
              <button
                type="button"
                className="text-label text-pw-blue hover:underline"
                onClick={async () => {
                  if (!email) {
                    setError(t('enterEmailFirst'));
                    return;
                  }
                  setLoading(true);
                  const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
                  });
                  setLoading(false);
                  if (resetError) {
                    setError(resetError.message);
                  } else {
                    setSuccess(t('resetEmailSent'));
                  }
                }}
              >
                {t('forgotPassword')}
              </button>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 rounded-input border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-pw-red" strokeWidth={1.5} />
              <p className="text-label text-pw-red">{error}</p>
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="rounded-input border border-green-200 bg-green-50 px-3 py-2.5">
              <p className="text-label text-pw-green">{success}</p>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading || googleLoading}
            className="btn-press flex w-full items-center justify-center gap-2 rounded-button bg-pw-blue px-4 py-3 text-body font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />}
            {mode === 'login' ? t('signIn') : t('signUp')}
          </button>
        </form>

        {/* Switch mode link */}
        <p className="mt-6 text-center text-body text-pw-muted">
          {mode === 'login' ? t('noAccount') : t('hasAccount')}{' '}
          <Link
            href={mode === 'login' ? '/auth/signup' : '/auth/login'}
            className="font-medium text-pw-blue hover:underline"
          >
            {mode === 'login' ? t('signUp') : t('signIn')}
          </Link>
        </p>
      </div>
    </main>
  );
}
