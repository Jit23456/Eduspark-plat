'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, money, DAYS } from '@/context/AuthContext';
import { Bell, Star, Wallet, ShieldCheck, Lock, Unlock } from 'lucide-react';

const TABS = ['Overview', 'Members', 'Enrollments', 'Billing', 'Progress'];

export default function CustomerDashboard() {
  const { api, user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('Overview');
  const [dash, setDash] = useState(null);
  const [profile, setProfile] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [cards, setCards] = useState([]);
  const [msg, setMsg] = useState(null);
  const [twoFa, setTwoFa] = useState({ stage: 'idle', code: '', devCode: '' });
  const [newCard, setNewCard] = useState({ number: '', exp: '' });

  const load = useCallback(() => {
    api('GET', '/customer/dashboard').then(setDash).catch(() => {});
    api('GET', '/customer/profile').then(setProfile).catch(() => {});
    api('GET', '/customer/invoices').then(setInvoices).catch(() => {});
    api('GET', '/customer/payment-methods').then(setCards).catch(() => {});
  }, [api]);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'CUSTOMER') { router.push(user.role === 'COACH' ? '/coach' : '/admin'); return; }
    load();
  }, [user, loading, router, load]);

  if (!dash || !profile) return <div className="max-w-6xl mx-auto px-4 py-16 text-[var(--ink-soft)]">Loading your dashboard…</div>;

  const request2fa = async () => {
    try {
      const r = await api('POST', '/auth/2fa/request');
      setTwoFa({ stage: 'code', code: '', devCode: r.dev_code || '' });
      setMsg({ ok: true, text: `Verification code sent by SMS to ${r.sent_to}${r.dev_code ? ` (dev code: ${r.dev_code})` : ''}` });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const verify2fa = async () => {
    try {
      await api('POST', '/auth/2fa/verify', { code: twoFa.code });
      setTwoFa({ stage: 'idle', code: '', devCode: '' });
      setMsg({ ok: true, text: 'Identity verified — personal information unlocked for 10 minutes.' });
      load();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  };

  const cancelEnrollment = async (id) => {
    try {
      const r = await api('POST', `/customer/enrollments/${id}/cancel`, {});
      setMsg({ ok: true, text: r.message });
      load();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  };

  const redeem = async () => {
    try {
      const r = await api('POST', '/customer/loyalty/redeem', { points: dash.loyalty_points });
      setMsg({ ok: true, text: `Redeemed into ${money(r.credited_cents)} store credit!` });
      load();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  };

  const addCard = async () => {
    try {
      const last4 = newCard.number.replace(/\D/g, '').slice(-4);
      const [m, y] = newCard.exp.split('/').map(s => parseInt(s, 10));
      await api('POST', '/customer/payment-methods', {
        token: 'tok_' + Math.random().toString(36).slice(2), brand: 'Visa', last4,
        exp_month: m || null, exp_year: y ? 2000 + y : null, make_default: true, save_for_recurring: true,
      });
      setNewCard({ number: '', exp: '' });
      load();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Hi, {user.name.split(' ')[0]} 👋</h1>
          <p className="text-[var(--ink-soft)]">Your family dashboard</p>
        </div>
        <div className="flex gap-3">
          <div className="card px-4 py-2 flex items-center gap-2"><Star size={16} className="text-[var(--gold)]" /><div><div className="text-xs text-[var(--ink-soft)]">Loyalty</div><div className="font-extrabold">{dash.loyalty_points.toLocaleString()} pts</div></div></div>
          <div className="card px-4 py-2 flex items-center gap-2"><Wallet size={16} className="text-[var(--green)]" /><div><div className="text-xs text-[var(--ink-soft)]">Store credit</div><div className="font-extrabold">{money(dash.store_credit_cents)}</div></div></div>
        </div>
      </div>

      {msg && <div className={`mt-4 text-sm rounded-lg p-3 ${msg.ok ? 'text-[var(--green)] bg-[#e2f3ec]' : 'text-[var(--red)] bg-[#fbe9e5]'}`}>{msg.text}</div>}

      <div className="flex gap-2 mt-6 overflow-x-auto">
        {TABS.map(t => <button key={t} className={`tab ${tab === t ? 'tab-active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {/* ------------------------------- Overview ------------------------------ */}
      {tab === 'Overview' && (
        <div className="grid lg:grid-cols-3 gap-4 mt-6">
          <div className="card p-5 lg:col-span-2">
            <div className="font-bold mb-3">Upcoming classes</div>
            <table className="table-base">
              <thead><tr><th>Date</th><th>Time</th><th>Class</th><th>Member</th><th>Location</th></tr></thead>
              <tbody>
                {dash.upcoming_sessions.map((s, i) => (
                  <tr key={i}><td>{s.session_date}</td><td>{s.start_time}–{s.end_time}</td>
                    <td>{s.planet_name} · {s.level_name}</td><td>{s.member_name}</td><td>{s.location_name}</td></tr>
                ))}
                {dash.upcoming_sessions.length === 0 && <tr><td colSpan={5} className="text-[var(--ink-soft)]">No sessions scheduled yet — the roster is generated up to 2 weeks ahead.</td></tr>}
              </tbody>
            </table>

            <div className="font-bold mt-6 mb-2">Upcoming events & camps</div>
            <div className="flex flex-wrap gap-2">
              {dash.upcoming_events.map(e => (
                <Link key={e.id} href={`/events/${e.id}`} className="badge badge-navy hover:opacity-80">{e.name} · {e.start_date}</Link>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <div className="font-bold mb-3 flex items-center gap-2"><Bell size={16} /> Notifications</div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {dash.notifications.map(n => (
                <div key={n.id} className={`text-sm rounded-lg p-2.5 ${n.read ? 'bg-[#f5f3ee]' : 'bg-[var(--gold-soft)]'}`}>
                  <span className={`badge mr-1 ${n.type === 'PAYMENT_FAILED' ? 'badge-red' : n.type === 'MISSED_CLASS' ? 'badge-red' : 'badge-navy'}`}>{n.type.replace('_', ' ')}</span>
                  {n.message}
                </div>
              ))}
              {dash.notifications.length === 0 && <div className="text-sm text-[var(--ink-soft)]">All caught up.</div>}
            </div>
            {dash.loyalty_points >= 10000 && (
              <button className="btn btn-gold btn-sm w-full mt-4" onClick={redeem}>Redeem {dash.loyalty_points.toLocaleString()} pts → store credit</button>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------- Members ------------------------------- */}
      {tab === 'Members' && (
        <div className="mt-6">
          <div className="card p-5 flex flex-wrap items-center gap-3">
            <ShieldCheck className="text-[var(--gold)]" />
            <div className="flex-1 text-sm">
              Personal information (DOB, gender, contacts) is <b>masked</b> for privacy.
              Verify with a code sent to your registered phone to view or edit it.
            </div>
            {profile.pii_unlocked ? (
              <span className="badge badge-green"><Unlock size={11} /> Unlocked (10 min)</span>
            ) : twoFa.stage === 'code' ? (
              <div className="flex gap-2">
                <input className="input max-w-32" placeholder="6-digit code" value={twoFa.code} onChange={e => setTwoFa(t => ({ ...t, code: e.target.value }))} />
                <button className="btn btn-primary btn-sm" onClick={verify2fa}>Verify</button>
              </div>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={request2fa}><Lock size={13} /> Unlock with 2FA</button>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div className="card p-5">
              <div className="font-bold">Account holder</div>
              <dl className="text-sm mt-3 space-y-1.5">
                <Row k="Full name" v={profile.customer.full_name} />
                <Row k="Date of birth" v={profile.customer.dob} />
                <Row k="Gender" v={profile.customer.gender || '—'} />
                <Row k="Phone" v={profile.customer.phone} />
                <Row k="Emergency contact" v={profile.customer.emergency_contact} />
                <Row k="CFC ID" v={profile.customer.cfc_id || '—'} />
                <Row k="Nearest location" v={profile.nearest_location?.name} />
              </dl>
            </div>
            {profile.members.map(m => (
              <div key={m.id} className="card p-5">
                <div className="font-bold flex items-center gap-2">{m.first_name} {m.last_name} {!!m.is_self && <span className="badge">self</span>}</div>
                <dl className="text-sm mt-3 space-y-1.5">
                  <Row k="Date of birth" v={m.dob || '—'} />
                  <Row k="Grade" v={m.grade || '—'} />
                  <Row k="CFC ID" v={m.cfc_id || '—'} />
                  <Row k="FIDE ID" v={m.fide_id || '—'} />
                  <Row k="T-shirt" v={m.tshirt_size || '—'} />
                  <Row k="Setup fee" v={m.setup_fee_paid_at ? 'Paid' : 'Due on first course'} />
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ----------------------------- Enrollments ----------------------------- */}
      {tab === 'Enrollments' && (
        <div className="card p-5 mt-6">
          <table className="table-base">
            <thead><tr><th>Member</th><th>Course</th><th>Setting</th><th>Status</th><th>Since</th><th></th></tr></thead>
            <tbody>
              {dash.enrollments.map(e => (
                <tr key={e.id}>
                  <td className="font-semibold">{e.member_name}</td>
                  <td>{e.planet_name} · {e.level_name}</td>
                  <td>{e.class_setting} · {e.sessions_per_week}x/wk · {e.location_name}</td>
                  <td>
                    <span className={`badge ${e.status === 'ACTIVE' ? 'badge-green' : e.status === 'NOTICE_GIVEN' ? 'badge-gold' : 'badge-red'}`}>{e.status.replace('_', ' ')}</span>
                    {e.end_date && e.status === 'NOTICE_GIVEN' && <div className="text-xs text-[var(--ink-soft)] mt-1">ends {e.end_date}</div>}
                  </td>
                  <td>{e.start_date}</td>
                  <td>{e.status === 'ACTIVE' && (
                    <button className="btn btn-danger btn-sm" onClick={() => cancelEnrollment(e.id)}>Cancel (15-day notice)</button>
                  )}</td>
                </tr>
              ))}
              {dash.enrollments.length === 0 && <tr><td colSpan={6} className="text-[var(--ink-soft)]">No enrollments yet — <Link href="/courses" className="text-[var(--gold)] font-semibold">browse courses</Link>.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ------------------------------- Billing -------------------------------- */}
      {tab === 'Billing' && (
        <div className="mt-6 space-y-4">
          <div className="card p-5">
            <div className="font-bold mb-3">Payment methods</div>
            <div className="flex flex-wrap gap-3">
              {cards.map(c => (
                <div key={c.id} className={`rounded-xl border p-4 min-w-48 ${c.is_default ? 'border-[var(--gold)]' : 'border-[var(--line)]'}`}>
                  <div className="font-bold">{c.brand} •••• {c.last4}</div>
                  <div className="text-xs text-[var(--ink-soft)]">exp {c.exp_month}/{c.exp_year} {c.saved_for_recurring ? '· saved for recurring' : ''}</div>
                  {c.is_default ? <span className="badge badge-gold mt-2">default</span>
                    : <button className="btn btn-ghost btn-sm mt-2" onClick={() => api('PUT', `/customer/payment-methods/${c.id}/default`).then(load)}>Make default</button>}
                </div>
              ))}
              <div className="rounded-xl border border-dashed border-[var(--line)] p-4 min-w-64">
                <div className="text-xs font-bold text-[var(--ink-soft)] mb-2">Add a card (tokenized — number never stored)</div>
                <input className="input mb-2" placeholder="Card number" value={newCard.number} onChange={e => setNewCard(c => ({ ...c, number: e.target.value }))} />
                <div className="flex gap-2">
                  <input className="input" placeholder="MM/YY" value={newCard.exp} onChange={e => setNewCard(c => ({ ...c, exp: e.target.value }))} />
                  <button className="btn btn-primary btn-sm" onClick={addCard} disabled={!newCard.number}>Save</button>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="font-bold mb-3">Invoices & receipts</div>
            <div className="space-y-3">
              {invoices.map(inv => (
                <details key={inv.id} className="rounded-xl border border-[var(--line)] p-4">
                  <summary className="flex flex-wrap items-center gap-3 cursor-pointer">
                    <span className={`badge ${inv.status === 'PAID' ? 'badge-green' : inv.status === 'OPEN' ? 'badge-navy' : 'badge-red'}`}>{inv.status}</span>
                    <span className="font-semibold text-sm">{new Date(inv.created_at).toLocaleDateString()}</span>
                    <span className="text-sm text-[var(--ink-soft)]">{inv.period_start ? `Period ${inv.period_start}` : 'One-off'}</span>
                    <span className="ml-auto font-extrabold">{money(inv.total_cents)}</span>
                  </summary>
                  <table className="table-base mt-3">
                    <tbody>
                      {inv.lines.map(l => (
                        <>
                          <tr key={l.id}><td>{l.description}</td><td className="text-right">{money(l.amount_cents)}</td></tr>
                          {l.discounts.map(d => (
                            <tr key={d.id} className="text-[var(--green)]"><td className="pl-6 text-xs">↳ {d.explanation}</td><td className="text-right text-xs">−{money(d.amount_cents)}</td></tr>
                          ))}
                        </>
                      ))}
                      {inv.store_credit_cents > 0 && <tr className="text-[var(--green)]"><td>Store credit applied</td><td className="text-right">−{money(inv.store_credit_cents)}</td></tr>}
                    </tbody>
                  </table>
                </details>
              ))}
              {invoices.length === 0 && <div className="text-sm text-[var(--ink-soft)]">No invoices yet.</div>}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------- Progress ------------------------------- */}
      {tab === 'Progress' && (
        <div className="mt-6 grid lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <div className="font-bold mb-3">Attendance</div>
            {profile.members.map(m => {
              const rows = dash.attendance.filter(a => a.member_id === m.id);
              const present = rows.find(r => r.status === 'PRESENT')?.count || 0;
              const total = rows.reduce((s, r) => s + r.count, 0);
              return (
                <div key={m.id} className="flex items-center gap-3 mb-3">
                  <div className="w-28 font-semibold text-sm">{m.first_name}</div>
                  <div className="flex-1 h-2.5 rounded-full bg-[#eee9df] overflow-hidden">
                    <div className="h-full bg-[var(--green)]" style={{ width: total ? `${(present / total) * 100}%` : '0%' }} />
                  </div>
                  <div className="text-xs text-[var(--ink-soft)] w-24">{present}/{total} attended</div>
                </div>
              );
            })}
          </div>
          <div className="card p-5">
            <div className="font-bold mb-3">Coach notes & homework</div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {dash.session_notes.map(n => (
                <div key={n.id} className="text-sm rounded-lg bg-[#f5f3ee] p-3">
                  <div className="text-xs text-[var(--ink-soft)]">{n.session_date} · {n.coach_name}{n.member_first_name ? ` · ${n.member_first_name}` : ''}</div>
                  {n.topics_covered && <div><b>Covered:</b> {n.topics_covered}</div>}
                  {n.homework_assigned && <div><b>Homework:</b> {n.homework_assigned} {n.homework_done != null && (n.homework_done ? '✅ done' : '⏳ pending')}</div>}
                </div>
              ))}
              {dash.session_notes.length === 0 && <div className="text-sm text-[var(--ink-soft)]">Notes appear after each class.</div>}
            </div>
          </div>
          {dash.trial_assessments.length > 0 && (
            <div className="card p-5 lg:col-span-2">
              <div className="font-bold mb-3">Trial assessments</div>
              {dash.trial_assessments.map(t => (
                <div key={t.id} className="text-sm rounded-lg bg-[var(--gold-soft)] p-3 mb-2">
                  <div className="text-xs text-[var(--ink-soft)]">{t.trial_date} · Coach {t.coach_name}</div>
                  <div>{t.feedback}</div>
                  {t.rec_day != null && (
                    <div className="mt-1 font-semibold">Recommended batch: {DAYS[t.rec_day]} {t.rec_time} — <Link href="/courses" className="text-[var(--gold)]">sign up →</Link></div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--ink-soft)]">{k}</dt>
      <dd className="font-semibold text-right">{v}</dd>
    </div>
  );
}
