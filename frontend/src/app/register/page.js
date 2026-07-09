'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Plus, Trash2 } from 'lucide-react';

const EMPTY_MEMBER = { first_name: '', last_name: '', dob: '', gender: '', grade: '', email: '', emergency_contact: '', cfc_id: '', tshirt_size: '', preferred_color: '' };

export default function RegisterPage() {
  const { api, register } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    full_name: '', dob: '', email: '', phone: '', emergency_contact: '', gender: '', cfc_id: '',
    nearest_location_id: '', accessible_location_ids: [],
    register_self_as_member: false, members: [],
    card_number: '', card_exp: '', card_cvc: '', save_card: true,
    tnc_accepted: false, account_consent: false,
    password: '', confirm_password: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { api('GET', '/public/locations', null, null).then(setLocations).catch(() => {}); }, [api]);

  const setMemberField = (i, k, v) => {
    const members = [...form.members];
    members[i] = { ...members[i], [k]: v };
    set('members', members);
  };

  const submit = async () => {
    setError(''); setBusy(true);
    try {
      // Card data is exchanged for a token client-side (mock gateway); the
      // number itself is never persisted.
      const last4 = form.card_number.replace(/\D/g, '').slice(-4);
      const [expM, expY] = form.card_exp.split('/').map(s => parseInt(s, 10));
      await register({
        full_name: form.full_name, dob: form.dob, email: form.email, phone: form.phone,
        emergency_contact: form.emergency_contact, gender: form.gender, cfc_id: form.cfc_id || null,
        nearest_location_id: form.nearest_location_id,
        accessible_location_ids: form.accessible_location_ids,
        register_self_as_member: form.register_self_as_member,
        members: form.members,
        tnc_accepted: form.tnc_accepted, account_consent: form.account_consent,
        password: form.password, confirm_password: form.confirm_password,
        card: last4 ? {
          token: 'tok_' + Math.random().toString(36).slice(2), brand: 'Visa', last4,
          exp_month: expM || null, exp_year: expY ? 2000 + expY : null, save_for_future: form.save_card,
        } : null,
      });
      router.push('/dashboard');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const bothBoxesChecked = form.tnc_accepted && form.account_consent;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight">Create your family account</h1>
      <p className="text-[var(--ink-soft)] mt-1">One account for the whole family — add each learner as a member profile.</p>

      <div className="flex gap-2 mt-6">
        {['Your details', 'Members', 'Payment & finish'].map((t, i) => (
          <div key={t} className={`tab ${step === i + 1 ? 'tab-active' : ''}`} onClick={() => setStep(i + 1)}>{i + 1}. {t}</div>
        ))}
      </div>

      {error && <div className="mt-4 text-sm text-[var(--red)] bg-[#fbe9e5] rounded-lg p-3">{error}</div>}

      {step === 1 && (
        <div className="card p-6 mt-4 space-y-4 animate-slideUp">
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Full name *</label><input className="input" value={form.full_name} onChange={e => set('full_name', e.target.value)} /></div>
            <div><label className="label">Date of birth (mm/dd/yyyy) *</label><input className="input" type="date" value={form.dob} onChange={e => set('dob', e.target.value)} /></div>
            <div><label className="label">Email *</label><input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
            <div><label className="label">Phone number *</label><input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
            <div><label className="label">Emergency contact *</label><input className="input" value={form.emergency_contact} onChange={e => set('emergency_contact', e.target.value)} /></div>
            <div>
              <label className="label">Gender</label>
              <select className="input" value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">Prefer not to say</option><option>Female</option><option>Male</option><option>Non-binary</option>
              </select>
            </div>
            <div><label className="label">CFC ID (optional)</label><input className="input" value={form.cfc_id} onChange={e => set('cfc_id', e.target.value)} /></div>
            <div>
              <label className="label">Nearest location *</label>
              <select className="input" value={form.nearest_location_id} onChange={e => set('nearest_location_id', e.target.value)}>
                <option value="">Choose…</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name} — {l.city}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Other accessible locations (optional)</label>
            <div className="flex flex-wrap gap-2">
              {locations.filter(l => l.id !== form.nearest_location_id).map(l => (
                <label key={l.id} className={`btn btn-sm ${form.accessible_location_ids.includes(l.id) ? 'btn-primary' : 'btn-ghost'}`}>
                  <input type="checkbox" className="hidden" checked={form.accessible_location_ids.includes(l.id)}
                    onChange={e => set('accessible_location_ids', e.target.checked
                      ? [...form.accessible_location_ids, l.id]
                      : form.accessible_location_ids.filter(x => x !== l.id))} />
                  {l.name}
                </label>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setStep(2)}>Continue</button>
        </div>
      )}

      {step === 2 && (
        <div className="card p-6 mt-4 space-y-5 animate-slideUp">
          <label className="flex items-center gap-2 font-semibold text-sm">
            <input type="checkbox" checked={form.register_self_as_member}
              onChange={e => set('register_self_as_member', e.target.checked)} />
            Register me as a member as well (adult learner — contact info copied from your profile)
          </label>

          {form.members.map((m, i) => (
            <div key={i} className="border border-[var(--line)] rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div className="font-bold text-sm">Member {i + 1}</div>
                <button className="btn btn-danger btn-sm" onClick={() => set('members', form.members.filter((_, j) => j !== i))}><Trash2 size={13} /> Remove</button>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div><label className="label">First name *</label><input className="input" value={m.first_name} onChange={e => setMemberField(i, 'first_name', e.target.value)} /></div>
                <div><label className="label">Last name *</label><input className="input" value={m.last_name} onChange={e => setMemberField(i, 'last_name', e.target.value)} /></div>
                <div><label className="label">Date of birth</label><input className="input" type="date" value={m.dob} onChange={e => setMemberField(i, 'dob', e.target.value)} /></div>
                <div>
                  <label className="label">Gender</label>
                  <select className="input" value={m.gender} onChange={e => setMemberField(i, 'gender', e.target.value)}>
                    <option value="">—</option><option>Female</option><option>Male</option><option>Non-binary</option>
                  </select>
                </div>
                <div><label className="label">Grade</label><input className="input" value={m.grade} onChange={e => setMemberField(i, 'grade', e.target.value)} placeholder="e.g. Grade 4" /></div>
                <div><label className="label">Email (only if separate)</label><input className="input" value={m.email} onChange={e => setMemberField(i, 'email', e.target.value)} /></div>
                <div><label className="label">Emergency contact</label><input className="input" value={m.emergency_contact} onChange={e => setMemberField(i, 'emergency_contact', e.target.value)} /></div>
                <div><label className="label">CFC ID (chess only)</label><input className="input" value={m.cfc_id} onChange={e => setMemberField(i, 'cfc_id', e.target.value)} /></div>
                <div>
                  <label className="label">T-shirt size</label>
                  <select className="input" value={m.tshirt_size} onChange={e => setMemberField(i, 'tshirt_size', e.target.value)}>
                    <option value="">—</option>{['YS', 'YM', 'YL', 'S', 'M', 'L', 'XL'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className="label">Preferred colour</label><input className="input" value={m.preferred_color} onChange={e => setMemberField(i, 'preferred_color', e.target.value)} /></div>
              </div>
            </div>
          ))}

          <button className="btn btn-ghost" onClick={() => set('members', [...form.members, { ...EMPTY_MEMBER }])}>
            <Plus size={15} /> Add a child / family member
          </button>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
            <button className="btn btn-primary" onClick={() => setStep(3)}>Continue</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card p-6 mt-4 space-y-5 animate-slideUp">
          <div>
            <div className="font-bold">Credit / debit card</div>
            <p className="text-xs text-[var(--ink-soft)] mt-1">
              Saving your card is optional — except for recurring subscriptions like weekly lessons
              (which need a 15-day cancellation notice), where a saved card is mandatory.
              Card details are tokenized by the payment gateway; we never store the number.
            </p>
            <div className="grid sm:grid-cols-3 gap-3 mt-3">
              <div className="sm:col-span-2"><label className="label">Card number</label><input className="input" placeholder="4242 4242 4242 4242" value={form.card_number} onChange={e => set('card_number', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">MM/YY</label><input className="input" placeholder="12/28" value={form.card_exp} onChange={e => set('card_exp', e.target.value)} /></div>
                <div><label className="label">CVC</label><input className="input" placeholder="123" value={form.card_cvc} onChange={e => set('card_cvc', e.target.value)} /></div>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm mt-3">
              <input type="checkbox" checked={form.save_card} onChange={e => set('save_card', e.target.checked)} />
              Save this card for future transactions
            </label>
          </div>

          <div className="border-t border-[var(--line)] pt-4 space-y-2">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={form.tnc_accepted} onChange={e => set('tnc_accepted', e.target.checked)} />
              I agree to the Terms & Conditions of Fraser Valley Chess Academy. *
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={form.account_consent} onChange={e => set('account_consent', e.target.checked)} />
              I consent to creating a new account with the details provided. *
            </label>
          </div>

          {bothBoxesChecked && (
            <div className="grid sm:grid-cols-2 gap-3 animate-slideUp">
              <div><label className="label">Password *</label><input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} minLength={8} /></div>
              <div><label className="label">Confirm password *</label><input className="input" type="password" value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)} minLength={8} /></div>
            </div>
          )}

          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button>
            <button className="btn btn-gold" disabled={!bothBoxesChecked || busy} onClick={submit}>
              {busy ? 'Creating account…' : 'Complete registration'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
