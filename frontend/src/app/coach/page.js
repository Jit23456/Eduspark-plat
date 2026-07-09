'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, DAYS } from '@/context/AuthContext';
import { ClipboardCheck, CalendarClock, GraduationCap, Plane } from 'lucide-react';

const TABS = ['Sessions', 'Students', 'Trials', 'Availability'];
const ATT_STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'MAKEUP'];

export default function CoachDashboard() {
  const { api, user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('Sessions');
  const [dash, setDash] = useState(null);
  const [openSession, setOpenSession] = useState(null); // { session, attendance, notes }
  const [note, setNote] = useState({ topics_covered: '', homework_assigned: '', member_id: '' });
  const [assess, setAssess] = useState({ trialId: null, feedback: '', recommended_batch_id: '' });
  const [avail, setAvail] = useState({ day_of_week: 1, start_time: '15:30', end_time: '20:00' });
  const [leave, setLeave] = useState({ from_date: '', to_date: '', note: '' });
  const [msg, setMsg] = useState(null);

  const load = useCallback(() => api('GET', '/coach/dashboard').then(setDash).catch(e => setMsg({ ok: false, text: e.message })), [api]);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'COACH') { router.push('/'); return; }
    load();
  }, [user, loading, router, load]);

  if (!dash) return <div className="max-w-6xl mx-auto px-4 py-16 text-[var(--ink-soft)]">Loading coach dashboard…</div>;

  const openAttendance = async (sessionId) => {
    const r = await api('GET', `/coach/sessions/${sessionId}/attendance`);
    setOpenSession(r);
  };

  const mark = async (attendanceId, status) => {
    await api('PUT', `/coach/attendance/${attendanceId}`, { status });
    openAttendance(openSession.session.id);
  };

  const saveNote = async () => {
    await api('POST', `/coach/sessions/${openSession.session.id}/notes`, {
      ...note, member_id: note.member_id || null,
    });
    setNote({ topics_covered: '', homework_assigned: '', member_id: '' });
    setMsg({ ok: true, text: 'Session note saved — parents can see it on their dashboard.' });
    openAttendance(openSession.session.id);
  };

  const submitAssessment = async () => {
    try {
      await api('POST', `/coach/trials/${assess.trialId}/assessment`, {
        feedback: assess.feedback, recommended_batch_id: assess.recommended_batch_id || null,
      });
      setAssess({ trialId: null, feedback: '', recommended_batch_id: '' });
      setMsg({ ok: true, text: 'Trial assessment submitted — visible to admins and the parent.' });
      load();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Coach dashboard</h1>
      <p className="text-[var(--ink-soft)]">Welcome, {user.name}</p>

      {msg && <div className={`mt-4 text-sm rounded-lg p-3 ${msg.ok ? 'text-[var(--green)] bg-[#e2f3ec]' : 'text-[var(--red)] bg-[#fbe9e5]'}`}>{msg.text}</div>}

      <div className="flex gap-2 mt-6 overflow-x-auto">
        {TABS.map(t => <button key={t} className={`tab ${tab === t ? 'tab-active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {/* Sessions + attendance marking */}
      {tab === 'Sessions' && (
        <div className="grid lg:grid-cols-2 gap-4 mt-6">
          <div className="card p-5">
            <div className="font-bold mb-3 flex items-center gap-2"><CalendarClock size={16} /> My sessions (this week & next)</div>
            <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
              {dash.sessions.map(s => (
                <button key={s.id} onClick={() => openAttendance(s.id)}
                  className={`w-full text-left rounded-xl border p-3 text-sm transition ${openSession?.session?.id === s.id ? 'border-[var(--gold)] bg-[var(--gold-soft)]' : 'border-[var(--line)] hover:border-[var(--gold)]'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{s.planet_name} · {s.level_name}</span>
                    {s.session_date === today && <span className="badge badge-gold">today</span>}
                  </div>
                  <div className="text-xs text-[var(--ink-soft)] mt-1">
                    {s.session_date} · {s.start_time}–{s.end_time} · {s.location_name} · {s.present_count}/{s.expected_count} present
                  </div>
                </button>
              ))}
              {dash.sessions.length === 0 && <div className="text-sm text-[var(--ink-soft)]">No sessions assigned — ask your admin to generate the roster.</div>}
            </div>
          </div>

          <div className="card p-5">
            <div className="font-bold mb-3 flex items-center gap-2"><ClipboardCheck size={16} /> Attendance & notes</div>
            {!openSession ? (
              <div className="text-sm text-[var(--ink-soft)]">Select a session to mark attendance (sheet is pre-filled with expected members).</div>
            ) : (
              <>
                <div className="text-sm font-semibold mb-2">{openSession.session.session_date} · {openSession.session.start_time}</div>
                <div className="space-y-2">
                  {openSession.attendance.map(a => (
                    <div key={a.id} className="flex items-center gap-2 flex-wrap rounded-lg bg-[#f5f3ee] p-2">
                      <span className="font-semibold text-sm flex-1">{a.member_name}</span>
                      <span className={`badge ${a.status === 'PRESENT' ? 'badge-green' : a.status === 'ABSENT' ? 'badge-red' : ''}`}>{a.status}</span>
                      {ATT_STATUSES.map(st => (
                        <button key={st} className="btn btn-ghost btn-sm" onClick={() => mark(a.id, st)}>{st[0] + st.slice(1).toLowerCase()}</button>
                      ))}
                    </div>
                  ))}
                  {openSession.attendance.length === 0 && <div className="text-sm text-[var(--ink-soft)]">No expected members yet (attendance sheets are generated daily by the system).</div>}
                </div>

                <div className="border-t border-[var(--line)] mt-4 pt-4">
                  <div className="label">Add class note</div>
                  <select className="input mb-2" value={note.member_id} onChange={e => setNote(n => ({ ...n, member_id: e.target.value }))}>
                    <option value="">Whole class</option>
                    {openSession.attendance.map(a => <option key={a.member_id} value={a.member_id}>{a.member_name}</option>)}
                  </select>
                  <input className="input mb-2" placeholder="Topics covered (e.g. Forks & pins)" value={note.topics_covered} onChange={e => setNote(n => ({ ...n, topics_covered: e.target.value }))} />
                  <input className="input mb-2" placeholder="Homework assigned" value={note.homework_assigned} onChange={e => setNote(n => ({ ...n, homework_assigned: e.target.value }))} />
                  <button className="btn btn-primary btn-sm" onClick={saveNote} disabled={!note.topics_covered && !note.homework_assigned}>Save note</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Students */}
      {tab === 'Students' && (
        <div className="card p-5 mt-6">
          <div className="font-bold mb-3 flex items-center gap-2"><GraduationCap size={16} /> My students</div>
          <table className="table-base">
            <thead><tr><th>Student</th><th>Course</th><th>Last topic covered</th><th>Homework</th></tr></thead>
            <tbody>
              {dash.students.map(s => (
                <tr key={s.id + s.level_name}>
                  <td className="font-semibold">{s.name}</td>
                  <td>{s.planet_name} · {s.level_name}</td>
                  <td>{s.last_topic || '—'}</td>
                  <td>{s.last_homework_done == null ? '—' : s.last_homework_done ? '✅ done' : '⏳ pending'}</td>
                </tr>
              ))}
              {dash.students.length === 0 && <tr><td colSpan={4} className="text-[var(--ink-soft)]">No students assigned yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Trials */}
      {tab === 'Trials' && (
        <div className="card p-5 mt-6">
          <div className="font-bold mb-3">Trials awaiting assessment</div>
          <div className="space-y-3">
            {dash.pending_trials.map(t => (
              <div key={t.id} className="rounded-xl border border-[var(--line)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm">{t.member_name || t.guest_name}</span>
                  <span className="badge">{t.planet_name} · {t.level_name}</span>
                  <span className="text-xs text-[var(--ink-soft)]">{t.trial_date} · {DAYS[t.day_of_week]} {t.start_time}</span>
                  {assess.trialId !== t.id && <button className="btn btn-ghost btn-sm ml-auto" onClick={() => setAssess({ trialId: t.id, feedback: '', recommended_batch_id: t.batch_id })}>Write assessment</button>}
                </div>
                {assess.trialId === t.id && (
                  <div className="mt-3 space-y-2 animate-slideUp">
                    <textarea className="input" rows={3} placeholder="Assessment feedback (strengths, recommended level, next steps)…"
                      value={assess.feedback} onChange={e => setAssess(a => ({ ...a, feedback: e.target.value }))} />
                    <div className="text-xs text-[var(--ink-soft)]">Recommended batch defaults to the trial batch; the parent sees a one-click signup.</div>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-sm" onClick={() => setAssess({ trialId: null, feedback: '', recommended_batch_id: '' })}>Cancel</button>
                      <button className="btn btn-primary btn-sm" disabled={!assess.feedback} onClick={submitAssessment}>Submit assessment</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {dash.pending_trials.length === 0 && <div className="text-sm text-[var(--ink-soft)]">No pending trials.</div>}
          </div>
        </div>
      )}

      {/* Availability & leaves */}
      {tab === 'Availability' && (
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <div className="card p-5">
            <div className="font-bold mb-3">Weekly availability (next 6 months, carries over)</div>
            <div className="space-y-2">
              {dash.availability.map(a => (
                <div key={a.id} className="flex items-center gap-2 text-sm rounded-lg bg-[#f5f3ee] p-2">
                  <span className="font-semibold w-24">{DAYS[a.day_of_week]}</span>
                  <span>{a.start_time} – {a.end_time}</span>
                  <button className="btn btn-danger btn-sm ml-auto" onClick={() => api('DELETE', `/coach/availability/${a.id}`).then(load)}>Remove</button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-4 items-end">
              <div><label className="label">Day</label>
                <select className="input" value={avail.day_of_week} onChange={e => setAvail(a => ({ ...a, day_of_week: +e.target.value }))}>
                  {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select></div>
              <div><label className="label">From</label><input className="input" type="time" value={avail.start_time} onChange={e => setAvail(a => ({ ...a, start_time: e.target.value }))} /></div>
              <div><label className="label">To</label><input className="input" type="time" value={avail.end_time} onChange={e => setAvail(a => ({ ...a, end_time: e.target.value }))} /></div>
              <button className="btn btn-primary" onClick={() => api('POST', '/coach/availability', avail).then(load)}>Add</button>
            </div>
          </div>

          <div className="card p-5">
            <div className="font-bold mb-3 flex items-center gap-2"><Plane size={16} /> Leaves & absences</div>
            <div className="space-y-2">
              {dash.leaves.map(l => (
                <div key={l.id} className="flex items-center gap-2 text-sm rounded-lg bg-[#f5f3ee] p-2">
                  <span>{l.from_date} → {l.to_date}</span>
                  <span className="text-xs text-[var(--ink-soft)]">{l.note}</span>
                  <button className="btn btn-danger btn-sm ml-auto" onClick={() => api('DELETE', `/coach/leaves/${l.id}`).then(load)}>Remove</button>
                </div>
              ))}
              {dash.leaves.length === 0 && <div className="text-sm text-[var(--ink-soft)]">No leaves planned. Availability carries over automatically unless a leave is applied.</div>}
            </div>
            <div className="flex flex-wrap gap-2 mt-4 items-end">
              <div><label className="label">From</label><input className="input" type="date" value={leave.from_date} onChange={e => setLeave(l => ({ ...l, from_date: e.target.value }))} /></div>
              <div><label className="label">To</label><input className="input" type="date" value={leave.to_date} onChange={e => setLeave(l => ({ ...l, to_date: e.target.value }))} /></div>
              <div className="flex-1"><label className="label">Note</label><input className="input" value={leave.note} onChange={e => setLeave(l => ({ ...l, note: e.target.value }))} /></div>
              <button className="btn btn-primary" disabled={!leave.from_date || !leave.to_date}
                onClick={() => api('POST', '/coach/leaves', leave).then(() => { setLeave({ from_date: '', to_date: '', note: '' }); load(); })}>Add leave</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
