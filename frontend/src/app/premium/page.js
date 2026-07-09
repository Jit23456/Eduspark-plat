'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, rupees } from '@/context/AuthContext';
import { Crown, Check, Sparkles, ShieldCheck, Zap, Video, ClipboardCheck, TrendingUp } from 'lucide-react';

const PERKS = [
  'Every course unlocked — all 8 subjects, Classes 1 to 10',
  'One-minute AI teacher video for every course',
  'All lessons with full study notes',
  'Every chapter exam with instant grading & answer review',
  'Live progress tracking across subjects',
  'BC curriculum reference links for every grade',
];

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function PremiumPage() {
  const { api, user, loading, isPremium, refreshUser } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null); // {type, text}

  useEffect(() => {
    api('GET', '/payments/plans', null, null).then(setPlans).catch(() => {});
  }, [api]);

  const buy = async (planId) => {
    if (!user) { router.push('/login'); return; }
    setBusy(planId); setMessage(null);
    try {
      const order = await api('POST', '/payments/create-order', { plan: planId });

      if (order.mock) {
        // Demo checkout: no gateway keys configured — simulate the payment.
        setMessage({ type: 'info', text: 'Demo checkout — processing payment…' });
        await new Promise(r => setTimeout(r, 1200));
        const v = await api('POST', '/payments/verify', {
          order_id: order.order_id, payment_id: 'pay_demo_' + Date.now(), signature: 'demo',
        });
        await refreshUser();
        setMessage({ type: 'success', text: v.message });
      } else {
        const ok = await loadRazorpayScript();
        if (!ok) throw new Error('Could not load Razorpay. Check your connection.');
        await new Promise((resolve, reject) => {
          const rzp = new window.Razorpay({
            key: order.key_id,
            amount: order.amount_paise,
            currency: order.currency,
            name: 'Eduspark Premium',
            description: planId === 'YEARLY' ? 'Yearly plan' : 'Monthly plan',
            order_id: order.order_id,
            prefill: order.prefill,
            theme: { color: '#7c5cff' },
            handler: async (resp) => {
              try {
                const v = await api('POST', '/payments/verify', {
                  order_id: resp.razorpay_order_id,
                  payment_id: resp.razorpay_payment_id,
                  signature: resp.razorpay_signature,
                });
                await refreshUser();
                setMessage({ type: 'success', text: v.message });
                resolve();
              } catch (e) { reject(e); }
            },
            modal: { ondismiss: () => resolve() },
          });
          rzp.on('payment.failed', (r) => reject(new Error(r.error?.description || 'Payment failed')));
          rzp.open();
        });
      }
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="text-center mb-10 animate-fadeUp">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-[#f59e0b] to-[#fbbf24] items-center justify-center mb-5 animate-glow">
          <Crown className="text-[#1a1206]" size={30} />
        </div>
        <h1 className="text-4xl font-black">Eduspark <span className="grad-text">Premium</span></h1>
        <p className="text-[var(--ink-soft)] mt-3 max-w-xl mx-auto">
          One plan. Everything unlocked — every subject, every class, every lesson, every exam.
        </p>
      </div>

      {message && (
        <div className={`glass p-4 mb-8 text-center text-sm font-bold animate-pop ${
          message.type === 'success' ? 'text-[var(--green)] border-[rgba(52,211,153,0.4)]' :
          message.type === 'error' ? 'text-[var(--red)] border-[rgba(251,113,133,0.4)]' : 'text-[var(--cyan)]'}`}>
          {message.text}
          {message.type === 'success' && (
            <div className="mt-3"><Link href="/dashboard" className="btn btn-primary btn-sm">Go to my dashboard</Link></div>
          )}
        </div>
      )}

      {isPremium && !message && (
        <div className="glass p-6 mb-8 text-center border-[rgba(251,191,36,0.4)] animate-pop">
          <div className="font-extrabold text-[var(--gold)] flex items-center justify-center gap-2"><Crown size={18} /> You are a Premium member</div>
          <p className="text-sm text-[var(--ink-soft)] mt-1">
            Valid till {user?.premium_expires_at ? new Date(user.premium_expires_at).toLocaleDateString() : '—'} · Buying again extends your plan.
          </p>
        </div>
      )}

      {/* Plans */}
      <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
        {(plans?.plans || []).map((p, i) => {
          const yearly = p.id === 'YEARLY';
          return (
            <div key={p.id} className={`glass glass-hover p-7 relative overflow-hidden animate-fadeUp d${i + 1} ${yearly ? 'border-[rgba(251,191,36,0.45)]' : ''}`}>
              {yearly && (
                <div className="absolute top-4 -right-9 rotate-45 bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] text-[#1a1206] text-[10px] font-black tracking-wider px-10 py-1">
                  BEST VALUE
                </div>
              )}
              <div className="font-extrabold text-lg flex items-center gap-2">
                {yearly ? <Crown size={18} className="text-[var(--gold)]" /> : <Zap size={18} className="text-[var(--cyan)]" />}
                {p.label}
              </div>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-black">{rupees(p.amount_paise)}</span>
                <span className="text-sm text-[var(--ink-soft)] font-bold mb-1.5">/ {yearly ? 'year' : 'month'}</span>
              </div>
              <p className="text-xs text-[var(--ink-soft)] mt-1">{p.tagline}</p>
              <button onClick={() => buy(p.id)} disabled={!!busy}
                className={`btn w-full mt-6 ${yearly ? 'btn-gold' : 'btn-primary'}`}>
                {busy === p.id ? 'Processing…' : <><Sparkles size={15} /> Get {yearly ? 'Yearly' : 'Monthly'}</>}
              </button>
            </div>
          );
        })}
      </div>

      {plans?.mock && (
        <p className="text-center text-xs text-[var(--ink-soft)] mt-4 max-w-lg mx-auto">{plans.note}</p>
      )}

      {/* Perks */}
      <div className="glass p-7 max-w-3xl mx-auto mt-8 animate-fadeUp d3">
        <div className="font-extrabold mb-4 flex items-center gap-2"><ShieldCheck size={17} className="text-[var(--green)]" /> Everything you get</div>
        <div className="grid sm:grid-cols-2 gap-3">
          {PERKS.map(perk => (
            <div key={perk} className="flex items-start gap-2.5 text-sm text-[var(--ink-soft)]">
              <Check size={16} className="text-[var(--green)] mt-0.5 shrink-0" /> {perk}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6 mt-6 pt-5 border-t border-[var(--line)] text-xs font-bold text-[var(--ink-soft)]">
          <span className="flex items-center gap-1.5"><Video size={14} className="text-[var(--pink)]" /> AI teacher videos</span>
          <span className="flex items-center gap-1.5"><ClipboardCheck size={14} className="text-[var(--violet)]" /> Auto-graded exams</span>
          <span className="flex items-center gap-1.5"><TrendingUp size={14} className="text-[var(--cyan)]" /> Progress tracking</span>
          <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-[var(--green)]" /> Razorpay secured</span>
        </div>
      </div>
    </div>
  );
}
