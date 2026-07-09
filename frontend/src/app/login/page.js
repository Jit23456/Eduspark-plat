'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const DEMO_ACCOUNTS = [
  ['parent@example.com', 'Customer / Parent'],
  ['coach@fvca.ca', 'Coach'],
  ['admin@fvca.ca', 'Franchisor Admin'],
  ['management@fvca.ca', 'Franchisor Management'],
  ['surrey.admin@fvca.ca', 'Franchisee Admin'],
  ['surrey.mgmt@fvca.ca', 'Franchisee Management'],
];

export default function LoginPage() {
  const { login, setPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [needsReset, setNeedsReset] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const destination = (user) => {
    if (['FRANCHISOR_MANAGEMENT', 'FRANCHISOR_ADMIN', 'FRANCHISEE_MANAGEMENT', 'FRANCHISEE_ADMIN', 'EVENT_MANAGER'].includes(user.role)) return '/admin';
    if (user.role === 'COACH') return '/coach';
    return '/dashboard';
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const user = await login(email, pw);
      if (user.must_reset_password) setNeedsReset(true);
      else router.push(destination(user));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const submitNewPassword = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const user = await setPassword(newPw);
      router.push(destination(user));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="card p-8 animate-slideUp">
        <div className="text-3xl mb-2">♞</div>
        <h1 className="text-2xl font-extrabold">{needsReset ? 'Set your new password' : 'Welcome back'}</h1>
        <p className="text-sm text-[var(--ink-soft)] mt-1">
          {needsReset
            ? 'You signed in with a temporary password. Choose a new one to continue.'
            : 'Sign in to manage your family, classes and events.'}
        </p>

        {error && <div className="mt-4 text-sm text-[var(--red)] bg-[#fbe9e5] rounded-lg p-3">{error}</div>}

        {!needsReset ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={pw} onChange={e => setPw(e.target.value)} required />
            </div>
            <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
        ) : (
          <form onSubmit={submitNewPassword} className="mt-6 space-y-4">
            <div>
              <label className="label">New password (min 8 characters)</label>
              <input className="input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} minLength={8} required />
            </div>
            <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Save & continue'}</button>
          </form>
        )}

        {!needsReset && (
          <p className="text-sm text-[var(--ink-soft)] mt-6 text-center">
            New family? <Link href="/register" className="text-[var(--gold)] font-semibold">Create an account</Link>
          </p>
        )}
      </div>

      <div className="card p-5 mt-6 text-xs text-[var(--ink-soft)]">
        <div className="font-bold text-[var(--ink)] mb-2">Demo accounts (password: <code>Password123!</code>)</div>
        <div className="grid grid-cols-1 gap-1">
          {DEMO_ACCOUNTS.map(([em, label]) => (
            <button key={em} onClick={() => { setEmail(em); setPw('Password123!'); }}
              className="text-left hover:text-[var(--gold)] transition">
              <span className="font-mono">{em}</span> — {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
