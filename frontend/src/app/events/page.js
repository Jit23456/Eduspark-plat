'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth, money } from '@/context/AuthContext';
import { CalendarDays, MapPin, Users } from 'lucide-react';

export default function EventsPage() {
  const { api } = useAuth();
  const [events, setEvents] = useState([]);

  useEffect(() => { api('GET', '/public/events', null, null).then(setEvents).catch(() => {}); }, [api]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Events & tournaments</h1>
      <p className="text-[var(--ink-soft)] mt-1">Early Bird → Standard → Rush pricing switches automatically as deadlines pass.</p>

      <div className="grid md:grid-cols-2 gap-4 mt-8">
        {events.map(e => (
          <Link key={e.id} href={`/events/${e.id}`} className="card p-6 hover:border-[var(--gold)] transition-all">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="badge badge-navy">{e.event_type}</span>
              <span className={`badge ${e.status === 'LIVE' ? 'badge-green' : ''}`}>{e.status}</span>
              {e.current_phase && (
                <span className="badge badge-gold">{e.current_phase.phase_type.replace('_', ' ')} — {money(e.current_phase.price_cents)}</span>
              )}
            </div>
            <h2 className="font-extrabold text-lg mt-2">{e.name}</h2>
            <p className="text-sm text-[var(--ink-soft)] mt-1 line-clamp-2">{e.description}</p>
            <div className="flex flex-wrap gap-4 text-sm text-[var(--ink-soft)] mt-3">
              <span className="flex items-center gap-1"><CalendarDays size={14} /> {e.start_date} → {e.end_date}</span>
              <span className="flex items-center gap-1"><MapPin size={14} /> {e.location_name || 'TBA'}</span>
              <span className="flex items-center gap-1"><Users size={14} /> {e.registration_count} registered</span>
            </div>
            {e.phases?.length > 0 && (
              <div className="flex gap-2 mt-3 text-xs">
                {e.phases.map(p => (
                  <span key={p.id} className={`px-2 py-1 rounded-lg border ${e.current_phase?.id === p.id ? 'border-[var(--gold)] bg-[var(--gold-soft)] font-bold' : 'border-[var(--line)] text-[var(--ink-soft)]'}`}>
                    {p.phase_type.replace('_', ' ')} {money(p.price_cents)}<br />
                    <span className="opacity-70">until {p.ends_on}</span>
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
        {events.length === 0 && <div className="text-[var(--ink-soft)]">No events published yet.</div>}
      </div>
    </div>
  );
}
