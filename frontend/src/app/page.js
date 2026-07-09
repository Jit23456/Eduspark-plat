'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import SubjectIcon from '@/components/SubjectIcon';
import {
  Sparkles, Crown, PlayCircle, ClipboardCheck, TrendingUp, ShieldCheck,
  GraduationCap, Video, BadgeCheck, ArrowRight, BookOpenCheck, Star,
} from 'lucide-react';

const STATS = [
  { value: '8', label: 'Subjects' },
  { value: '10', label: 'Classes' },
  { value: '80+', label: 'Courses' },
  { value: '400+', label: 'Lessons' },
];

const FEATURES = [
  { icon: Video, title: 'AI Teacher Videos', text: 'A one-minute teacher-led video intro for every course — real humanised voice, expressive hand gestures, zero boredom.', color: 'var(--pink)' },
  { icon: BookOpenCheck, title: 'BC Curriculum Aligned', text: 'Every course references the official British Columbia curriculum, grade by grade, subject by subject.', color: 'var(--cyan)' },
  { icon: ClipboardCheck, title: 'Chapter Exams', text: 'Auto-graded MCQ exams after every course with instant answer review and score history.', color: 'var(--gold)' },
  { icon: TrendingUp, title: 'Progress Tracking', text: 'Watch your lesson completion and exam scores grow on a beautiful live dashboard.', color: 'var(--green)' },
  { icon: GraduationCap, title: 'Real Teachers', text: 'Teachers build the curriculum, add lessons and exams, and follow every student’s progress.', color: 'var(--violet)' },
  { icon: ShieldCheck, title: 'Secure Payments', text: 'Premium unlock via Razorpay with bank-grade signature verification.', color: 'var(--red)' },
];

