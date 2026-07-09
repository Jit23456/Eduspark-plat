'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth, CLASSES } from '@/context/AuthContext';
import SubjectIcon from '@/components/SubjectIcon';
import { Lock, Unlock, PlayCircle, ClipboardCheck, Crown } from 'lucide-react';

function CoursesInner() {
  const { api, user } = useAuth();
  const params = useSearchParams();
  const [subjects, setSubjects] = useState([]);
  const [subject, setSubject] = useState(params.get('subject') || '');
  const [classLevel, setClassLevel] = useState(params.get('class') || (user?.class_level ? String(user.class_level) : ''));
  const [data, setData] = useState(null);

  useEffect(() => {
    api('GET', '/catalog/subjects', null, null).then(setSubjects).catch(() => {});
  }, [api]);

  // Default the class filter to the student's own class once known.
  useEffect(() => {
    if (user?.class_level && !params.get('class')) setClassLevel(String(user.class_level));
  }, [user, params]);

  useEffect(() => {
    const q = new URLSearchParams();
    if (subject) q.set('subject', subject);
    if (classLevel) q.set('class_level', classLevel);
    api('GET', `/catalog/courses?${q}`).then(setData).catch(() => {});
  }, [api, subject, classLevel]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="mb-8 animate-fadeUp">
        <h1 className="text-3xl font-extrabold">Course <span className="grad-text">catalog</span></h1>
        <p className="text-[var(--ink-soft)] mt-1">Every subject, every class — pick where you want to shine.</p>
      </div>

      {/* Subject filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 animate-fadeUp d1">
        <button onClick={() => setSubject('')} className={`tab shrink-0 ${!subject ? 'tab-active' : 'border border-[var(--line)]'}`}>All subjects</button>
        {subjects.map(s => (
          <button key={s.slug} onClick={() => setSubject(s.slug)}
            className={`tab shrink-0 flex items-center gap-2 ${subject === s.slug ? 'tab-active' : 'border border-[var(--line)]'}`}>
            <SubjectIcon icon={s.icon} color={s.color} size={15} /> {s.name}
          </button>
        ))}
      </div>

      {/* Class filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-8 animate-fadeUp d2">
        <button onClick={() => setClassLevel('')} className={`tab shrink-0 ${!classLevel ? 'tab-active' : 'border border-[var(--line)]'}`}>All classes</button>
        {CLASSES.map(c => (
          <button key={c} onClick={() => setClassLevel(String(c))}
            className={`tab shrink-0 ${classLevel === String(c) ? 'tab-active' : 'border border-[var(--line)]'}`}>
            Class {c}
          </button>
        ))}
      </div>

      {!user && (
        <div className="glass p-4 mb-6 text-sm text-[var(--ink-soft)] animate-fadeUp d2">
          <Link href="/login" className="text-[var(--cyan)] font-bold hover:underline">Sign in</Link> to open courses.
          Premium members unlock every lesson, video and exam.
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data?.courses || []).map((c, i) => (
          <Link key={c.id} href={user ? `/courses/${c.id}` : '/login'}
            className={`glass glass-hover p-6 group relative overflow-hidden animate-fadeUp d${(i % 6) + 1}`}>
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, ${c.subject_color}, transparent)` }} />
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ background: `${c.subject_color}22`, boxShadow: `0 0 20px ${c.subject_color}2a` }}>
                <SubjectIcon icon={c.subject_icon} color={c.subject_color} size={24} />
              </div>
              {c.locked
                ? <span className="badge badge-gold"><Lock size={11} /> Premium</span>
                : <span className="badge badge-green"><Unlock size={11} /> Unlocked</span>}
            </div>
            <div className="badge badge-violet mb-2">Class {c.class_level}</div>
            <div className="font-extrabold text-lg leading-snug">{c.title}</div>
            <p className="text-sm text-[var(--ink-soft)] mt-2 line-clamp-2">{c.description}</p>
            <div className="flex items-center gap-4 mt-4 text-xs font-bold text-[var(--ink-soft)]">
              <span className="flex items-center gap-1.5"><PlayCircle size={14} className="text-[var(--cyan)]" /> {c.lesson_count} lessons</span>
              <span className="flex items-center gap-1.5"><ClipboardCheck size={14} className="text-[var(--violet)]" /> {c.exam_count} exam{c.exam_count === 1 ? '' : 's'}</span>
              <span className="ml-auto">by {c.teacher_name}</span>
            </div>
          </Link>
        ))}
      </div>

      {data && !data.courses.length && (
        <div className="glass p-10 text-center text-[var(--ink-soft)]">No courses match these filters yet.</div>
      )}

      {data && !data.premium && user && (
        <div className="text-center mt-10">
          <Link href="/premium" className="btn btn-gold !px-8 !py-3"><Crown size={17} /> Unlock everything with Premium</Link>
        </div>
      )}
    </div>
  );
}

export default function CoursesPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-16 text-[var(--ink-soft)]">Loading…</div>}>
      <CoursesInner />
    </Suspense>
  );
}
