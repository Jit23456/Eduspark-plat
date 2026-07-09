'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, CLASSES } from '@/context/AuthContext';
import GoogleButton from '@/components/GoogleButton';
import { GraduationCap, School } from 'lucide-react';

export default function RegisterPage() {
  const { register, googleLogin } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', class_level: 6, role: 'STUDENT' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const goHome = (u) => router.push(u.role === 'TEACHER' || u.role === 'ADMIN' ? '/teacher' : '/dashboard');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try { goHome(await register(form)); }
    catch (err) { setError(err.message); setBusy(false); }
  };

  const onGoogle = useCallback(async (credential) => {
    setError('');
    try { goHome(await googleLogin(credential, form.class_level)); }
    catch (err) { setError(err.message); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleLogin, form.class_level]);

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="glass p-8 animate-fadeUp">
        <div className="text-center mb-7">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--pink)] to-[var(--violet)] items-center justify-center mb-4 animate-glow">
            <GraduationCap className="text-white" />
          </div>
          <h1 className="text-2xl font-extrabold">Create your account</h1>
          <p className="text-sm text-[var(--ink-soft)] mt-1">Join thousands of students from Class 1 to 10</p>
        </div>

        {/* Role toggle */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {['STUDENT', 'TEACHER'].map(r => (
            <button key={r} type="button" onClick={() => set('role', r)}
              className={`tab justify-center flex items-center gap-2 ${form.role === r ? 'tab-active' : 'border border-[var(--line)]'}`}>
              {r === 'STUDENT' ? <GraduationCap size={16} /> : <School size={16} />}
              {r === 'STUDENT' ? 'I am a Student' : 'I am a Teacher'}
            </button>
          ))}
        </div>

        {form.role === 'STUDENT' && (
          <>
            <GoogleButton onCredential={onGoogle} text="signup_with" />
            <p className="text-[11px] text-[var(--ink-soft)] text-center mt-2">Signing up with Google? Pick your class below first.</p>
            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-[var(--line)]" />
              <span className="text-xs text-[var(--ink-soft)] font-semibold">OR</span>
              <div className="h-px flex-1 bg-[var(--line)]" />
            </div>
          </>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your name" required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" required />
          </div>
          <div>
            <label className="label">Password (min 8 characters)</label>
            <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="••••••••" minLength={8} required />
          </div>
          {form.role === 'STUDENT' && (
            <div>
              <label className="label">Your class</label>
              <div className="grid grid-cols-5 gap-2">
                {CLASSES.map(c => (
                  <button key={c} type="button" onClick={() => set('class_level', c)}
                    className={`py-2 rounded-lg text-sm font-bold border transition-all ${Number(form.class_level) === c
                      ? 'bg-gradient-to-br from-[var(--violet)] to-[var(--cyan)] text-white border-transparent shadow-lg'
                      : 'border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--line-strong)] hover:text-white'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-sm text-[var(--red)]">{error}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Creating account…' : 'Create free account'}</button>
        </form>

        <p className="text-sm text-[var(--ink-soft)] text-center mt-6">
          Already have an account? <Link href="/login" className="text-[var(--cyan)] font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