export default function LandingPage() {
  const { api, user } = useAuth();
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    api('GET', '/catalog/subjects', null, null).then(setSubjects).catch(() => {});
  }, [api]);

  return (
    <div>
      {/* ------------------------------- Hero ------------------------------- */}
      <section className="max-w-7xl mx-auto px-4 pt-20 pb-16 text-center relative">
        {/* floating subject chips */}
        <div className="hidden lg:block absolute left-8 top-24 animate-float">
          <div className="glass px-4 py-3 flex items-center gap-2 text-sm font-bold"><span style={{ color: '#6366f1' }}>∑</span> Mathematics</div>
        </div>
        <div className="hidden lg:block absolute right-10 top-36 animate-float-slow">
          <div className="glass px-4 py-3 flex items-center gap-2 text-sm font-bold"><span style={{ color: '#22d3ee' }}>⚛</span> Physics</div>
        </div>
        <div className="hidden lg:block absolute left-24 bottom-10 animate-float-slow">
          <div className="glass px-4 py-3 flex items-center gap-2 text-sm font-bold"><span style={{ color: '#ec4899' }}>✎</span> English</div>
        </div>
        <div className="hidden lg:block absolute right-24 bottom-24 animate-float">
          <div className="glass px-4 py-3 flex items-center gap-2 text-sm font-bold"><span style={{ color: '#8b5cf6' }}>{'</>'}</span> Coding</div>
        </div>

        <div className="animate-fadeUp inline-flex items-center gap-2 badge badge-violet mb-6 !text-xs !px-4 !py-1.5">
          <Sparkles size={13} /> Classes 1–10 · Aligned with the BC Curriculum
        </div>
        <h1 className="animate-fadeUp d1 text-4xl sm:text-6xl font-black leading-tight tracking-tight">
          Every subject. Every class.<br />
          <span className="grad-text">One spark of genius.</span>
        </h1>
        <p className="animate-fadeUp d2 max-w-2xl mx-auto mt-6 text-lg text-[var(--ink-soft)]">
          Math, Physics, Chemistry, Biology, Geography, History, Computer Science and English —
          taught with AI teacher videos, real exams and live progress tracking, for every student from Class 1 to 10.
        </p>
        <div className="animate-fadeUp d3 flex flex-wrap justify-center gap-3 mt-9">
          {user ? (
            <Link href={user.role === 'STUDENT' ? '/dashboard' : '/teacher'} className="btn btn-primary !px-7 !py-3 !text-base">
              Go to my {user.role === 'STUDENT' ? 'dashboard' : 'studio'} <ArrowRight size={17} />
            </Link>
          ) : (
            <>
              <Link href="/register" className="btn btn-primary !px-7 !py-3 !text-base">Start learning free <ArrowRight size={17} /></Link>
              <Link href="/premium" className="btn btn-gold !px-7 !py-3 !text-base"><Crown size={17} /> Go Premium</Link>
            </>
          )}
        </div>

        {/* stats */}
        <div className="animate-fadeUp d4 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto mt-16">
          {STATS.map(s => (
            <div key={s.label} className="glass glass-hover py-5">
              <div className="text-3xl font-black grad-text">{s.value}</div>
              <div className="text-xs font-bold text-[var(--ink-soft)] uppercase tracking-widest mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ----------------------------- Subjects ----------------------------- */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-10 animate-fadeUp">
          <h2 className="text-3xl font-extrabold">Explore all <span className="grad-text">8 subjects</span></h2>
          <p className="text-[var(--ink-soft)] mt-2">A complete course for every subject in every class, 1 through 10.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {subjects.map((s, i) => (
            <Link key={s.id} href={`/courses?subject=${s.slug}`}
              className={`glass glass-hover p-6 group animate-fadeUp d${(i % 8) + 1}`}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 group-hover:rotate-3"
                style={{ background: `${s.color}22`, boxShadow: `0 0 24px ${s.color}33` }}>
                <SubjectIcon icon={s.icon} color={s.color} size={24} />
              </div>
              <div className="font-extrabold">{s.name}</div>
              <div className="text-xs text-[var(--ink-soft)] mt-1.5 leading-relaxed">{s.description}</div>
              <div className="badge badge-cyan mt-3">{s.course_count} courses</div>
            </Link>
          ))}
        </div>
      </section>

      {/* ----------------------------- Features ----------------------------- */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-10 animate-fadeUp">
          <h2 className="text-3xl font-extrabold">Built to feel <span className="grad-text">premium</span></h2>
          <p className="text-[var(--ink-soft)] mt-2">Everything a modern classroom has — and a few things it doesn&apos;t.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div key={f.title} className={`glass glass-hover p-6 animate-fadeUp d${(i % 6) + 1}`}>
              <f.icon size={26} style={{ color: f.color }} className="mb-4" />
              <div className="font-extrabold">{f.title}</div>
              <div className="text-sm text-[var(--ink-soft)] mt-1.5 leading-relaxed">{f.text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------- How ------------------------------- */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="glass p-8 sm:p-12 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px shimmer-line" />
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold">How Eduspark works</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-8 text-center">
            {[
              { n: '1', icon: GraduationCap, t: 'Pick your class', d: 'Sign up free with Google or email and choose Class 1–10.' },
              { n: '2', icon: Crown, t: 'Unlock Premium', d: 'One plan unlocks every course, every subject, every class — via Razorpay.' },
              { n: '3', icon: PlayCircle, t: 'Learn & conquer', d: 'Watch the AI teacher, finish lessons, ace exams, track progress.' },
            ].map(step => (
              <div key={step.n}>
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[var(--violet)] to-[var(--cyan)] flex items-center justify-center mb-4 animate-glow">
                  <step.icon className="text-white" size={24} />
                </div>
                <div className="font-extrabold text-lg">{step.t}</div>
                <div className="text-sm text-[var(--ink-soft)] mt-1.5">{step.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------- CTA ------------------------------- */}
      <section className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="animate-fadeUp">
          <div className="flex justify-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => <Star key={i} size={20} className="text-[var(--gold)] fill-[var(--gold)]" />)}
          </div>
          <h2 className="text-3xl sm:text-4xl font-black">Ready to spark your <span className="grad-text">best year yet?</span></h2>
          <p className="text-[var(--ink-soft)] mt-3">Free to join. Premium unlocks everything.</p>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <Link href="/register" className="btn btn-primary !px-8 !py-3 !text-base"><BadgeCheck size={18} /> Create free account</Link>
            <Link href="/courses" className="btn btn-ghost !px-8 !py-3 !text-base">Browse courses</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
