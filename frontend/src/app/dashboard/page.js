'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, CLASSES } from '@/context/AuthContext';
import SubjectIcon from '@/components/SubjectIcon';
import { Crown, Lock, Trophy, BookOpenCheck, ClipboardCheck, Flame, ArrowRight, Pencil } from 'lucide-react';

export default function DashboardPage() {
  const { api, user, loading, isPremium, updateProfile } = useAuth();
  const router = useRouter();
  const [progress, setProgress] = useState(null);
  const [pickClass, setPickClass] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
    if (!loading && user && (user.role === 'TEACHER' || user.role === 'ADMIN')) router.push('/teacher');
  }, [loading, user, router]);

  useEffect(() => {
    if (user) api('GET', '/progress/me').then(setProgress).catch(() => {});
  }, [api, user]);

  if (loading || !user) return <div className="max-w-6xl mx-auto px-4 py-20 text-[var(--ink-soft)]">Loading…</div>;

  const needsClass = user.role === 'STUDENT' && !user.class_level;
  const overall = progress?.overall;

  const chooseClass = async (c) => {
    await updateProfile({ class_level: c });
    setPickClass(false);
    api('GET', '/progress/me').then(setProgress).catch(() => {});
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 mb-8 animate-fadeUp">
        <div>
          <h1 className="text-3xl font-extrabold">Hi {user.name?.split(' ')[0]} 👋</h1>
          <p className="text-[var(--ink-soft)] mt-1">
            {user.class_level ? <>Class {user.class_level} · </> : null}
            {isPremium ? 'Premium member — everything is unlocked.' : 'Free account — upgrade to unlock all courses.'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {user.class_level && (
            <button onClick={() => setPickClass(v => !v)} className="btn btn-ghost btn-sm"><Pencil size={14} /> Class {user.class_level}</button>
          )}
          {isPremium
            ? <span className="badge badge-gold !text-xs !px-3 !py-1.5"><Crown size={13} /> Premium</span>
            : <Link href="/premium" className="btn btn-gold btn-sm"><Crown size={14} /> Upgrade</Link>}
        </div>
      </div>

      {/* Class picker (first Google sign-in or change) */}
      {(needsClass || pickClass) && (
        <div className="glass p-6 mb-8 animate-pop">
          <div className="font-extrabold mb-1">{needsClass ? 'One last step — which class are you in?' : 'Change your class'}</div>
          <p className="text-sm text-[var(--ink-soft)] mb-4">Your dashboard and courses are tailored to your class.</p>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {CLASSES.map(c => (
              <button key={c} onClick={() => chooseClass(c)}
                className={`py-2.5 rounded-lg font-bold border transition-all ${user.class_level === c
                  ? 'bg-gradient-to-br from-[var(--violet)] to-[var(--cyan)] text-white border-transparent'
                  : 'border-[var(--line)] text-[var(--ink-soft)] hover:border-[var(--violet)] hover:text-white'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Not premium banner */}
      {!isPremium && (
        <Link href="/premium" className="block glass glass-hover p-5 mb-8 border-[rgba(251,191,36,0.35)] animate-fadeUp d1">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-[rgba(251,191,36,0.15)] flex items-center justify-center shrink-0">
              <Lock className="text-[var(--gold)]" size={20} />
            </div>
            <div>
              <div className="font-extrabold text-[var(--gold)]">Courses are locked on the free plan</div>
              <div className="text-sm text-[var(--ink-soft)]">Upgrade to Premium to open every lesson, AI teacher video and exam in all 10 classes.</div>
            </div>
            <ArrowRight className="ml-auto text-[var(--gold)]" />
          </div>
        </Link>
      )}

      {/* Overall stats */}
      {overall && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { icon: Flame, label: 'Courses started', value: `${overall.courses_started}/${overall.courses_total}`, color: 'var(--pink)' },
            { icon: BookOpenCheck, label: 'Lessons completed', value: overall.lessons_done, color: 'var(--cyan)' },
            { icon: ClipboardCheck, label: 'Exams taken', value: overall.exams_taken, color: 'var(--violet)' },
            { icon: Trophy, label: 'Average score', value: overall.average_exam_percent !== null ? `${overall.average_exam_percent}%` : '—', color: 'var(--gold)' },
          ].map((s, i) => (
            <div key={s.label} className={`glass glass-hover p-5 animate-fadeUp d${i + 1}`}>
              <s.icon size={22} style={{ color: s.color }} className="mb-3" />
              <div className="text-2xl font-black">{s.value}</div>
              <div className="text-xs font-bold text-[var(--ink-soft)] uppercase tracking-widest mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Subject progress for my class */}
      <div className="flex items-center gap-3 mb-5 animate-fadeUp">
        <h2 className="text-xl font-extrabold">My Class {user.class_level} subjects</h2>
        <Link href="/courses" className="text-sm font-bold text-[var(--cyan)] hover:underline ml-auto">Browse all classes →</Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {(progress?.courses || []).map((c, i) => (
          <Link key={c.course_id} href={`/courses/${c.course_id}`}
            className={`glass glass-hover p-5 animate-fadeUp d${(i % 8) + 1}`}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${c.subject_color}22` }}>
                <SubjectIcon icon={c.subject_icon} color={c.subject_color} />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold truncate">{c.subject_name}</div>
                <div className="text-xs text-[var(--ink-soft)]">{c.lessons_done}/{c.lessons_total} lessons
                  {c.best_exam_percent !== null ? ` · best exam ${c.best_exam_percent}%` : ''}
                </div>
              </div>
              <div className="ml-auto text-lg font-black" style={{ color: c.subject_color }}>{c.percent}%</div>
            </div>
            <div className="progress-track mt-4">
              <div className="progress-fill" style={{ width: `${c.percent}%` }} />
            </div>
          </Link>
        ))}
        {progress && !progress.courses.length && (
          <div className="glass p-8 text-center text-[var(--ink-soft)] sm:col-span-2">
            Pick your class above to see your subjects.
          </div>
        )}
      </div>
    </div>
  );
}
