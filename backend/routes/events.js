const express = require('express');
const db = require('../db');
const { uid } = require('../db');
const { authenticate, requireRole, ADMIN_ROLES, scopeOwnership } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('EVENT_MANAGER', ...ADMIN_ROLES));

// Canned templates for fast event creation
const TEMPLATES = {
  rapid_tournament: {
    event_type: 'TOURNAMENT', rounds: 5, max_byes: 2, play_up_allowed: 1,
    play_up_fee_cents: 1500, cfc_id_fee_cents: 2000,
    sections: [{ name: 'U1000', max_rating: 999 }, { name: 'U1500', min_rating: 1000, max_rating: 1499 }, { name: 'Open' }],
    phases: [{ phase_type: 'EARLY_BIRD', price_cents: 4500 }, { phase_type: 'STANDARD', price_cents: 6000 }, { phase_type: 'RUSH', price_cents: 7500 }],
  },
  day_camp: {
    event_type: 'CAMP',
    phases: [{ phase_type: 'EARLY_BIRD', price_cents: 24900 }, { phase_type: 'STANDARD', price_cents: 29900 }],
    sections: [],
  },
};

router.get('/templates', (_req, res) => res.json(Object.keys(TEMPLATES)));

router.get('/', (req, res) => {
  const own = scopeOwnership(req.user);
  const sql = `SELECT e.*, l.name AS location_name,
               (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id) AS registration_count
               FROM events e LEFT JOIN locations l ON l.id = e.location_id` +
              (own ? ' WHERE e.ownership_id = ?' : '') + ' ORDER BY e.start_date DESC';
  res.json(own ? db.prepare(sql).all(own) : db.prepare(sql).all());
});

router.post('/', (req, res) => {
  const b = req.body;
  const tpl = b.template_key ? TEMPLATES[b.template_key] : null;
  const cfg = { ...(tpl || {}), ...b };
  if (!cfg.name || !cfg.start_date || !cfg.end_date) return res.status(400).json({ error: 'name, start_date and end_date are required' });
  const own = scopeOwnership(req.user) || req.user.ownership_id;
  const id = uid();
  db.transaction(() => {
    db.prepare(`INSERT INTO events (id,ownership_id,location_id,event_type,name,description,start_date,end_date,rounds,max_byes,fide_required,play_up_allowed,play_up_fee_cents,cfc_id_fee_cents,prize_text,public_list_enabled,status)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, own, cfg.location_id || null, cfg.event_type || 'OTHER', cfg.name, cfg.description || null,
           cfg.start_date, cfg.end_date, cfg.rounds || null, cfg.max_byes ?? null,
           cfg.fide_required ? 1 : 0, cfg.play_up_allowed ? 1 : 0,
           cfg.play_up_fee_cents ?? null, cfg.cfc_id_fee_cents ?? null,
           cfg.prize_text || null, cfg.public_list_enabled === false ? 0 : 1, cfg.status || 'PLANNED');
    for (const s of cfg.sections || []) {
      db.prepare('INSERT INTO event_sections (id,event_id,name,min_rating,max_rating,prize_text) VALUES (?,?,?,?,?,?)')
        .run(uid(), id, s.name, s.min_rating ?? null, s.max_rating ?? null, s.prize_text || null);
    }
    for (const ph of cfg.phases || []) {
      // Registration deadlines take effect automatically once the date passes
      db.prepare('INSERT INTO event_price_phases (id,event_id,phase_type,starts_on,ends_on,price_cents) VALUES (?,?,?,?,?,?)')
        .run(uid(), id, ph.phase_type, ph.starts_on || cfg.start_date, ph.ends_on || cfg.end_date, ph.price_cents);
    }
  })();
  res.status(201).json({ id });
});

router.put('/:id', (req, res) => {
  const e = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Event not found' });
  const b = req.body;
  db.prepare(`UPDATE events SET name=COALESCE(?,name), description=COALESCE(?,description),
              status=COALESCE(?,status), rounds=COALESCE(?,rounds), max_byes=COALESCE(?,max_byes),
              play_up_fee_cents=COALESCE(?,play_up_fee_cents), cfc_id_fee_cents=COALESCE(?,cfc_id_fee_cents),
              prize_text=COALESCE(?,prize_text), public_list_enabled=COALESCE(?,public_list_enabled) WHERE id = ?`)
    .run(b.name, b.description, b.status, b.rounds, b.max_byes, b.play_up_fee_cents, b.cfc_id_fee_cents,
         b.prize_text, b.public_list_enabled == null ? null : (b.public_list_enabled ? 1 : 0), e.id);
  res.json({ success: true });
});

router.put('/:id/phases', (req, res) => {
  const e = db.prepare('SELECT id FROM events WHERE id = ?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Event not found' });
  for (const ph of req.body.phases || []) {
    db.prepare(`INSERT INTO event_price_phases (id,event_id,phase_type,starts_on,ends_on,price_cents) VALUES (?,?,?,?,?,?)
                ON CONFLICT(event_id,phase_type) DO UPDATE SET starts_on=excluded.starts_on, ends_on=excluded.ends_on, price_cents=excluded.price_cents`)
      .run(uid(), e.id, ph.phase_type, ph.starts_on, ph.ends_on, ph.price_cents);
  }
  res.json({ success: true });
});

// Event manager report: PlayerName, Buyer, email, phone, parking pass, CFC/FIDE,
// section, byes, play-up. Filters: missing CFC ID, byes requested, section, play-up.
router.get('/:id/report', (req, res) => {
  const { missing_cfc, has_byes, section, play_up } = req.query;
  let rows = db.prepare(`
    SELECT r.id AS registration_id,
           m.first_name || ' ' || m.last_name AS player_name,
           c.full_name AS buyer_name, u.email, c.phone,
           r.car_plate AS parking_pass, m.cfc_id, m.fide_id,
           s.name AS section, r.bye_rounds, r.play_up, r.phase_type, r.price_paid_cents,
           r.tshirt_size, r.interac_email, m.id AS member_id
    FROM event_registrations r
    JOIN members m ON m.id = r.member_id
    JOIN customers c ON c.id = r.customer_id
    JOIN users u ON u.id = c.user_id
    LEFT JOIN event_sections s ON s.id = r.section_id
    WHERE r.event_id = ? ORDER BY s.name, player_name`).all(req.params.id);

  if (missing_cfc === '1') rows = rows.filter(r => !r.cfc_id);
  if (has_byes === '1') rows = rows.filter(r => r.bye_rounds && JSON.parse(r.bye_rounds).length > 0);
  if (section) rows = rows.filter(r => r.section === section);
  if (play_up === '1') rows = rows.filter(r => r.play_up === 1);
  res.json(rows);
});

// Once a CFC ID is received, admins / event managers update it on the profile
router.put('/registrations/:id/cfc', (req, res) => {
  const r = db.prepare('SELECT * FROM event_registrations WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Registration not found' });
  const { cfc_id } = req.body;
  if (!cfc_id) return res.status(400).json({ error: 'cfc_id is required' });
  db.prepare('UPDATE members SET cfc_id = ? WHERE id = ?').run(cfc_id, r.member_id);
  res.json({ success: true });
});

module.exports = router;
