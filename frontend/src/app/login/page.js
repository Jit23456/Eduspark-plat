'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import GoogleButton from '@/components/GoogleButton';
import { Sparkles } from 'lucide-react';

export default function LoginPage() {
  const { login, googleLogin } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const goHome = (u) => router.push(u.role === 'TEACHER' || u.role === 'ADMIN' ? '/teacher' : '/dashboard');

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try { goHome(await login(email, password)); }
    catch (err) { setError(err.message); setBusy(false); }
  };

  const onGoogle = useCallback(async (credential) => {
    setError('');
    try { goHome(await googleLogin(credential)); }
    catch (err) { setError(err.message); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleLogin]);

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="glass p-8 animate-fadeUp">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--violet)] to-[var(--cyan)] items-center justify-center mb-4 animate-glow">
            <Sparkles className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold">Welcome back</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-1">Sign in to continue learning</p>
        </div>

        <GoogleButton onCredential={onGoogle} />
        <div className="flex items-center gap-3 my-6">
          <div className="h-px flex-1 bg-[var(--line)]" />
          <span className="text-xs text-[var(--ink-soft)] font-semibold">OR</span>
          <div className="h-px flex-1 bg-[var(--line)]" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && <p className="text-sm text-[var(--red)]">{error}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>

        <p className="text-sm text-[var(--ink-soft)] text-center mt-6">
          New to Eduspark? <Link href="/register" className="text-[var(--cyan)] font-semibold hover:underline">Create an account</Link>
        </p>

        <div className="mt-6 pt-5 border-t border-[var(--line)] text-xs text-[var(--ink-soft)] space-y-1">
          <p className="font-bold text-[var(--ink)]">Demo accounts (password in brackets):</p>
          <p>Student — student@eduspark.com (Student123!)</p>
          <p>Premium student — premium@eduspark.com (Premium123!)</p>
          <p>Teacher — teacher@eduspark.com (Teacher123!)</p>
        </div>
      </div>
    </div>
  );
}
