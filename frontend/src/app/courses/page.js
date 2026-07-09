'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, money, DAYS } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { Users, Clock, Check } from 'lucide-react';

export default function CoursesPage() {
  const { api } = useAuth();
  const { items, addItem } = useCart();
  const router = useRouter();

  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [planetId, setPlanetId] = useState('');
  const [levelId, setLevelId] = useState('');
  const [variant, setVariant] = useState(null);   // selected offering variant
  const [batches, setBatches] = useState([]);
  const [pickedBatches, setPickedBatches] = useState([]);

  useEffect(() => {
    api('GET', '/public/locations', null, null).then(ls => {
      setLocations(ls);
      if (ls.length && !locationId) setLocationId(ls[0].id);
    }).catch(() => {});
    api('GET', '/public/discounts', null, null).then(setDiscounts).catch(() => {});
  }, [api]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!locationId) return;
    setPlanetId(''); setLevelId(''); setVariant(null); setPickedBatches([]);
    api('GET', `/public/catalog?location_id=${locationId}`, null, null).then(setCatalog).catch(() => {});
  }, [api, locationId]);

  useEffect(() => {
    if (!variant) { setBatches([]); setPickedBatches([]); return; }
    setPickedBatches([]);
    api('GET', `/public/batches?offering_id=${variant.offering_id}`, null, null).then(setBatches).catch(() => {});
  }, [api, variant]);

  const planet = catalog.find(p => p.planet_id === planetId);
  const level = planet?.levels.find(l => l.level_id === levelId);

  const multiTiers = discounts.filter(d => d.rule_type === 'MULTI_PLANET');
  const cartPlanets = useMemo(() => new Set(items.filter(i => i.class_setting === 'GROUP').map(i => i.planet_name)), [items]);
  const nextTier = multiTiers.find(t => t.threshold_count === cartPlanets.size + 1);

  const needed = variant?.class_setting === 'GROUP' ? variant.sessions_per_week : 1;
  const canAdd = variant && pickedBatches.length === (variant.class_setting === 'GROUP' ? needed : Math.min(needed, batches.length || 0));

  const addToCart = () => {
    addItem({
      offering_id: variant.offering_id,
      batch_ids: pickedBatches,
      planet_name: planet.name, level_name: level.name,
      class_setting: variant.class_setting, sessions_per_week: variant.sessions_per_week,
      price_cents: variant.price_cents,
      location_name: locations.find(l => l.id === locationId)?.name,
      batch_labels: batches.filter(b => pickedBatches.includes(b.id)).map(b => `${DAYS[b.day_of_week]} ${b.start_time}`),
    });
    setVariant(null); setPickedBatches([]);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">Browse courses</h1>
      <p className="text-[var(--ink-soft)] mt-1">
        Step 1 pick a location · Step 2 pick a planet & level · Step 3 pick frequency and weekly schedule.
      </p>

      {/* Deep-discount marketing strip */}
      <div className="card mt-4 p-4 text-sm flex flex-wrap gap-x-6 gap-y-1">
        <span className="font-bold text-[var(--gold)]">💡 Deep discounts:</span>
        {discounts.filter(d => d.rule_type === 'GROUP_FREQUENCY').map(d => (
          <span key={'f' + d.threshold_count}>{d.threshold_count}x weekly → <b>{d.percent}% off</b></span>
        ))}
        {multiTiers.map(d => (
          <span key={'m' + d.threshold_count}>{d.threshold_count} planets → <b>{d.percent}% off</b></span>
        ))}
      </div>

      {/* Step 1: location */}
      <div className="mt-6">
        <label className="label">Location</label>
        <div className="flex flex-wrap gap-2">
          {locations.map(l => (
            <button key={l.id} onClick={() => setLocationId(l.id)}
              className={`btn ${locationId === l.id ? 'btn-primary' : 'btn-ghost'}`}>
              {l.name} <span className="text-xs opacity-70">({l.city})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: planet */}
      <div className="mt-6">
        <label className="label">Planet</label>
        <div className="flex flex-wrap gap-2">
          {catalog.map(p => (
            <button key={p.planet_id} onClick={() => { setPlanetId(p.planet_id); setLevelId(''); setVariant(null); }}
              className={`btn ${planetId === p.planet_id ? 'btn-primary' : 'btn-ghost'}`}>
              <span>{p.icon}</span> {p.name}
              {cartPlanets.has(p.name) && <Check size={14} className="text-[var(--gold)]" />}
            </button>
          ))}
        </div>
        {nextTier && cartPlanets.size > 0 && (
          <div className="mt-2 text-sm text-[var(--green)] font-semibold">
            You may like: add a {cartPlanets.size + 1}
            {['st', 'nd', 'rd'][cartPlanets.size] || 'th'} planet to unlock {nextTier.percent}% off all group classes!
          </div>
        )}
      </div>

      {/* Levels */}
      {planet && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {planet.levels.map(l => (
            <div key={l.level_id}
              className={`card p-5 cursor-pointer transition-all ${levelId === l.level_id ? 'border-[var(--gold)] ring-2 ring-[var(--gold-soft)]' : 'hover:border-[var(--gold)]'}`}
              onClick={() => { setLevelId(l.level_id); setVariant(null); }}>
              <div className="flex items-center justify-between">
                <div className="font-bold">{l.name}</div>
                <span className="badge"><Clock size={11} /> {l.session_minutes} min</span>
              </div>
              <p className="text-sm text-[var(--ink-soft)] mt-2">{l.overview}</p>
              <div className="text-sm mt-3 font-semibold text-[var(--navy)]">
                From {money(Math.min(...l.variants.map(v => v.price_cents)))} / month
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Step 3: variant (setting + frequency) */}
      {level && (
        <div className="card p-6 mt-6 animate-slideUp">
          <h3 className="font-extrabold text-lg">{planet.name} · {level.name} — choose class setting & frequency</h3>
          <div className="grid sm:grid-cols-2 gap-6 mt-4">
            {['GROUP', 'PRIVATE'].map(setting => (
              <div key={setting}>
                <div className="label">{setting === 'GROUP' ? 'Group classes' : 'Private 1-on-1'}</div>
                <div className="space-y-2">
                  {level.variants.filter(v => v.class_setting === setting).map(v => (
                    <button key={v.variant_id} onClick={() => setVariant(v)}
                      className={`w-full flex items-center justify-between rounded-xl border p-3 text-sm transition
                        ${variant?.variant_id === v.variant_id ? 'border-[var(--gold)] bg-[var(--gold-soft)]' : 'border-[var(--line)] hover:border-[var(--gold)]'}`}>
                      <span className="font-semibold">{v.sessions_per_week}x per week</span>
                      <span>{money(v.price_cents)} / mo <span className="text-xs text-[var(--ink-soft)]">before discounts</span></span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--ink-soft)] mt-3">
            Group and private discounts cannot be combined. Private classes get their own multi-session discount.
          </p>

          {/* Schedule slots */}
          {variant && (
            <div className="mt-5">
              <div className="label">
                {variant.class_setting === 'GROUP'
                  ? `Pick ${needed} weekly slot${needed > 1 ? 's' : ''} (seats remaining shown)`
                  : 'Private schedule is arranged with your coach after checkout'}
              </div>
              {variant.class_setting === 'GROUP' && (
                <div className="flex flex-wrap gap-2">
                  {batches.map(b => (
                    <button key={b.id}
                      onClick={() => setPickedBatches(p => p.includes(b.id) ? p.filter(x => x !== b.id) : (p.length < needed ? [...p, b.id] : p))}
                      disabled={b.seats_left <= 0 && !pickedBatches.includes(b.id)}
                      className={`btn btn-sm ${pickedBatches.includes(b.id) ? 'btn-gold' : 'btn-ghost'} ${b.seats_left <= 0 ? 'opacity-40' : ''}`}>
                      {DAYS[b.day_of_week]} {b.start_time}
                      <span className="badge ml-1"><Users size={10} /> {Math.max(0, b.seats_left)} left</span>
                    </button>
                  ))}
                  {batches.length === 0 && <span className="text-sm text-[var(--ink-soft)]">No schedule published yet for this variant.</span>}
                </div>
              )}
              <button className="btn btn-primary mt-4"
                disabled={variant.class_setting === 'GROUP' ? pickedBatches.length !== needed : false}
                onClick={addToCart}>
                Add to cart
              </button>
            </div>
          )}
        </div>
      )}

      {/* Cart summary */}
      {items.length > 0 && (
        <div className="fixed bottom-4 right-4 card p-4 shadow-xl w-80 z-30">
          <div className="font-bold text-sm">Cart — {items.length} course{items.length > 1 ? 's' : ''}</div>
          <ul className="text-xs text-[var(--ink-soft)] mt-1 space-y-0.5">
            {items.map(i => <li key={i.offering_id}>• {i.planet_name} {i.level_name} ({i.class_setting} {i.sessions_per_week}x)</li>)}
          </ul>
          {nextTier && <div className="text-xs text-[var(--green)] font-semibold mt-2">Add 1 more planet → {nextTier.percent}% off!</div>}
          <button className="btn btn-gold w-full mt-3" onClick={() => router.push('/checkout')}>Review & checkout</button>
        </div>
      )}
    </div>
  );
}
