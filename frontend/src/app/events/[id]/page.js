'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useAuth, money } from '@/context/AuthContext';
import { CalendarDays, MapPin, Trophy, Swords } from 'lucide-react';

export default function EventDetailPage({ params }) {
  const { id } = use(params);
  const { api, user, isCustomer } = useAuth();
  const [event, setEvent] = useState(null);
  const [members, setMembers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ member_id: '', section_id: '', bye_rounds: [], play_up: false, cfc_id_requested: false, tshirt_size: '', interac_email: '', car_plate: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api('GET', `/public/events/${id}`, null, null).then(setEvent).catch(() => {});
  useEffect(() => { load(); }, [api, id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isCustomer) api('GET', '/customer/profile').then(p => setMembers(p.members)).catch(() => {});
  }, [api, isCustomer]);

  if (!event) return <div className="max-w-4xl mx-auto px-4 py-16 text-[var(--ink-soft)]">Loading…</div>;

  const rounds = event.rounds ? Array.from({ length: event.rounds }, (_, i) => i + 1) : [];

  const register = async () => {
    setError(''); setBusy(true);
    try {
      const r = await api('POST', `/customer/events/${id}/register`, form);
      setSuccess(`Registered! Paid ${money(r.invoice.total_cents)} — earned ${r.loyalty_points} points.`);
      setShowForm(false);
      load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="card overflow-hidden">
        <div className="bg-[var(--navy)] text-white p-8">
          <div className="flex gap-2"><span className="badge badge-gold">{event.event_type}</span><span className="badge bg-white/15 text-white">{event.status}</span></div>
          <h1 className="text-3xl font-extrabold mt-3">{event.name}</h1>
          <p className="text-white/75 mt-2">{event.description}</p>
          <div className="flex flex-wrap gap-5 text-sm mt-4 text-white/85">
            <span className="flex items-center gap-1"><CalendarDays size={15} /> {event.start_date} → {event.end_date}</span>
            <span className="flex items-center gap-1"><MapPin size={15} /> {event.location_name || 'TBA'}{event.city ? `, ${event.city}` : ''}</span>
            {event.rounds && <span className="flex items-center gap-1"><Swords size={15} /> {event.rounds} rounds · max {event.max_byes ?? 0} byes</span>}
            {event.prize_text && <span className="flex items-center gap-1"><Trophy size={15} /> {event.prize_text}</span>}
          </div>
        </div>
        <div className="board-strip" />

        <div className="p-8">
          {/* Pricing phases */}
          <h2 className="font-extrabold text-lg">Entry pricing</h2>
          <div className="flex flex-wrap gap-3 mt-3">
            {event.phases.map(p => (
              <div key={p.id} className={`rounded-xl border p-4 min-w-36 ${event.current_phase?.id === p.id ? 'border-[var(--gold)] bg-[var(--gold-soft)]' : 'border-[var(--line)] opacity-70'}`}>
                <div className="text-xs font-bold uppercase tracking-wide">{p.phase_type.replace('_', ' ')}</div>
                <div className="text-2xl font-extrabold mt-1">{money(p.price_cents)}</div>
                <div className="text-xs text-[var(--ink-soft)]">{p.starts_on} → {p.ends_on}</div>
                {event.current_phase?.id === p.id && <div className="badge badge-gold mt-2">current</div>}
              </div>
            ))}
          </div>

          {event.sections.length > 0 && (
            <>
              <h2 className="font-extrabold text-lg mt-8">Sections</h2>
              <div className="flex flex-wrap gap-2 mt-2">
                {event.sections.map(s => (
                  <span key={s.id} className="badge badge-navy">{s.name}{s.prize_text ? ` · ${s.prize_text}` : ''}</span>
                ))}
              </div>
            </>
          )}

          {success && <div className="mt-6 text-sm text-[var(--green)] bg-[#e2f3ec] rounded-lg p-3">{success}</div>}
          {error && <div className="mt-6 text-sm text-[var(--red)] bg-[#fbe9e5] rounded-lg p-3">{error}</div>}

          {/* Registration */}
          <div className="mt-8">
            {!user ? (
              <Link href="/login" className="btn btn-gold">Sign in to register</Link>
            ) : isCustomer && !showForm ? (
              <button className="btn btn-gold" onClick={() => setShowForm(true)}>
                Register a member — {event.current_phase ? money(event.current_phase.price_cents) : 'closed'}
              </button>
            ) : null}

            {showForm && (
              <div className="card p-6 mt-4 space-y-4 animate-slideUp">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Member *</label>
                    <select className="input" value={form.member_id} onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))}>
                      <option value="">Choose…</option>
                      {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                    </select>
                  </div>
                  {event.sections.length > 0 && (
                    <div>
                      <label className="label">Section</label>
                      <select className="input" value={form.section_id} onChange={e => setForm(f => ({ ...f, section_id: e.target.value }))}>
                        <option value="">Choose…</option>
                        {event.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                  {rounds.length > 0 && (
                    <div className="sm:col-span-2">
                      <label className="label">Byes (max {event.max_byes ?? 0} — last round not allowed)</label>
                      <div className="flex gap-2">
                        {rounds.map(r => (
                          <button key={r} disabled={r === event.rounds}
                            onClick={() => setForm(f => ({ ...f, bye_rounds: f.bye_rounds.includes(r) ? f.bye_rounds.filter(x => x !== r) : [...f.bye_rounds, r] }))}
                            className={`btn btn-sm ${form.bye_rounds.includes(r) ? 'btn-primary' : 'btn-ghost'} ${r === event.rounds ? 'opacity-30' : ''}`}>
                            R{r}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="label">T-shirt size</label>
                    <select className="input" value={form.tshirt_size} onChange={e => setForm(f => ({ ...f, tshirt_size: e.target.value }))}>
                      <option value="">From profile</option>{['YS', 'YM', 'YL', 'S', 'M', 'L', 'XL'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Interac email (for prizes)</label><input className="input" value={form.interac_email} onChange={e => setForm(f => ({ ...f, interac_email: e.target.value }))} /></div>
                  <div><label className="label">Car plate (parking pass)</label><input className="input" value={form.car_plate} onChange={e => setForm(f => ({ ...f, car_plate: e.target.value }))} /></div>
                </div>
                <div className="flex flex-wrap gap-5 text-sm">
                  {!!event.play_up_allowed && (
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={form.play_up} onChange={e => setForm(f => ({ ...f, play_up: e.target.checked }))} />
                      Play up a section {event.play_up_fee_cents ? `(+${money(event.play_up_fee_cents)})` : ''}
                    </label>
                  )}
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.cfc_id_requested} onChange={e => setForm(f => ({ ...f, cfc_id_requested: e.target.checked }))} />
                    I need a CFC ID {event.cfc_id_fee_cents ? `(+${money(event.cfc_id_fee_cents)})` : ''}
                  </label>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                  <button className="btn btn-gold" disabled={!form.member_id || busy} onClick={register}>
                    {busy ? 'Processing…' : 'Pay & register'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Public registration list */}
          {!!event.public_list_enabled && (
            <div className="mt-10">
              <h2 className="font-extrabold text-lg">Registered players ({event.registrations.length})</h2>
              <div className="overflow-x-auto mt-3">
                <table className="table-base">
                  <thead><tr><th>Player</th><th>Section</th><th>CFC ID</th><th>Byes</th><th>Play up</th></tr></thead>
                  <tbody>
                    {event.registrations.map((r, i) => (
                      <tr key={i}>
                        <td className="font-semibold">{r.player_name}</td>
                        <td>{r.section || '—'}</td>
                        <td>{r.cfc_id}</td>
                        <td>{r.bye_rounds ? JSON.parse(r.bye_rounds).map(b => 'R' + b).join(', ') || '—' : '—'}</td>
                        <td>{r.play_up ? 'Yes' : '—'}</td>
                      </tr>
                    ))}
                    {event.registrations.length === 0 && <tr><td colSpan={5} className="text-[var(--ink-soft)]">Be the first to register!</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
