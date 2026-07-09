'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, CLASSES } from '@/context/AuthContext';
import SubjectIcon from '@/components/SubjectIcon';
import {
  Plus, Trash2, BookOpen, ClipboardCheck, Users, ChevronRight,
  GraduationCap, Save, X, CheckCircle2,
} from 'lucide-react';

export default function TeacherPage() {
  const { api, user, loading, isTeacher } = useAuth();
  const router = useRouter();
  const [overview, setOverview] = useState(null);
  const [selected, setSelected] = useState(null);     // course id
  const [content, setContent] = useState(null);       // {course, lessons, exams, questions}
  const [students, setStudents] = useState(null);
  const [tab, setTab] = useState('lessons');
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [error, setError] = useState('');

  // forms
  const [courseForm, setCourseForm] = useState({ subject_id: '', class_level: 1, title: '', description: '' });
  const [lessonForm, setLessonForm] = useState({ title: '', content: '', video_url: '', duration_minutes: 30 });
  const [examForm, setExamForm] = useState({ title: '', duration_minutes: 20 });
  const [qForm, setQForm] = useState({ exam_id: '', question: '', options: ['', '', '', ''], correct_index: 0, marks: 1 });

  useEffect(() => {
    if (!loading && (!user || !isTeacher)) router.push(user ? '/dashboard' : '/login');
  }, [loading, user, isTeacher, router]);

  const loadOverview = useCallback(() => api('GET', '/teacher/overview').then(setOverview).catch(() => {}), [api]);
  useEffect(() => { if (user && isTeacher) loadOverview(); }, [user, isTeacher, loadOverview]);

  const openCourse = useCallback(async (id) => {
    setSelected(id); setTab('lessons'); setStudents(null); setError('');
    setContent(await api('GET', `/teacher/courses/${id}/content`));
  }, [api]);

  const reloadContent = async () => setContent(await api('GET', `/teacher/courses/${selected}/content`));

  const loadStudents = async () => {
    setTab('students');
    setStudents(await api('GET', `/teacher/courses/${selected}/students`));
  };

  const guard = (fn) => async (...a) => {
    setError('');
    try { await fn(...a); } catch (e) { setError(e.message); }
  };

  const createCourse = guard(async (e) => {
    e.preventDefault();
    const c = await api('POST', '/teacher/courses', courseForm);
    setShowNewCourse(false);
    setCourseForm({ subject_id: '', class_level: 1, title: '', description: '' });
    await loadOverview();
    openCourse(c.id);
  });

  const deleteCourse = guard(async (id) => {
    if (!confirm('Delete this course with all its lessons, exams and student progress?')) return;
    await api('DELETE', `/teacher/courses/${id}`);
    setSelected(null); setContent(null);
    loadOverview();
  });

  const addLesson = guard(async (e) => {
    e.preventDefault();
    await api('POST', `/teacher/courses/${selected}/lessons`, lessonForm);
    setLessonForm({ title: '', content: '', video_url: '', duration_minutes: 30 });
    reloadContent(); loadOverview();
  });

  const deleteLesson = guard(async (id) => { await api('DELETE', `/teacher/lessons/${id}`); reloadContent(); });

  const addExam = guard(async (e) => {
    e.preventDefault();
    await api('POST', `/teacher/courses/${selected}/exams`, examForm);
    setExamForm({ title: '', duration_minutes: 20 });
    reloadContent(); loadOverview();
  });

  const deleteExam = guard(async (id) => { await api('DELETE', `/teacher/exams/${id}`); reloadContent(); });

  const addQuestion = guard(async (e) => {
    e.preventDefault();
    await api('POST', `/teacher/exams/${qForm.exam_id}/questions`, qForm);
    setQForm(f => ({ ...f, question: '', options: ['', '', '', ''], correct_index: 0 }));
    reloadContent();
  });

  const deleteQuestion = guard(async (id) => { await api('DELETE', `/teacher/questions/${id}`); reloadContent(); });

  if (loading || !user || !overview) return <div className="max-w-6xl mx-auto px-4 py-20 text-[var(--ink-soft)]">Loading studio…</div>;

  const myCourse = content?.course;

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-center gap-4 mb-8 animate-fadeUp">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <GraduationCap className="text-[var(--violet)]" /> Teacher <span className="grad-text">Studio</span>
          </h1>
          <p className="text-[var(--ink-soft)] mt-1">Welcome {user.name} — build courses, curriculum and exams; follow your students.</p>
        </div>
        <button onClick={() => setShowNewCourse(v => !v)} className="btn btn-primary ml-auto">
          {showNewCourse ? <><X size={16} /> Close</> : <><Plus size={16} /> New course</>}
        </button>
      </div>

      {error && <div className="glass p-3.5 mb-5 text-sm font-bold text-[var(--red)] border-[rgba(251,113,133,0.4)]">{error}</div>}

      {/* New course form */}
      {showNewCourse && (
        <form onSubmit={createCourse} className="glass p-6 mb-8 animate-pop">
          <div className="font-extrabold mb-4">Create a new course</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Subject</label>
              <select className="input" value={courseForm.subject_id} onChange={e => setCourseForm(f => ({ ...f, subject_id: e.target.value }))} required>
                <option value="">Choose subject…</option>
                {overview.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Class</label>
              <select className="input" value={courseForm.class_level} onChange={e => setCourseForm(f => ({ ...f, class_level: e.target.value }))}>
                {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Course title</label>
              <input className="input" value={courseForm.title} onChange={e => setCourseForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Class 6 Mathematics — Term 2" required />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea className="input" rows={2} value={courseForm.description} onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))} placeholder="What will students learn?" />
            </div>
          </div>
          <button className="btn btn-primary mt-5"><Save size={15} /> Create course</button>
        </form>
      )}

      <div className="grid lg:grid-cols-[340px_1fr] gap-6">
        {/* Course list */}
        <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
          {overview.courses.map(c => (
            <button key={c.id} onClick={() => openCourse(c.id)}
              className={`w-full text-left glass p-4 flex items-center gap-3 transition-all ${selected === c.id ? 'border-[var(--violet)] bg-[rgba(124,92,255,0.1)]' : 'glass-hover'}`}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${c.subject_color}22` }}>
                <SubjectIcon icon={c.subject_icon} color={c.subject_color} size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm truncate">{c.title}</div>
                <div className="text-[11px] text-[var(--ink-soft)]">{c.lesson_count} lessons · {c.exam_count} exams · {c.active_students} students</div>
              </div>
              <ChevronRight size={16} className="text-[var(--ink-soft)] shrink-0" />
            </button>
          ))}
        </div>

        {/* Editor */}
        <div>
          {!content ? (
            <div className="glass p-14 text-center text-[var(--ink-soft)]">
              <BookOpen className="mx-auto mb-3 opacity-60" size={30} />
              Select a course on the left, or create a new one.
            </div>
          ) : (
            <div className="glass p-6 animate-fadeUp">
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <div>
                  <div className="font-extrabold text-lg">{myCourse.title}</div>
                  <div className="text-xs text-[var(--ink-soft)]">Class {myCourse.class_level}</div>
                </div>
                <button onClick={() => deleteCourse(myCourse.id)} className="btn btn-danger btn-sm ml-auto"><Trash2 size={13} /> Delete course</button>
              </div>

              <div className="flex gap-2 mb-6 overflow-x-auto">
                <button onClick={() => setTab('lessons')} className={`tab flex items-center gap-2 ${tab === 'lessons' ? 'tab-active' : 'border border-[var(--line)]'}`}><BookOpen size={14} /> Curriculum ({content.lessons.length})</button>
                <button onClick={() => setTab('exams')} className={`tab flex items-center gap-2 ${tab === 'exams' ? 'tab-active' : 'border border-[var(--line)]'}`}><ClipboardCheck size={14} /> Exams ({content.exams.length})</button>
                <button onClick={loadStudents} className={`tab flex items-center gap-2 ${tab === 'students' ? 'tab-active' : 'border border-[var(--line)]'}`}><Users size={14} /> Students</button>
              </div>

              {/* Lessons */}
              {tab === 'lessons' && (
                <div className="space-y-3">
                  {content.lessons.map((l, i) => (
                    <div key={l.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-[var(--line)]">
                      <span className="w-8 h-8 rounded-lg bg-[rgba(124,92,255,0.14)] text-[var(--violet)] flex items-center justify-center font-black text-sm shrink-0">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm truncate">{l.title}</div>
                        <div className="text-[11px] text-[var(--ink-soft)]">{l.duration_minutes} min{l.video_url ? ' · has video' : ''}</div>
                      </div>
                      <button onClick={() => deleteLesson(l.id)} className="btn btn-danger btn-sm shrink-0"><Trash2 size={12} /></button>
                    </div>
                  ))}
                  <form onSubmit={addLesson} className="p-4 rounded-xl border border-dashed border-[var(--line-strong)] space-y-3">
                    <div className="font-bold text-sm flex items-center gap-2"><Plus size={15} className="text-[var(--cyan)]" /> Add lesson</div>
                    <input className="input" placeholder="Lesson title" value={lessonForm.title} onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))} required />
                    <textarea className="input" rows={3} placeholder="Lesson content / study notes" value={lessonForm.content} onChange={e => setLessonForm(f => ({ ...f, content: e.target.value }))} />
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input className="input" placeholder="Video URL (optional)" value={lessonForm.video_url} onChange={e => setLessonForm(f => ({ ...f, video_url: e.target.value }))} />
                      <input className="input" type="number" min={5} placeholder="Duration (min)" value={lessonForm.duration_minutes} onChange={e => setLessonForm(f => ({ ...f, duration_minutes: e.target.value }))} />
                    </div>
                    <button className="btn btn-primary btn-sm"><Save size={13} /> Add lesson</button>
                  </form>
                </div>
              )}

              {/* Exams */}
              {tab === 'exams' && (
                <div className="space-y-5">
                  {content.exams.map(ex => (
                    <div key={ex.id} className="p-4 rounded-xl border border-[var(--line)]">
                      <div className="flex items-center gap-3 mb-3">
                        <ClipboardCheck size={18} className="text-[var(--violet)] shrink-0" />
                        <div className="font-bold text-sm flex-1">{ex.title} <span className="text-[var(--ink-soft)] font-semibold">· {ex.duration_minutes} min</span></div>
                        <button onClick={() => deleteExam(ex.id)} className="btn btn-danger btn-sm"><Trash2 size={12} /></button>
                      </div>
                      <div className="space-y-2">
                        {(content.questions[ex.id] || []).map((q, qi) => (
                          <div key={q.id} className="flex items-start gap-2.5 text-sm p-3 rounded-lg bg-[rgba(255,255,255,0.03)]">
                            <span className="font-black text-[var(--ink-soft)] shrink-0">{qi + 1}.</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold">{q.question}</div>
                              <div className="text-[11px] text-[var(--ink-soft)] mt-1 flex items-center gap-1.5">
                                <CheckCircle2 size={12} className="text-[var(--green)]" />
                                Answer: {[q.option_a, q.option_b, q.option_c, q.option_d][q.correct_index]} · {q.marks} mark{q.marks > 1 ? 's' : ''}
                              </div>
                            </div>
                            <button onClick={() => deleteQuestion(q.id)} className="btn btn-danger btn-sm shrink-0"><Trash2 size={11} /></button>
                          </div>
                        ))}
                        {!(content.questions[ex.id] || []).length && <div className="text-xs text-[var(--ink-soft)]">No questions yet — add some below.</div>}
                      </div>
                    </div>
                  ))}

                  <form onSubmit={addExam} className="p-4 rounded-xl border border-dashed border-[var(--line-strong)] space-y-3">
                    <div className="font-bold text-sm flex items-center gap-2"><Plus size={15} className="text-[var(--cyan)]" /> Add exam</div>
                    <div className="grid sm:grid-cols-[1fr_140px] gap-3">
                      <input className="input" placeholder="Exam title" value={examForm.title} onChange={e => setExamForm(f => ({ ...f, title: e.target.value }))} required />
                      <input className="input" type="number" min={5} placeholder="Minutes" value={examForm.duration_minutes} onChange={e => setExamForm(f => ({ ...f, duration_minutes: e.target.value }))} />
                    </div>
                    <button className="btn btn-primary btn-sm"><Save size={13} /> Add exam</button>
                  </form>

                  {content.exams.length > 0 && (
                    <form onSubmit={addQuestion} className="p-4 rounded-xl border border-dashed border-[var(--line-strong)] space-y-3">
                      <div className="font-bold text-sm flex items-center gap-2"><Plus size={15} className="text-[var(--pink)]" /> Add question</div>
                      <select className="input" value={qForm.exam_id} onChange={e => setQForm(f => ({ ...f, exam_id: e.target.value }))} required>
                        <option value="">Choose exam…</option>
                        {content.exams.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
                      </select>
                      <input className="input" placeholder="Question" value={qForm.question} onChange={e => setQForm(f => ({ ...f, question: e.target.value }))} required />
                      <div className="grid sm:grid-cols-2 gap-3">
                        {qForm.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <button type="button" onClick={() => setQForm(f => ({ ...f, correct_index: oi }))}
                              title="Mark as correct answer"
                              className={`w-8 h-8 rounded-lg shrink-0 font-black text-xs border transition-all ${qForm.correct_index === oi ? 'bg-[var(--green)] text-black border-transparent' : 'border-[var(--line)] text-[var(--ink-soft)]'}`}>
                              {String.fromCharCode(65 + oi)}
                            </button>
                            <input className="input" placeholder={`Option ${String.fromCharCode(65 + oi)}`} value={opt} required
                              onChange={e => setQForm(f => ({ ...f, options: f.options.map((o, j) => j === oi ? e.target.value : o) }))} />
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-3">
                        <button className="btn btn-primary btn-sm"><Save size={13} /> Add question</button>
                        <span className="text-[11px] text-[var(--ink-soft)]">Tip: click A/B/C/D to set the correct answer (green).</span>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Students */}
              {tab === 'students' && (
                <div>
                  {!students ? <div className="text-sm text-[var(--ink-soft)]">Loading students…</div> :
                    students.students.length ? (
                      <table className="table-base">
                        <thead><tr><th>Student</th><th>Class</th><th>Progress</th><th>Best exam</th><th>Last active</th></tr></thead>
                        <tbody>
                          {students.students.map(s => (
                            <tr key={s.id}>
                              <td>
                                <div className="font-bold">{s.name}</div>
                                <div className="text-[11px] text-[var(--ink-soft)]">{s.email}</div>
                              </td>
                              <td>{s.class_level ? `Class ${s.class_level}` : '—'}</td>
                              <td>
                                <div className="flex items-center gap-2 min-w-32">
                                  <div className="progress-track flex-1"><div className="progress-fill" style={{ width: `${s.progress_percent}%` }} /></div>
                                  <span className="text-xs font-black">{s.progress_percent}%</span>
                                </div>
                                <div className="text-[11px] text-[var(--ink-soft)] mt-0.5">{s.lessons_done}/{s.lessons_total} lessons</div>
                              </td>
                              <td>{s.best_exam_percent !== null ? <span className={`badge ${s.best_exam_percent >= 75 ? 'badge-green' : s.best_exam_percent >= 50 ? 'badge-gold' : 'badge-red'}`}>{s.best_exam_percent}%</span> : <span className="text-[var(--ink-soft)] text-xs">—</span>}</td>
                              <td className="text-xs text-[var(--ink-soft)]">{s.last_active ? new Date(s.last_active).toLocaleDateString() : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <div className="text-sm text-[var(--ink-soft)] py-6 text-center">No students have started this course yet.</div>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
