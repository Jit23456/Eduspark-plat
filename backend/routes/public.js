const express = require('express');
const db = require('../db');
const { uid } = require('../db');
const { maybeAuthenticate } = require('../middleware/auth');

const router = express.Router();

const BATCH_SEATS_SQL = `
  SELECT b.*,
         b.capacity - (
           SELECT COUNT(*) FROM enrollment_slots es
           JOIN enrollments e ON e.id = es.enrollment_id
           WHERE es.batch_id = b.id AND e.status IN ('ACTIVE','NOTICE_GIVEN')
         ) AS seats_left
  FROM batches b`;

router.get('/locations', (_req, res) => {
  res.json(db.prepare(`
    SELECT l.*, o.name AS ownership_name, o.type AS ownership_type
    FROM locations l JOIN ownerships o ON o.id = l.ownership_id
    WHERE l.active = 1 ORDER BY l.name`).all());
});

router.get('/planets', (_req, res) => {
  const planets = db.prepare('SELECT * FROM planets WHERE active = 1').all();
  const levels = db.prepare('SELECT * FROM levels ORDER BY level_order').all();
  res.json(planets.map(p => ({ ...p, levels: levels.filter(l => l.planet_id === p.id) })));
});

// Marketing copy for the deep-discount messaging on the catalog page
router.get('/discounts', (_req, res) => {
  res.json(db.prepare('SELECT rule_type, threshold_count, percent FROM discount_tiers ORDER BY rule_type, threshold_count').all());
});

// Full catalog for a location: planet -> level -> variants with effective price
router.get('/catalog', (req, res) => {
  const { location_id } = req.query;
  if (!location_id) return res.status(400).json({ error: 'location_id is required' });
  const rows = db.prepare(`
    SELECT o.id AS offering_id, o.local_price_cents,
           v.id AS variant_id, v.class_setting, v.sessions_per_week, v.list_price_cents, v.currency,
           c.id AS course_id, c.image_url, c.session_minutes,
           l.id AS level_id, l.name AS level_name, l.level_order, l.overview,
           p.id AS planet_id, p.name AS planet_name, p.icon AS planet_icon, p.description AS planet_description
    FROM offerings o
    JOIN course_variants v ON v.id = o.variant_id
    JOIN courses c ON c.id = v.course_id AND c.active = 1
    JOIN levels l ON l.id = c.level_id
    JOIN planets p ON p.id = l.planet_id AND p.active = 1
    WHERE o.location_id = ? AND o.active = 1
    ORDER BY p.name, l.level_order, v.class_setting, v.sessions_per_week`).all(location_id);

  const planets = {};
  for (const r of rows) {
    planets[r.planet_id] ||= { planet_id: r.planet_id, name: r.planet_name, icon: r.planet_icon, description: r.planet_description, levels: {} };
    const lv = planets[r.planet_id].levels;
    lv[r.level_id] ||= { level_id: r.level_id, name: r.level_name, overview: r.overview, session_minutes: r.session_minutes, image_url: r.image_url, variants: [] };
    lv[r.level_id].variants.push({
      offering_id: r.offering_id, variant_id: r.variant_id,
      class_setting: r.class_setting, sessions_per_week: r.sessions_per_week,
      price_cents: r.local_price_cents != null ? r.local_price_cents : r.list_price_cents,
      currency: r.currency,
    });
  }
  res.json(Object.values(planets).map(p => ({ ...p, levels: Object.values(p.levels) })));
});

// Weekly schedule slots for an offering, with live remaining-seat counts
router.get('/batches', (req, res) => {
  const { offering_id, location_id } = req.query;
  let rows;
  if (offering_id) {
    rows = db.prepare(`${BATCH_SEATS_SQL} WHERE b.offering_id = ? AND b.active = 1`).all(offering_id);
  } else if (location_id) {
    rows = db.prepare(`${BATCH_SEATS_SQL} JOIN offerings o ON o.id = b.offering_id WHERE o.location_id = ? AND b.active = 1`).all(location_id);
  } else {
    return res.status(400).json({ error: 'offering_id or location_id required' });
  }
  res.json(rows);
});

