'use client';

import { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import SubjectIcon from '@/components/SubjectIcon';
import AITeacher from '@/components/AITeacher';
import {
  Lock, Crown, PlayCircle, CheckCircle2, Circle, Clock, ClipboardCheck,
  TrendingUp, ChevronDown, BadgeCheck, XCircle, Award, ArrowLeft, Video,
} from 'lucide-react';

export default function CourseDetailPage({ params }) {
  const { id } = use(params);
  const { api, user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('learn');
  const [openLesson, setOpenLesson] = useState(null);   // lesson id
  const [lessonContent, setLessonContent] = useState({}); // id -> lesson
  const [exam, setExam] = useState(null);                // exam being taken
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  const load = useCallback(() => api('GET', `/courses/${id}`).then(setData).catch(() => {}), [api, id]);
  useEffect(() => { if (user) load(); }, [user, load]);

  if (loading || !user || !data) return <div className="max-w-5xl mx-auto px-4 py-20 text-[var(--ink-soft)]">Loading course…</div>;

  const { course, locked, lessons, exams, progress } = data;
  const color = course.subject_color;
  const doneSet = new Set(progress.completed_lesson_ids);

  const toggleLesson = async (lesson) => {
    if (locked) return;
    if (openLesson === lesson.id) { setOpenLesson(null); return; }
    setOpenLesson(lesson.id);
    if (!lessonContent[lesson.id]) {
      try {
        const full = await api('GET', `/courses/${id}/lessons/${lesson.id}`);
        setLessonContent(m => ({ ...m, [lesson.id]: full }));
      } catch { /* gated */ }
    }
  };

  const completeLesson = async (lessonId) => {
    await api('POST', `/courses/${id}/lessons/${lessonId}/complete`);
    load();
  };

  const startExam = async (e) => {
    setResult(null); setAnswers({});
    const d = await api('GET', `/courses/exams/${e.id}/take`);
    setExam(d);
  };

  const submitExam = async () => {
    setBusy(true);
    try {
      const r = await api('POST', `/courses/exams/${exam.exam.id}/submit`, { answers });
      setResult(r);
      setExam(null);
      load();
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/courses" className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--ink-soft)] hover:text-white mb-5">
        <ArrowLeft size={15} /> All courses
      </Link>

      {/* Header */}
      <div className="glass p-6 sm:p-8 mb-6 relative overflow-hidden animate-fadeUp">
        <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
        <div className="flex flex-wrap items-center gap-5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 animate-float"
            style={{ background: `${color}22`, boxShadow: `0 0 34px ${color}44` }}>
            <SubjectIcon icon={course.subject_icon} color={color} size={30} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="badge badge-violet">Class {course.class_level}</span>
              <span className="badge" style={{ background: `${color}22`, color }}>{course.subject_name}</span>
              {locked ? <span className="badge badge-gold"><Lock size={11} /> Premium</span> : <span className="badge badge-green"><BadgeCheck size={11} /> Unlocked</span>}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold">{course.title}</h1>
            <p className="text-sm text-[var(--ink-soft)] mt-1.5">{course.description}</p>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-bold text-[var(--ink-soft)]">
              <span>Teacher: {course.teacher_name}</span>
              {course.bc_curriculum_url && (
                <a href={course.bc_curriculum_url} target="_blank" rel="noreferrer" className="text-[var(--cyan)] hover:underline flex items-center gap-1">
                  <BadgeCheck size={13} /> BC Curriculum — Grade {course.class_level}
                </a>
              )}
            </div>
          </div>
          {/* progress ring */}
          <div className="relative w-20 h-20 shrink-0">
            <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
              <circle cx="40" cy="40" r="34" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${(progress.percent / 100) * 213.6} 213.6`} style={{ transition: 'stroke-dasharray 0.8s ease' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-black">{progress.percent}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Paywall banner */}
      {locked && (
        <div className="glass p-6 mb-6 border-[rgba(251,191,36,0.4)] animate-pop text-center">
          <Crown className="mx-auto text-[var(--gold)] mb-3" size={30} />
          <div className="font-extrabold text-lg">This course is locked</div>
          <p className="text-sm text-[var(--ink-soft)] mt-1 max-w-lg mx-auto">
            The AI teacher video, all {lessons.length} lessons and the chapter exam unlock with Eduspark Premium —
            one plan for every course in every class, 1 to 10.
          </p>
          <Link href="/premium" className="btn btn-gold mt-4 !px-8"><Crown size={16} /> Upgrade to Premium</Link>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto animate-fadeUp d1">
        {[
          ['learn', <><Video size={15} /> Video & Curriculum</>],
          ['exams', <><ClipboardCheck size={15} /> Exams</>],
          ['progress', <><TrendingUp size={15} /> My Progress</>],
        ].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`tab flex items-center gap-2 shrink-0 ${tab === k ? 'tab-active' : 'border border-[var(--line)]'}`}>{label}</button>
        ))}
      </div>

      {/* ------------------------- Learn tab ------------------------- */}
      {tab === 'learn' && (
        <div className="space-y-6 animate-fadeUp">
          {/* AI teacher video */}
          {locked ? (
            <div className="glass p-10 text-center">
              <div className="relative inline-block">
                <Video size={40} className="text-[var(--ink-soft)]" />
                <Lock size={18} className="absolute -right-2 -bottom-1 text-[var(--gold)]" />
              </div>
              <p className="text-sm text-[var(--ink-soft)] mt-3">The 1-minute AI teacher video is a Premium feature.</p>
            </div>
          ) : course.video_script ? (
            <AITeacher
              script={course.video_script}
              subjectName={course.subject_name}
              classLevel={course.class_level}
              color={color}
              bcUrl={course.bc_curriculum_url}
            />
          ) : null}

          {/* Curriculum */}
          <div>
            <h2 className="font-extrabold text-lg mb-3">Curriculum · {lessons.length} lessons</h2>
            <div className="space-y-3">
              {lessons.map((l, i) => {
                const done = doneSet.has(l.id);
                const open = openLesson === l.id;
                const full = lessonContent[l.id];
                return (
                  <div key={l.id} className={`glass overflow-hidden ${locked ? 'opacity-80' : ''}`}>
                    <button onClick={() => toggleLesson(l)} className="w-full flex items-center gap-4 p-4 text-left">
                      <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-black text-sm"
                        style={{ background: `${color}1e`, color }}>{i + 1}</span>
                      {done ? <CheckCircle2 size={20} className="text-[var(--green)] shrink-0" /> : <Circle size={20} className="text-[var(--ink-soft)] shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <div className="font-bold truncate">{l.title}</div>
                        <div className="text-xs text-[var(--ink-soft)] flex items-center gap-1.5 mt-0.5"><Clock size={11} /> {l.duration_minutes} min</div>
                      </div>
                      {locked ? <Lock size={16} className="text-[var(--gold)] shrink-0" />
                        : <ChevronDown size={18} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />}
                    </button>
                    {open && !locked && (
                      <div className="px-5 pb-5 pt-1 border-t border-[var(--line)] animate-fadeUp">
                        {full ? (
                          <>
                            {full.video_url && (
                              <a href={full.video_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm mb-3"><PlayCircle size={14} /> Watch lesson video</a>
                            )}
                            <div className="text-sm text-[var(--ink-soft)] leading-relaxed whitespace-pre-line">{full.content}</div>
                            {!done && (
                              <button onClick={() => completeLesson(l.id)} className="btn btn-primary btn-sm mt-4">
                                <CheckCircle2 size={14} /> Mark as complete
                              </button>
                            )}
                          </>
                        ) : <div className="text-sm text-[var(--ink-soft)] py-2">Loading lesson…</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------- Exams tab ------------------------- */}
      {tab === 'exams' && (
        <div className="space-y-4 animate-fadeUp">
          {/* result review */}
          {result && (
            <div className="glass p-6 animate-pop">
              <div className="text-center mb-6">
                <Award size={36} className={`mx-auto mb-2 ${result.percent >= 50 ? 'text-[var(--gold)]' : 'text-[var(--ink-soft)]'}`} />
                <div className="text-3xl font-black">{result.score}/{result.total} <span className="grad-text">({result.percent}%)</span></div>
                <p className="text-sm text-[var(--ink-soft)] mt-1">
                  {result.percent >= 75 ? 'Outstanding! You are ready for the next chapter. 🏆' :
                   result.percent >= 50 ? 'Good work — review the misses and try again.' :
                   'Revisit the lessons and retake the exam. You will crack it!'}
                </p>
              </div>
              <div className="space-y-3">
                {result.review.map((r, i) => (
                  <div key={r.question_id} className="p-4 rounded-xl border" style={{ borderColor: r.correct ? 'rgba(52,211,153,0.35)' : 'rgba(251,113,133,0.35)' }}>
                    <div className="flex items-start gap-2.5">
                      {r.correct ? <CheckCircle2 size={17} className="text-[var(--green)] mt-0.5 shrink-0" /> : <XCircle size={17} className="text-[var(--red)] mt-0.5 shrink-0" />}
                      <div className="text-sm">
                        <div className="font-bold">{i + 1}. {r.question}</div>
                        <div className="text-[var(--ink-soft)] mt-1">
                          Your answer: <b className={r.correct ? 'text-[var(--green)]' : 'text-[var(--red)]'}>{r.your_answer !== null ? r.options[r.your_answer] : '—'}</b>
                          {!r.correct && <> · Correct: <b className="text-[var(--green)]">{r.options[r.correct_index]}</b></>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setResult(null)} className="btn btn-ghost btn-sm mt-4">Close review</button>
            </div>
          )}

          {/* exam in progress */}
          {exam && !result && (
            <div className="glass p-6 animate-pop">
              <div className="flex items-center gap-3 mb-5">
                <ClipboardCheck className="text-[var(--violet)]" />
                <div>
                  <div className="font-extrabold">{exam.exam.title}</div>
                  <div className="text-xs text-[var(--ink-soft)]">{exam.questions.length} questions · {exam.exam.duration_minutes} min suggested</div>
                </div>
              </div>
              <div className="space-y-6">
                {exam.questions.map((q, qi) => (
                  <div key={q.id}>
                    <div className="font-bold text-sm mb-2.5">{qi + 1}. {q.question} <span className="text-[var(--ink-soft)] font-semibold">({q.marks} mark{q.marks > 1 ? 's' : ''})</span></div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {[q.option_a, q.option_b, q.option_c, q.option_d].map((opt, oi) => (
                        <button key={oi} onClick={() => setAnswers(a => ({ ...a, [q.id]: oi }))}
                          className={`text-left text-sm px-4 py-2.5 rounded-xl border transition-all ${answers[q.id] === oi
                            ? 'border-[var(--violet)] bg-[rgba(124,92,255,0.16)] font-bold'
                            : 'border-[var(--line)] hover:border-[var(--line-strong)]'}`}>
                          <span className="font-black mr-2 text-[var(--ink-soft)]">{String.fromCharCode(65 + oi)}.</span>{opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-6">
                <button onClick={submitExam} disabled={busy || Object.keys(answers).length < exam.questions.length} className="btn btn-primary">
                  {busy ? 'Submitting…' : 'Submit exam'}
                </button>
                <span className="text-xs text-[var(--ink-soft)]">{Object.keys(answers).length}/{exam.questions.length} answered</span>
                <button onClick={() => setExam(null)} className="btn btn-ghost btn-sm ml-auto">Cancel</button>
              </div>
            </div>
          )}

          {/* exam list */}
          {!exam && exams.map(e => {
            const attemptsForExam = progress.attempts.filter(a => a.exam_id === e.id);
            const best = attemptsForExam.length ? Math.max(...attemptsForExam.map(a => a.total ? Math.round((a.score / a.total) * 100) : 0)) : null;
            return (
              <div key={e.id} className="glass glass-hover p-5 flex flex-wrap items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-[rgba(124,92,255,0.15)] flex items-center justify-center shrink-0">
                  <ClipboardCheck className="text-[var(--violet)]" size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold">{e.title}</div>
                  <div className="text-xs text-[var(--ink-soft)] mt-0.5">
                    {e.question_count} questions · {e.total_marks} marks · {e.duration_minutes} min
                    {best !== null && <> · <span className="text-[var(--gold)] font-bold">best {best}%</span> · {attemptsForExam.length} attempt{attemptsForExam.length > 1 ? 's' : ''}</>}
                  </div>
                </div>
                {locked
                  ? <Link href="/premium" className="btn btn-gold btn-sm"><Lock size={13} /> Unlock</Link>
                  : <button onClick={() => startExam(e)} className="btn btn-primary btn-sm"><PlayCircle size={14} /> {best !== null ? 'Retake exam' : 'Start exam'}</button>}
              </div>
            );
          })}
          {!exams.length && <div className="glass p-8 text-center text-[var(--ink-soft)]">No exams in this course yet.</div>}
        </div>
      )}

      {/* ------------------------ Progress tab ------------------------ */}
      {tab === 'progress' && (
        <div className="space-y-6 animate-fadeUp">
          <div className="glass p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="font-extrabold">Lesson completion</div>
              <div className="text-sm font-black" style={{ color }}>{progress.lessons_done}/{progress.lessons_total} · {progress.percent}%</div>
            </div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${progress.percent}%` }} /></div>
            <div className="mt-5 space-y-2.5">
              {lessons.map((l, i) => (
                <div key={l.id} className="flex items-center gap-3 text-sm">
                  {doneSet.has(l.id)
                    ? <CheckCircle2 size={17} className="text-[var(--green)] shrink-0" />
                    : <Circle size={17} className="text-[var(--ink-soft)] shrink-0" />}
                  <span className={doneSet.has(l.id) ? '' : 'text-[var(--ink-soft)]'}>{i + 1}. {l.title}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass p-6">
            <div className="font-extrabold mb-4">Exam history</div>
            {progress.attempts.length ? (
              <table className="table-base">
                <thead><tr><th>Date</th><th>Score</th><th>Percent</th></tr></thead>
                <tbody>
                  {progress.attempts.map(a => {
                    const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
                    return (
                      <tr key={a.id}>
                        <td>{new Date(a.created_at).toLocaleString()}</td>
                        <td className="font-bold">{a.score}/{a.total}</td>
                        <td><span className={`badge ${pct >= 75 ? 'badge-green' : pct >= 50 ? 'badge-gold' : 'badge-red'}`}>{pct}%</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : <p className="text-sm text-[var(--ink-soft)]">No exam attempts yet{locked ? ' — unlock Premium to take exams.' : '.'}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
