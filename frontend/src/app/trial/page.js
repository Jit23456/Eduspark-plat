'use client';

import { useEffect, useState } from 'react';
import { useAuth, DAYS } from '@/context/AuthContext';
import { Users } from 'lucide-react';

export default function TrialPage() {
  const { api, user, isCustomer } = useAuth();
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [batches, setBatches] = useState([]);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ batch_id: '', trial_date: '', member_id: '', guest_name: '', guest_email: '', guest_phone: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('GET', '/public/locations', null, null).then(ls => { setLocations(ls); if (ls[0]) setLocationId(ls[0].id); }).catch(() => {});
  }, [api]);

  useEffect(() => {
    if (!locationId) return;
    api('GET', `/public/catalog?location_id=${locationId}`, null, null).then(setCatalog).catch(() => {});
    api('GET', `/public/batches?location_id=${locationId}`, null, null).then(setBatches).catch(() => {});
  }, [api, locationId]);

  useEffect(() => {
    if (isCustomer) api('GET', '/customer/profile').then(p => setMembers(p.members)).catch(() => {});
  }, [api, isCustomer]);

  // Map batches to their course for a friendly label
  const offeringLabel = {};
  for (const p of catalog) for (const l of p.levels) for (const v of l.variants) {
    offeringLabel[v.offering_id] = `${p.name} · ${l.name}`;
  }

  const nextDates = (dow) => {
    const out = [];
    const d = new Date();
    while (out.length < 3) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() === dow) out.push(d.toISOString().slice(0, 10));
    }
    return out;
  };

  const selectedBatch = batches.find(b => b.id === form.batch_id);

  const book = async () => {
    setMsg(null); setBusy(true);
    try {
      const r = await api('POST', '/public/trials', form);
      setMsg({ ok: true, text: r.message });
      setForm(f => ({ ...f, batch_id: '', trial_date: '' }));
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Book a free trial</h1>
      <p className="text-[var(--ink-soft)] mt-1">Try any class before committing — seat counts are live per batch.</p>

      <div className="card p-6 mt-6 space-y-5">
        <div>
          <label className="label">Preferred location</label>
          <div className="flex flex-wrap gap-2">
            {locations.map(l => (
              <button key={l.id} onClick={() => setLocationId(l.id)} className={`btn ${locationId === l.id ? 'btn-primary' : 'btn-ghost'}`}>
                {l.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Pick a class slot (available space shown)</label>
          <div className="grid sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
            {batches.map(b => (
              <button key={b.id} onClick={() => setForm(f => ({ ...f, batch_id: b.id, trial_date: '' }))}
                className={`text-left rounded-xl border p-3 text-sm transition ${form.batch_id === b.id ? 'border-[var(--gold)] bg-[var(--gold-soft)]' : 'border-[var(--line)] hover:border-[var(--gold)]'}`}>
                <div className="font-semibold">{offeringLabel[b.offering_id] || 'Class'}</div>
                <div className="text-xs text-[var(--ink-soft)] flex items-center gap-2 mt-1">
                  {DAYS[b.day_of_week]} {b.start_time}
                  <span className="badge"><Users size={10} /> {Math.max(0, b.seats_left)} spots</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {selectedBatch && (
          <div>
            <label className="label">Trial date</label>
            <div className="flex gap-2">
              {nextDates(selectedBatch.day_of_week).map(d => (
                <button key={d} onClick={() => setForm(f => ({ ...f, trial_date: d }))}
                  className={`btn btn-sm ${form.trial_date === d ? 'btn-gold' : 'btn-ghost'}`}>{d}</button>
              ))}
            </div>
          </div>
        )}

        {isCustomer ? (
          <div>
            <label className="label">Which member is trying the class?</label>
            <select className="input" value={form.member_id} onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))}>
              <option value="">Choose…</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
            </select>
          </div>
        ) : (
          <div className="grid sm:grid-cols-3 gap-3">
            <div><label className="label">Your name *</label><input className="input" value={form.guest_name} onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))} /></div>
            <div><label className="label">Email *</label><input className="input" type="email" value={form.guest_email} onChange={e => setForm(f => ({ ...f, guest_email: e.target.value }))} /></div>
            <div><label className="label">Phone *</label><input className="input" value={form.guest_phone} onChange={e => setForm(f => ({ ...f, guest_phone: e.target.value }))} /></div>
          </div>
        )}

        {msg && (
          <div className={`text-sm rounded-lg p-3 ${msg.ok ? 'text-[var(--green)] bg-[#e2f3ec]' : 'text-[var(--red)] bg-[#fbe9e5]'}`}>{msg.text}</div>
        )}

        <button className="btn btn-gold" disabled={busy || !form.batch_id || !form.trial_date || (isCustomer ? !form.member_id : !form.guest_name)} onClick={book}>
          {busy ? 'Booking…' : 'Book my free trial'}
        </button>
      </div>
    </div>
  );
}