// ------------------------------- Events ------------------------------------
function currentPhase(eventId, onDate) {
  const d = onDate || new Date().toISOString().slice(0, 10);
  return db.prepare(`SELECT * FROM event_price_phases WHERE event_id = ? AND starts_on <= ? AND ends_on >= ?
                     ORDER BY price_cents ASC LIMIT 1`).get(eventId, d, d) || null;
}

router.get('/events', (_req, res) => {
  const events = db.prepare(`
    SELECT e.*, l.name AS location_name, l.city
    FROM events e LEFT JOIN locations l ON l.id = e.location_id
    WHERE e.status IN ('LIVE','PLANNED') ORDER BY e.start_date`).all();
  res.json(events.map(e => {
    const phase = currentPhase(e.id);
    const phases = db.prepare('SELECT * FROM event_price_phases WHERE event_id = ? ORDER BY starts_on').all(e.id);
    const count = db.prepare('SELECT COUNT(*) AS c FROM event_registrations WHERE event_id = ?').get(e.id).c;
    return { ...e, current_phase: phase, phases, registration_count: count };
  }));
});

router.get('/events/:id', (req, res) => {
  const e = db.prepare(`SELECT e.*, l.name AS location_name, l.city, l.address1
                        FROM events e LEFT JOIN locations l ON l.id = e.location_id WHERE e.id = ?`).get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Event not found' });
  const sections = db.prepare('SELECT * FROM event_sections WHERE event_id = ?').all(e.id);
  const phases = db.prepare('SELECT * FROM event_price_phases WHERE event_id = ? ORDER BY starts_on').all(e.id);

  // Public registration list (custom-column display, sorted by section)
  let registrations = [];
  if (e.public_list_enabled) {
    registrations = db.prepare(`
      SELECT m.first_name || ' ' || m.last_name AS player_name,
             s.name AS section, r.bye_rounds, r.play_up,
             CASE WHEN m.cfc_id IS NULL OR m.cfc_id = '' THEN 'Pending' ELSE m.cfc_id END AS cfc_id
      FROM event_registrations r
      JOIN members m ON m.id = r.member_id
      LEFT JOIN event_sections s ON s.id = r.section_id
      WHERE r.event_id = ? ORDER BY s.name, player_name`).all(e.id);
  }
  res.json({ ...e, sections, phases, current_phase: currentPhase(e.id), registrations });
});

// ------------------------------- Trials ------------------------------------
// New customers can book a free trial as a guest; existing customers attach a member.
router.post('/trials', maybeAuthenticate, (req, res) => {
  const { batch_id, trial_date, member_id, guest_name, guest_email, guest_phone } = req.body;
  const batch = db.prepare(`SELECT b.*, o.location_id, o.ownership_id AS own FROM batches b JOIN offerings o ON o.id = b.offering_id WHERE b.id = ?`).get(batch_id);
  if (!batch) return res.status(400).json({ error: 'Unknown schedule slot' });
  if (!trial_date) return res.status(400).json({ error: 'trial_date is required' });
  if (!member_id && (!guest_name || !guest_email || !guest_phone)) {
    return res.status(400).json({ error: 'Name, email and phone are required to book a trial' });
  }
  const seats = db.prepare(`
    SELECT b.capacity - (
      SELECT COUNT(*) FROM enrollment_slots es JOIN enrollments e ON e.id = es.enrollment_id
      WHERE es.batch_id = b.id AND e.status IN ('ACTIVE','NOTICE_GIVEN')
    ) - (SELECT COUNT(*) FROM trials t WHERE t.batch_id = b.id AND t.trial_date = ? AND t.status = 'BOOKED') AS left
    FROM batches b WHERE b.id = ?`).get(trial_date, batch_id).left;
  if (seats <= 0) {
    db.prepare(`INSERT INTO registration_attempts (id,ownership_id,location_id,batch_id,reason) VALUES (?,?,?,?,'FULL')`)
      .run(uid(), batch.own, batch.location_id, batch_id);
    return res.status(409).json({ error: 'This batch is full — please pick another slot' });
  }
  const id = uid();
  db.prepare(`INSERT INTO trials (id,ownership_id,batch_id,trial_date,member_id,guest_name,guest_email,guest_phone)
              VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, batch.own, batch_id, trial_date, member_id || null, guest_name || null, guest_email || null, guest_phone || null);
  res.status(201).json({ id, message: 'Free trial booked! See you in class.' });
});

module.exports = router;
module.exports.currentPhase = currentPhase;
