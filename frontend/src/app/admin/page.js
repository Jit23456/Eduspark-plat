'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, money, DAYS } from '@/context/AuthContext';

export default function AdminDashboard() {
  const { api, user, loading, isFranchisor, isManagement } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('Reports');
  const [msg, setMsg] = useState(null);

  const TABS = [
    'Reports', 'Roster', 'Customers', 'Events', 'Price changes', 'Staff', 'Tickets',
    ...(isFranchisor ? ['Catalog & config'] : []),
  ];

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/login'); return; }
    if (!['FRANCHISOR_MANAGEMENT', 'FRANCHISOR_ADMIN', 'FRANCHISEE_MANAGEMENT', 'FRANCHISEE_ADMIN', 'EVENT_MANAGER'].includes(user.role)) {
      router.push('/'); return;
    }
  }, [user, loading, router]);

  if (loading || !user) return <div className="max-w-6xl mx-auto px-4 py-16 text-[var(--ink-soft)]">Loading…</div>;

  const flash = (ok, text) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 6000); };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {isFranchisor ? 'Franchisor' : 'Franchisee'} {isManagement ? 'management' : 'admin'} console
          </h1>
          <p className="text-[var(--ink-soft)]">{user.name} · {user.role.replace(/_/g, ' ').toLowerCase()}</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() =>
          api('POST', '/system/run-jobs', {}).then(r => flash(true, `System jobs ran: ${r.attendance_rows} attendance rows, ${r.sessions_completed} sessions completed.`)).catch(e => flash(false, e.message))
        }>⚙ Run system jobs now</button>
      </div>

      {msg && <div className={`mt-4 text-sm rounded-lg p-3 ${msg.ok ? 'text-[var(--green)] bg-[#e2f3ec]' : 'text-[var(--red)] bg-[#fbe9e5]'}`}>{msg.text}</div>}

      <div className="flex gap-2 mt-6 overflow-x-auto pb-1">
        {TABS.map(t => <button key={t} className={`tab ${tab === t ? 'tab-active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'Reports' && <Reports api={api} isFranchisor={isFranchisor} />}
      {tab === 'Roster' && <Roster api={api} flash={flash} />}
      {tab === 'Customers' && <Customers api={api} flash={flash} />}
      {tab === 'Events' && <Events api={api} flash={flash} />}
      {tab === 'Price changes' && <PriceChanges api={api} flash={flash} isFranchisor={isFranchisor} isManagement={isManagement} />}
      {tab === 'Staff' && <Staff api={api} flash={flash} isFranchisor={isFranchisor} />}
      {tab === 'Tickets' && <Tickets api={api} flash={flash} />}
      {tab === 'Catalog & config' && isFranchisor && <CatalogConfig api={api} flash={flash} />}
    </div>
  );
}

/* ------------------------------- Reports ---------------------------------- */
function Reports({ api, isFranchisor }) {
  const [rev, setRev] = useState(null);
  const [failed, setFailed] = useState([]);
  const [missed, setMissed] = useState([]);
  const [assessments, setAssessments] = useState([]);

  useEffect(() => {
    api('GET', '/admin/reports/revenue').then(setRev).catch(() => {});
    api('GET', '/admin/reports/failed-registrations').then(setFailed).catch(() => {});
    api('GET', '/admin/missed-payments').then(setMissed).catch(() => {});
    api('GET', '/admin/trial-assessments').then(setAssessments).catch(() => {});
  }, [api]);

  const Block = ({ title, rows }) => (
    <div className="card p-5">
      <div className="font-bold mb-2">{title}</div>
      <table className="table-base">
        <tbody>
          {(rows || []).map((r, i) => (
            <tr key={i}><td>{r.name}</td><td className="text-right font-semibold">{money(r.revenue_cents)}</td></tr>
          ))}
          {(!rows || !rows.length) && <tr><td className="text-[var(--ink-soft)]">No paid invoices yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="mt-6 space-y-4">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isFranchisor && <Block title="Revenue by ownership" rows={rev?.by_ownership} />}
        <Block title="Revenue by location" rows={rev?.by_location} />
        <Block title="Revenue by planet" rows={rev?.by_planet} />
        <Block title="Revenue by level" rows={rev?.by_level} />
        <Block title="Revenue by month" rows={rev?.by_month} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="font-bold mb-2">Missed payments (by month)</div>
          <table className="table-base">
            <thead><tr><th>Month</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {missed.map(m => (
                <tr key={m.id}><td>{m.month}</td><td>{m.full_name}<div className="text-xs text-[var(--ink-soft)]">{m.email}</div></td>
                  <td>{money(m.total_cents)}</td><td><span className="badge badge-red">{m.status}</span></td></tr>
              ))}
              {missed.length === 0 && <tr><td colSpan={4} className="text-[var(--ink-soft)]">No missed payments 🎉</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card p-5">
          <div className="font-bold mb-2">Registrations failing on full slots</div>
          <table className="table-base">
            <thead><tr><th>When</th><th>Location</th><th>Course</th></tr></thead>
            <tbody>
              {failed.slice(0, 12).map((f, i) => (
                <tr key={i}><td>{new Date(f.created_at).toLocaleDateString()}</td><td>{f.location_name || '—'}</td>
                  <td>{f.planet_name ? `${f.planet_name} · ${f.level_name}` : '—'}</td></tr>
              ))}
              {failed.length === 0 && <tr><td colSpan={3} className="text-[var(--ink-soft)]">No capacity misses recorded.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <div className="font-bold mb-2">Trial assessments</div>
        <table className="table-base">
          <thead><tr><th>Date</th><th>Learner</th><th>Coach</th><th>Feedback</th></tr></thead>
          <tbody>
            {assessments.map(a => (
              <tr key={a.id}><td>{a.trial_date}</td><td>{a.member_name || a.guest_name}</td><td>{a.coach_name}</td><td>{a.feedback}</td></tr>
            ))}
            {assessments.length === 0 && <tr><td colSpan={4} className="text-[var(--ink-soft)]">No assessments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------- Roster ---------------------------------- */
function Roster({ api, flash }) {
  const [roster, setRoster] = useState([]);
  const load = useCallback(() => api('GET', '/admin/roster').then(setRoster).catch(() => {}), [api]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="card p-5 mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="font-bold">Staff roster (next 2 weeks — honors holidays, availability & leaves)</div>
        <button className="btn btn-primary btn-sm" onClick={() =>
          api('POST', '/admin/roster/generate', {}).then(r => { flash(true, `Roster generated: ${r.created} assignments (${r.skipped_holidays} holiday skips).`); load(); }).catch(e => flash(false, e.message))
        }>Generate next 2 weeks</button>
      </div>
      <table className="table-base">
        <thead><tr><th>Date</th><th>Time</th><th>Class</th><th>Coach</th><th>Location</th></tr></thead>
        <tbody>
          {roster.map(r => (
            <tr key={r.id}><td>{r.work_date}</td><td>{r.start_time}</td><td>{r.planet_name} · {r.level_name}</td>
              <td className="font-semibold">{r.coach_name}</td><td>{r.location_name}</td></tr>
          ))}
          {roster.length === 0 && <tr><td colSpan={5} className="text-[var(--ink-soft)]">No roster yet — generate one.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------ Customers ---------------------------------- */
function Customers({ api, flash }) {
  const [customers, setCustomers] = useState([]);
  const [credit, setCredit] = useState({ id: '', amount: '' });
  const load = useCallback(() => api('GET', '/admin/customers').then(setCustomers).catch(() => {}), [api]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="card p-5 mt-6">
      <div className="font-bold mb-3">Customers</div>
      <table className="table-base">
        <thead><tr><th>Name</th><th>Email</th><th>Location</th><th>Members</th><th>Store credit</th></tr></thead>
        <tbody>
          {customers.map(c => (
            <tr key={c.id}>
              <td className="font-semibold">{c.full_name}</td><td>{c.email}</td>
              <td>{c.location_name}</td><td>{c.member_count}</td>
              <td>
                {credit.id === c.id ? (
                  <span className="flex gap-1">
                    <input className="input max-w-24" placeholder="$" value={credit.amount} onChange={e => setCredit(cr => ({ ...cr, amount: e.target.value }))} />
                    <button className="btn btn-primary btn-sm" onClick={() =>
                      api('POST', `/admin/customers/${c.id}/store-credit`, { amount_cents: Math.round(parseFloat(credit.amount) * 100) })
                        .then(() => { flash(true, 'Store credit granted.'); setCredit({ id: '', amount: '' }); })
                        .catch(e => flash(false, e.message))
                    }>Grant</button>
                  </span>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => setCredit({ id: c.id, amount: '' })}>Grant credit</button>
                )}
              </td>
            </tr>
          ))}
          {customers.length === 0 && <tr><td colSpan={5} className="text-[var(--ink-soft)]">No customers yet.</td></tr>}
        </tbody>
      </table>
      <p className="text-xs text-[var(--ink-soft)] mt-3">
        Admin course registration for a customer (cash / POS / card-on-file) is available via the API; card entry uses the gateway-hosted page so numbers never touch our servers.
      </p>
    </div>
  );
}

/* -------------------------------- Events ----------------------------------- */
function Events({ api, flash }) {
  const [events, setEvents] = useState([]);
  const [report, setReport] = useState(null); // {event, rows, filters}
  const [filters, setFilters] = useState({ missing_cfc: false, has_byes: false, play_up: false });
  const [form, setForm] = useState({ name: '', template_key: 'rapid_tournament', start_date: '', end_date: '', status: 'LIVE' });
  const load = useCallback(() => api('GET', '/events').then(setEvents).catch(() => {}), [api]);
  useEffect(() => { load(); }, [load]);

  const openReport = async (ev, f = filters) => {
    const qs = Object.entries(f).filter(([, v]) => v).map(([k]) => `${k}=1`).join('&');
    const rows = await api('GET', `/events/${ev.id}/report${qs ? '?' + qs : ''}`);
    setReport({ event: ev, rows });
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="card p-5">
        <div className="font-bold mb-3">Create event from template</div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-40"><label className="label">Name</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Template</label>
            <select className="input" value={form.template_key} onChange={e => setForm(f => ({ ...f, template_key: e.target.value }))}>
              <option value="rapid_tournament">Rapid tournament</option><option value="day_camp">Day camp</option>
            </select></div>
          <div><label className="label">Start</label><input className="input" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
          <div><label className="label">End</label><input className="input" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
          <button className="btn btn-primary" disabled={!form.name || !form.start_date || !form.end_date}
            onClick={() => api('POST', '/events', form).then(() => { flash(true, 'Event created (edit phases/dates in the detail view).'); load(); }).catch(e => flash(false, e.message))}>
            Create
          </button>
        </div>
      </div>

      <div className="card p-5">
        <div className="font-bold mb-3">Events (live / upcoming / planned)</div>
        <table className="table-base">
          <thead><tr><th>Event</th><th>Type</th><th>Dates</th><th>Status</th><th>Entries</th><th></th></tr></thead>
          <tbody>
            {events.map(e => (
              <tr key={e.id}>
                <td className="font-semibold">{e.name}</td><td>{e.event_type}</td>
                <td>{e.start_date} → {e.end_date}</td>
                <td>
                  <select className="input" value={e.status} onChange={ev =>
                    api('PUT', `/events/${e.id}`, { status: ev.target.value }).then(load)}>
                    {['PLANNED', 'LIVE', 'CLOSED', 'ARCHIVED'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td>{e.registration_count}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => openReport(e)}>Entries report</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {report && (
        <div className="card p-5 animate-slideUp">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="font-bold">Entries — {report.event.name}</div>
            {['missing_cfc', 'has_byes', 'play_up'].map(k => (
              <label key={k} className="flex items-center gap-1 text-xs font-semibold">
                <input type="checkbox" checked={filters[k]} onChange={e => {
                  const nf = { ...filters, [k]: e.target.checked };
                  setFilters(nf); openReport(report.event, nf);
                }} />
                {k === 'missing_cfc' ? 'Missing CFC ID' : k === 'has_byes' ? 'Requesting byes' : 'Play up'}
              </label>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Player</th><th>Buyer</th><th>Email</th><th>Phone</th><th>Parking</th><th>CFC</th><th>FIDE</th><th>Section</th><th>Byes</th><th>Play up</th><th>Paid</th></tr></thead>
              <tbody>
                {report.rows.map(r => (
                  <tr key={r.registration_id}>
                    <td className="font-semibold">{r.player_name}</td><td>{r.buyer_name}</td><td>{r.email}</td><td>{r.phone}</td>
                    <td>{r.parking_pass || '—'}</td>
                    <td>{r.cfc_id || <CfcInline api={api} regId={r.registration_id} onDone={() => openReport(report.event)} />}</td>
                    <td>{r.fide_id || '—'}</td><td>{r.section || '—'}</td>
                    <td>{r.bye_rounds ? JSON.parse(r.bye_rounds).map(b => 'R' + b).join(',') || '—' : '—'}</td>
                    <td>{r.play_up ? 'Yes' : '—'}</td><td>{money(r.price_paid_cents)} ({r.phase_type})</td>
                  </tr>
                ))}
                {report.rows.length === 0 && <tr><td colSpan={11} className="text-[var(--ink-soft)]">No entries match the filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CfcInline({ api, regId, onDone }) {
  const [v, setV] = useState('');
  return (
    <span className="flex gap-1">
      <input className="input max-w-24" placeholder="CFC ID" value={v} onChange={e => setV(e.target.value)} />
      <button className="btn btn-ghost btn-sm" disabled={!v} onClick={() => api('PUT', `/events/registrations/${regId}/cfc`, { cfc_id: v }).then(onDone)}>Set</button>
    </span>
  );
}

/* ---------------------------- Price changes -------------------------------- */
function PriceChanges({ api, flash, isFranchisor, isManagement }) {
  const [requests, setRequests] = useState([]);
  const [variants, setVariants] = useState([]);
  const [form, setForm] = useState({ variant_id: '', requested_rate: '', reason: '' });
  const load = useCallback(() => {
    api('GET', '/admin/price-change-requests').then(setRequests).catch(() => {});
    api('GET', '/admin/variants').then(setVariants).catch(() => {});
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const chosen = variants.find(v => v.id === form.variant_id);

  return (
    <div className="mt-6 space-y-4">
      {!isFranchisor && (
        <div className="card p-5">
          <div className="font-bold mb-3">Submit a price change request to the franchisor</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Course variant</label>
              <select className="input" value={form.variant_id} onChange={e => setForm(f => ({ ...f, variant_id: e.target.value }))}>
                <option value="">Choose…</option>
                {variants.map(v => (
                  <option key={v.id} value={v.id}>{v.planet_name} · {v.level_name} · {v.class_setting} {v.sessions_per_week}x — {money(v.list_price_cents)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Franchisor rate (current)</label>
              <input className="input" disabled value={chosen ? money(chosen.list_price_cents) : '—'} />
            </div>
            <div>
              <label className="label">Requested rate (CAD/month)</label>
              <input className="input" type="number" step="0.01" value={form.requested_rate} onChange={e => setForm(f => ({ ...f, requested_rate: e.target.value }))} />
            </div>
            <div>
              <label className="label">Reason for change</label>
              <input className="input" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Higher rent at this location" />
            </div>
          </div>
          <button className="btn btn-primary mt-3" disabled={!form.variant_id || !form.requested_rate || !form.reason}
            onClick={() => api('POST', '/admin/price-change-requests', {
              variant_id: form.variant_id, requested_rate_cents: Math.round(parseFloat(form.requested_rate) * 100),
              reason: form.reason, attachments: [],
            }).then(() => { flash(true, 'Request submitted — track its progress below.'); setForm({ variant_id: '', requested_rate: '', reason: '' }); load(); }).catch(e => flash(false, e.message))}>
            Submit request
          </button>
        </div>
      )}

      <div className="card p-5">
        <div className="font-bold mb-3">{isFranchisor ? 'Requests from franchisees' : 'My requests & progress'}</div>
        <table className="table-base">
          <thead><tr>{isFranchisor && <th>Franchisee</th>}<th>Variant</th><th>Franchisor rate</th><th>Requested</th><th>Reason</th><th>Status</th>{isFranchisor && isManagement && <th></th>}</tr></thead>
          <tbody>
            {requests.map(r => (
              <tr key={r.id}>
                {isFranchisor && <td className="font-semibold">{r.ownership_name}</td>}
                <td>{r.planet_name} · {r.level_name} · {r.class_setting} {r.sessions_per_week}x</td>
                <td>{money(r.franchisor_rate_cents)}</td>
                <td className="font-semibold">{money(r.requested_rate_cents)}</td>
                <td className="max-w-56">{r.reason}</td>
                <td><span className={`badge ${r.status === 'APPROVED' ? 'badge-green' : r.status === 'PENDING' ? 'badge-gold' : 'badge-red'}`}>{r.status}</span></td>
                {isFranchisor && isManagement && (
                  <td>{r.status === 'PENDING' && (
                    <span className="flex gap-1">
                      <button className="btn btn-primary btn-sm" onClick={() => api('PUT', `/admin/price-change-requests/${r.id}/decide`, { decision: 'APPROVED' }).then(() => { flash(true, 'Approved — local price applied.'); load(); })}>Approve</button>
                      <button className="btn btn-danger btn-sm" onClick={() => api('PUT', `/admin/price-change-requests/${r.id}/decide`, { decision: 'REJECTED' }).then(load)}>Reject</button>
                    </span>
                  )}</td>
                )}
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan={7} className="text-[var(--ink-soft)]">No price change requests.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --------------------------------- Staff ------------------------------------ */
function Staff({ api, flash, isFranchisor }) {
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', role: 'COACH' });
  const load = useCallback(() => api('GET', '/admin/staff').then(setStaff).catch(() => {}), [api]);
  useEffect(() => { load(); }, [load]);

  const roles = isFranchisor ? ['COACH', 'EVENT_MANAGER', 'FRANCHISOR_ADMIN'] : ['COACH', 'EVENT_MANAGER', 'FRANCHISEE_ADMIN'];

  return (
    <div className="mt-6 space-y-4">
      <div className="card p-5">
        <div className="font-bold mb-3">Create staff account (temporary password is emailed; reset required on first login)</div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-40"><label className="label">Full name</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="flex-1 min-w-40"><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div><label className="label">Role</label>
            <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              {roles.map(r => <option key={r}>{r}</option>)}
            </select></div>
          <button className="btn btn-primary" disabled={!form.name || !form.email}
            onClick={() => api('POST', '/admin/staff', form)
              .then(r => { flash(true, `Account created. Temp password (also emailed): ${r.temp_password}`); setForm({ name: '', email: '', role: 'COACH' }); load(); })
              .catch(e => flash(false, e.message))}>
            Create & email temp password
          </button>
        </div>
      </div>

      <div className="card p-5">
        <div className="font-bold mb-3">Staff</div>
        <table className="table-base">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
          <tbody>
            {staff.map(s => (
              <tr key={s.id}><td className="font-semibold">{s.name}</td><td>{s.email}</td>
                <td>{s.role.replace(/_/g, ' ')}</td>
                <td>{s.must_reset_password ? <span className="badge badge-gold">temp password</span> : <span className="badge badge-green">active</span>}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------- Tickets ----------------------------------- */
function Tickets({ api, flash }) {
  const [tickets, setTickets] = useState([]);
  const [form, setForm] = useState({ category: 'IT', description: '' });
  const load = useCallback(() => api('GET', '/admin/tickets').then(setTickets).catch(() => {}), [api]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="mt-6 space-y-4">
      <div className="card p-5">
        <div className="font-bold mb-3">Raise a ticket (IT / Non-IT)</div>
        <div className="flex flex-wrap gap-2 items-end">
          <div><label className="label">Category</label>
            <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              <option value="IT">IT</option><option value="NON_IT">Non-IT</option>
            </select></div>
          <div className="flex-1 min-w-64"><label className="label">Short description</label>
            <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <button className="btn btn-primary" disabled={!form.description}
            onClick={() => api('POST', '/admin/tickets', form).then(() => { flash(true, 'Ticket raised.'); setForm({ category: 'IT', description: '' }); load(); })}>
            Submit
          </button>
        </div>
      </div>
      <div className="card p-5">
        <table className="table-base">
          <thead><tr><th>Created</th><th>Category</th><th>Description</th><th>Status</th></tr></thead>
          <tbody>
            {tickets.map(t => (
              <tr key={t.id}>
                <td>{new Date(t.created_at).toLocaleDateString()}</td>
                <td><span className="badge">{t.category}</span></td>
                <td>{t.description}</td>
                <td>
                  <select className="input" value={t.status} onChange={e => api('PUT', `/admin/tickets/${t.id}/status`, { status: e.target.value }).then(load)}>
                    {['OPEN', 'IN_PROGRESS', 'RESOLVED'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {tickets.length === 0 && <tr><td colSpan={4} className="text-[var(--ink-soft)]">No tickets.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------- Catalog & config ------------------------------ */
function CatalogConfig({ api, flash }) {
  const [tiers, setTiers] = useState([]);
  const [config, setConfig] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [holForm, setHolForm] = useState({ date: '', name: '' });
  const [ownForm, setOwnForm] = useState({ type: 'FRANCHISEE', name: '', owner_name: '', owner_email: '' });

  const load = useCallback(() => {
    api('GET', '/admin/discount-tiers').then(setTiers).catch(() => {});
    api('GET', '/admin/config').then(setConfig).catch(() => {});
    api('GET', '/admin/holidays').then(setHolidays).catch(() => {});
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const setTier = (id, percent) => setTiers(ts => ts.map(t => t.id === id ? { ...t, percent: parseFloat(percent) || 0 } : t));
  const setCfg = (key, value) => setConfig(cs => cs.map(c => c.key === key ? { ...c, value } : c));

  const ruleLabel = { GROUP_FREQUENCY: 'Group frequency (sessions/week)', MULTI_PLANET: 'Multi-planet (subject count)', PRIVATE_FREQUENCY: 'Private frequency (sessions/week)' };

  return (
    <div className="mt-6 space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="font-bold mb-3">Discount tiers (Rules 1–3, franchisor-governed)</div>
          {Object.entries(ruleLabel).map(([rule, label]) => (
            <div key={rule} className="mb-3">
              <div className="label">{label}</div>
              <div className="flex flex-wrap gap-2">
                {tiers.filter(t => t.rule_type === rule).map(t => (
                  <div key={t.id} className="flex items-center gap-1 rounded-lg border border-[var(--line)] px-2 py-1 text-sm">
                    <span className="font-semibold">{t.threshold_count} →</span>
                    <input className="input max-w-16 !py-0.5 !px-1.5" value={t.percent} onChange={e => setTier(t.id, e.target.value)} />
                    <span>%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button className="btn btn-primary btn-sm" onClick={() =>
            api('PUT', '/admin/discount-tiers', { tiers }).then(() => flash(true, 'Discount tiers saved.')).catch(e => flash(false, e.message))
          }>Save tiers</button>
        </div>

        <div className="card p-5">
          <div className="font-bold mb-3">Global configuration</div>
          {config.map(c => (
            <div key={c.key} className="flex items-center gap-2 mb-2 text-sm">
              <span className="flex-1 font-mono text-xs">{c.key}</span>
              <input className="input max-w-32" value={c.value} onChange={e => setCfg(c.key, e.target.value)} />
            </div>
          ))}
          <button className="btn btn-primary btn-sm mt-2" onClick={() =>
            api('PUT', '/admin/config', Object.fromEntries(config.map(c => [c.key, c.value])))
              .then(() => flash(true, 'Configuration saved.')).catch(e => flash(false, e.message))
          }>Save config</button>
        </div>

        <div className="card p-5">
          <div className="font-bold mb-3">Holiday calendar</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {holidays.map(h => <span key={h.id} className="badge badge-navy">{h.date} · {h.name}</span>)}
          </div>
          <div className="flex gap-2 items-end">
            <div><label className="label">Date</label><input className="input" type="date" value={holForm.date} onChange={e => setHolForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div className="flex-1"><label className="label">Name</label><input className="input" value={holForm.name} onChange={e => setHolForm(f => ({ ...f, name: e.target.value }))} /></div>
            <button className="btn btn-primary btn-sm" disabled={!holForm.date || !holForm.name}
              onClick={() => api('POST', '/admin/holidays', holForm).then(() => { setHolForm({ date: '', name: '' }); load(); })}>Add</button>
          </div>
        </div>

        <div className="card p-5">
          <div className="font-bold mb-3">Create ownership (sends management account + temp password)</div>
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={ownForm.type} onChange={e => setOwnForm(f => ({ ...f, type: e.target.value }))}>
              <option value="FRANCHISEE">Franchisee</option><option value="CORPORATE">Corporate</option>
            </select>
            <input className="input" placeholder="Ownership name" value={ownForm.name} onChange={e => setOwnForm(f => ({ ...f, name: e.target.value }))} />
            <input className="input" placeholder="Owner full name" value={ownForm.owner_name} onChange={e => setOwnForm(f => ({ ...f, owner_name: e.target.value }))} />
            <input className="input" placeholder="Owner email" value={ownForm.owner_email} onChange={e => setOwnForm(f => ({ ...f, owner_email: e.target.value }))} />
          </div>
          <button className="btn btn-primary btn-sm mt-3" disabled={!ownForm.name || !ownForm.owner_name || !ownForm.owner_email}
            onClick={() => api('POST', '/admin/ownerships', ownForm)
              .then(() => { flash(true, 'Ownership created — management account emailed a temporary password.'); setOwnForm({ type: 'FRANCHISEE', name: '', owner_name: '', owner_email: '' }); })
              .catch(e => flash(false, e.message))}>
            Create ownership
          </button>
        </div>
      </div>
    </div>
  );
}
