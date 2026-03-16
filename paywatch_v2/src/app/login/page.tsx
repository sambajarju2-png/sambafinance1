'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isRegister) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    setLoading(true);
    setError(null);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-[360px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-heading text-navy tracking-tight">PayWatch</h1>
          <p className="text-body text-muted mt-1">
            {isRegister ? t('register') : t('login')}
          </p>
        </div>

        {/* Error message */}
        {error ? (
          <div className="mb-4 p-3 rounded-input bg-red-light border border-red/20">
            <p className="text-caption text-red">{error}</p>
          </div>
        ) : null}

        {/* Email/password form */}
        <form onSubmit={handleEmailAuth} className="space-y-3">
          <div>
            <label htmlFor="email" className="block text-label text-muted mb-1">
              {t('email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2.5 text-body text-text bg-surface border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue transition-colors"
              placeholder="je@email.nl"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-label text-muted mb-1">
              {t('password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              className="w-full px-3 py-2.5 text-body text-text bg-surface border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-press w-full py-2.5 px-4 bg-blue text-white text-[13px] font-semibold rounded-btn disabled:opacity-50 transition-opacity"
          >
            {loading ? '...' : isRegister ? t('register') : t('login')}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-caption text-muted">of</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Google auth */}
        <button
          onClick={handleGoogleAuth}
          disabled={loading}
          className="btn-press w-full py-2.5 px-4 bg-surface text-text text-[13px] font-semibold rounded-btn border border-border disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
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
          {isRegister ? t('registerWithGoogle') : t('loginWithGoogle')}
        </button>

        {/* Toggle register/login */}
        <p className="text-center text-caption text-muted mt-6">
          {isRegister ? t('hasAccount') : t('noAccount')}{' '}
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-blue font-semibold"
          >
            {isRegister ? t('login') : t('register')}
          </button>
        </p>
      </div>
    </div>
  );
}
