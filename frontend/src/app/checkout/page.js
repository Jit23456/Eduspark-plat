'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, money } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { Trash2 } from 'lucide-react';

export default function CheckoutPage() {
  const { api, user, loading } = useAuth();
  const { items, removeItem, setMember, clear } = useCart();
  const router = useRouter();

  const [members, setMembers] = useState([]);
  const [cards, setCards] = useState([]);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [useCredit, setUseCredit] = useState(false);
  const [credit, setCredit] = useState(0);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/login'); return; }
    if (user.role !== 'CUSTOMER') return;
    api('GET', '/customer/profile').then(p => setMembers(p.members)).catch(() => {});
    api('GET', '/customer/payment-methods').then(setCards).catch(() => {});
    api('GET', '/customer/dashboard').then(d => setCredit(d.store_credit_cents)).catch(() => {});
  }, [api, user, loading, router]);

  const refreshQuote = useCallback(() => {
    const ready = items.filter(i => i.member_id);
    if (!ready.length || ready.length !== items.length) { setQuote(null); return; }
    api('POST', '/customer/cart/quote', {
      items: items.map(i => ({ offering_id: i.offering_id, member_id: i.member_id, batch_ids: i.batch_ids })),
    }).then(setQuote).catch(e => setError(e.message));
  }, [api, items]);

  useEffect(() => { refreshQuote(); }, [refreshQuote]);

  const checkout = async () => {
    setError(''); setBusy(true);
    try {
      const result = await api('POST', '/customer/cart/checkout', {
        items: items.map(i => ({ offering_id: i.offering_id, member_id: i.member_id, batch_ids: i.batch_ids })),
        apply_store_credit: useCredit,
      });
      clear();
      setDone(result);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="card p-8 animate-slideUp">
          <div className="text-5xl">🎉</div>
          <h1 className="text-2xl font-extrabold mt-4">You&apos;re enrolled!</h1>
          <p className="text-[var(--ink-soft)] mt-2">
            Paid {money(done.invoice.total_cents)} · earned <b>{done.loyalty_points} loyalty points</b>.
            A receipt has been emailed to you.
          </p>
          <Link href="/dashboard" className="btn btn-primary mt-6">Go to my dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Checkout</h1>

      {items.length === 0 ? (
        <div className="card p-8 mt-6 text-center text-[var(--ink-soft)]">
          Your cart is empty. <Link href="/courses" className="text-[var(--gold)] font-semibold">Browse courses →</Link>
        </div>
      ) : (
        <>
          <div className="card p-6 mt-6 space-y-4">
            {items.map(i => (
              <div key={i.offering_id} className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] pb-4 last:border-0 last:pb-0">
                <div className="flex-1 min-w-48">
                  <div className="font-bold">{i.planet_name} · {i.level_name}</div>
                  <div className="text-xs text-[var(--ink-soft)]">
                    {i.class_setting} · {i.sessions_per_week}x/week · {i.location_name}
                    {i.batch_labels?.length > 0 && <> · {i.batch_labels.join(', ')}</>}
                  </div>
                </div>
                <select className="input max-w-44" value={i.member_id || ''} onChange={e => setMember(i.offering_id, e.target.value)}>
                  <option value="">Assign member…</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                </select>
                <div className="font-semibold text-sm w-24 text-right">{money(i.price_cents)}</div>
                <button className="btn btn-danger btn-sm" onClick={() => removeItem(i.offering_id)}><Trash2 size={13} /></button>
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-sm text-[var(--red)]">You have no member profiles yet — add one from your dashboard first.</p>
            )}
          </div>

          {quote && (
            <div className="card p-6 mt-4 animate-slideUp">
              <div className="font-bold mb-3">Price breakdown</div>
              <table className="table-base">
                <tbody>
                  {quote.lines.map((l, i) => (
                    <>
                      <tr key={i}>
                        <td>{l.planet_name} · {l.level_name} ({l.class_setting} {l.sessions_per_week}x)</td>
                        <td className="text-right">{money(l.base_cents)}</td>
                      </tr>
                      {l.discounts.map((d, j) => (
                        <tr key={i + '-' + j} className="text-[var(--green)]">
                          <td className="pl-6 text-xs">↳ {d.explanation}</td>
                          <td className="text-right text-xs">−{money(d.amount_cents)}</td>
                        </tr>
                      ))}
                    </>
                  ))}
                  {quote.setup_fees.map((f, i) => (
                    <tr key={'sf' + i}>
                      <td>One-time member setup fee</td>
                      <td className="text-right">{money(f.amount_cents)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td>Total today</td>
                    <td className="text-right">{money(quote.total_cents)}</td>
                  </tr>
                </tbody>
              </table>
              {quote.suggestions.map((s, i) => (
                <div key={i} className="text-sm text-[var(--green)] font-semibold mt-2">💡 {s.message}</div>
              ))}
            </div>
          )}

          <div className="card p-6 mt-4">
            <div className="font-bold mb-2">Payment</div>
            {cards.length > 0 ? (
              <div className="text-sm">Charging default card: <b>{cards.find(c => c.is_default)?.brand} •••• {cards.find(c => c.is_default)?.last4}</b></div>
            ) : (
              <div className="text-sm text-[var(--red)]">No card on file — add one from your dashboard (mandatory for recurring lessons).</div>
            )}
            {credit > 0 && (
              <label className="flex items-center gap-2 text-sm mt-3">
                <input type="checkbox" checked={useCredit} onChange={e => setUseCredit(e.target.checked)} />
                Apply my store credit ({money(credit)})
              </label>
            )}
            {error && <div className="mt-3 text-sm text-[var(--red)] bg-[#fbe9e5] rounded-lg p-3">{error}</div>}
            <button className="btn btn-gold w-full mt-4" disabled={!quote || busy || cards.length === 0} onClick={checkout}>
              {busy ? 'Processing…' : quote ? `Pay ${money(Math.max(0, quote.total_cents - (useCredit ? credit : 0)))} & enroll` : 'Assign members to see your price'}
            </button>
            <p className="text-xs text-[var(--ink-soft)] mt-2">
              Weekly lessons are a monthly subscription; cancellation requires 15 days notice.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
