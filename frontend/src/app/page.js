'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, money } from '@/context/AuthContext';
import { Sparkles, Trophy, CalendarDays, ArrowRight, Percent } from 'lucide-react';

export default function Home() {
  const { api } = useAuth();
  const [planets, setPlanets] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    api('GET', '/public/planets', null, null).then(setPlanets).catch(() => {});
    api('GET', '/public/discounts', null, null).then(setDiscounts).catch(() => {});
    api('GET', '/public/events', null, null).then(setEvents).catch(() => {});
  }, [api]);

  const freq = discounts.filter(d => d.rule_type === 'GROUP_FREQUENCY');
  const multi = discounts.filter(d => d.rule_type === 'MULTI_PLANET');

  return (
    <div>
      {/* Hero */}
      <section className="bg-[var(--navy)] text-white">
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div className="animate-slideUp">
            <span className="badge badge-gold mb-4">Now enrolling · Fall 2026</span>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">
              Every child a strategist.<br />
              <span className="text-[var(--gold)]">Chess, Maths & beyond.</span>
            </h1>
            <p className="mt-4 text-white/75 text-lg max-w-xl">
              Group and private classes across the Fraser Valley — five learning planets,
              CFC-rated tournaments, camps, and coaches who care. Stack subjects and
              frequencies for deep discounts.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/trial" className="btn btn-gold text-base px-6 py-3">Book a free trial</Link>
              <Link href="/courses" className="btn bg-white/10 text-white hover:bg-white/20 border-0 text-base px-6 py-3">
                Browse courses <ArrowRight size={16} />
              </Link>
            </div>
          </div>
          <div className="hidden md:flex justify-center text-[180px] leading-none select-none opacity-90">
            ♞
          </div>
        </div>
        <div className="board-strip" />
      </section>

      {/* Discounts banner */}
      <section className="max-w-7xl mx-auto px-4 -mt-8">
        <div className="card p-6 md:p-8 grid md:grid-cols-3 gap-6">
          <div className="flex gap-3">
            <Percent className="text-[var(--gold)] shrink-0" />
            <div>
              <div className="font-bold">Frequency discounts</div>
              <p className="text-sm text-[var(--ink-soft)]">
                {freq.map(f => `${f.threshold_count}x weekly: ${f.percent}% off`).join(' · ') || 'Attend twice or thrice weekly and save.'}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Sparkles className="text-[var(--gold)] shrink-0" />
            <div>
              <div className="font-bold">Multi-planet discounts</div>
              <p className="text-sm text-[var(--ink-soft)]">
                {multi.map(m => `${m.threshold_count} subjects: ${m.percent}%`).join(' · ') || 'Combine subjects for deeper discounts.'}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Trophy className="text-[var(--gold)] shrink-0" />
            <div>
              <div className="font-bold">Loyalty rewards</div>
              <p className="text-sm text-[var(--ink-soft)]">Welcome bonus on signup, points on every dollar, redeemable as store credit.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Planets */}
      <section className="max-w-7xl mx-auto px-4 mt-16">
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Explore our learning planets</h2>
        <p className="text-[var(--ink-soft)] mt-1">Each planet has levels matched to age and skill — pick one, or stack several and save.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
          {planets.map(p => (
            <Link key={p.id} href="/courses" className="card p-5 hover:border-[var(--gold)] hover:-translate-y-1 transition-all">
              <div className="text-3xl">{p.icon}</div>
              <div className="font-bold mt-3">{p.name}</div>
              <p className="text-xs text-[var(--ink-soft)] mt-1 line-clamp-3">{p.description}</p>
              <div className="text-xs text-[var(--gold)] font-semibold mt-3">{p.levels.length} levels →</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Events */}
      <section className="max-w-7xl mx-auto px-4 mt-16 mb-8">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Tournaments & camps</h2>
            <p className="text-[var(--ink-soft)] mt-1">Early-bird pricing switches automatically — register early and save.</p>
          </div>
          <Link href="/events" className="btn btn-ghost btn-sm">All events</Link>
        </div>
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          {events.slice(0, 4).map(e => (
            <Link key={e.id} href={`/events/${e.id}`} className="card p-5 flex gap-4 hover:border-[var(--gold)] transition-all">
              <div className="w-14 h-14 rounded-xl bg-[var(--navy)] text-white flex items-center justify-center text-2xl shrink-0">
                {e.event_type === 'TOURNAMENT' ? '♜' : '☀'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="badge badge-navy">{e.event_type}</span>
                  {e.current_phase && <span className="badge badge-gold">{e.current_phase.phase_type.replace('_', ' ')} · {money(e.current_phase.price_cents)}</span>}
                </div>
                <div className="font-bold mt-1 truncate">{e.name}</div>
                <div className="text-sm text-[var(--ink-soft)] flex items-center gap-1 mt-1">
                  <CalendarDays size={14} /> {e.start_date} · {e.location_name || 'TBA'} · {e.registration_count} registered
                </div>
              </div>
            </Link>
          ))}
          {events.length === 0 && <div className="text-sm text-[var(--ink-soft)]">No upcoming events yet — check back soon.</div>}
        </div>
      </section>
    </div>
  );
}
