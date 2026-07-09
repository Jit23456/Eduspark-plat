const express = require('express');
const db = require('../db');
const { uid, hashPassword } = require('../db');
const {
  authenticate, requireAdmin, requireFranchisor, requireManagement,
  isFranchisor, scopeOwnership,
} = require('../middleware/auth');
const { quoteCart } = require('../services/pricing');
const { settleInvoice, notify, sendEmail } = require('../services/billing');

const router = express.Router();
router.use(authenticate, requireAdmin);

const scoped = (req, sql, params = []) => {
  const own = scopeOwnership(req.user);
  return own ? db.prepare(sql + ' WHERE ownership_id = ?').all(...params, own)
             : db.prepare(sql).all(...params);
};

// ------------------------- Catalog (franchisor) -----------------------------
router.post('/planets', requireFranchisor, (req, res) => {
  const { name, description, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const id = uid();
  db.prepare('INSERT INTO planets (id,name,description,icon) VALUES (?,?,?,?)').run(id, name, description || null, icon || null);
  res.status(201).json({ id });
});

router.post('/levels', requireFranchisor, (req, res) => {
  const { planet_id, name, level_order, overview } = req.body;
  if (!planet_id || !name) return res.status(400).json({ error: 'planet_id and name are required' });
  const id = uid();
  db.prepare('INSERT INTO levels (id,planet_id,name,level_order,overview) VALUES (?,?,?,?,?)')
    .run(id, planet_id, name, level_order || 1, overview || null);
  res.status(201).json({ id });
});

// Course at a level with image + variants (frequency x setting pricing)
router.post('/courses', requireFranchisor, (req, res) => {
  const { level_id, image_url, session_minutes, variants = [] } = req.body;
  if (!level_id || !session_minutes) return res.status(400).json({ error: 'level_id and session_minutes are required' });
  const id = uid();
  db.transaction(() => {
    db.prepare('INSERT INTO courses (id,level_id,image_url,session_minutes) VALUES (?,?,?,?)').run(id, level_id, image_url || null, session_minutes);
    for (const v of variants) {
      db.prepare('INSERT INTO course_variants (id,course_id,class_setting,sessions_per_week,list_price_cents) VALUES (?,?,?,?,?)')
        .run(uid(), id, v.class_setting, v.sessions_per_week || 1, v.list_price_cents);
    }
  })();
  res.status(201).json({ id });
});

router.get('/variants', (_req, res) => {
  res.json(db.prepare(`
    SELECT v.*, l.name AS level_name, p.name AS planet_name
    FROM course_variants v
    JOIN courses c ON c.id = v.course_id
    JOIN levels l ON l.id = c.level_id
    JOIN planets p ON p.id = l.planet_id
    ORDER BY p.name, l.level_order, v.class_setting, v.sessions_per_week`).all());
});

// Discount tiers & global config (franchisor-governed, Rule 1)
router.get('/discount-tiers', (_req, res) => {
  res.json(db.prepare('SELECT * FROM discount_tiers ORDER BY rule_type, threshold_count').all());
});
router.put('/discount-tiers', requireFranchisor, (req, res) => {
  const { tiers = [] } = req.body;
  db.transaction(() => {
    for (const t of tiers) {
      db.prepare(`INSERT INTO discount_tiers (id,rule_type,threshold_count,percent) VALUES (?,?,?,?)
                  ON CONFLICT(rule_type,threshold_count) DO UPDATE SET percent = excluded.percent`)
        .run(uid(), t.rule_type, t.threshold_count, t.percent);
    }
  })();
  res.json({ success: true });
});

router.get('/config', (_req, res) => {
  res.json(db.prepare('SELECT * FROM system_config').all());
});
router.put('/config', requireFranchisor, (req, res) => {
  for (const [key, value] of Object.entries(req.body || {})) {
    db.prepare(`INSERT INTO system_config (key,value,updated_at) VALUES (?,?,datetime('now'))
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`)
      .run(key, String(value));
  }
  res.json({ success: true });
});

// ------------------ Ownerships & locations (franchisor) ---------------------
router.get('/ownerships', requireFranchisor, (_req, res) => {
  res.json(db.prepare('SELECT * FROM ownerships ORDER BY created_at').all());
});

// Creating an ownership also creates its management account and emails a
// temporary password that must be reset on first login.
router.post('/ownerships', requireFranchisor, (req, res) => {
  const { type, name, owner_name, owner_email } = req.body;
  if (!type || !name || !owner_name || !owner_email) return res.status(400).json({ error: 'type, name, owner_name and owner_email are required' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(owner_email)) return res.status(400).json({ error: 'A user with this email already exists' });
  const id = uid();
  const tempPassword = 'Fvca-' + uid().slice(0, 8);
  db.transaction(() => {
    db.prepare('INSERT INTO ownerships (id,type,name,owner_name,owner_email) VALUES (?,?,?,?,?)').run(id, type, name, owner_name, owner_email);
    db.prepare(`INSERT INTO users (id,email,password_hash,role,ownership_id,name,must_reset_password) VALUES (?,?,?,?,?,?,1)`)
      .run(uid(), owner_email, hashPassword(tempPassword),
           type === 'CORPORATE' ? 'FRANCHISOR_MANAGEMENT' : 'FRANCHISEE_MANAGEMENT', id, owner_name);
  })();
  sendEmail(owner_email, 'Your FVCA management account', `Temporary password: ${tempPassword} — you must set a new password on first login.`);
  res.status(201).json({ id, temp_password_sent: true });
});

router.post('/locations', (req, res) => {
  const { ownership_id, name, address1, address2, city, province, country, postal } = req.body;
  const own = scopeOwnership(req.user) || ownership_id;
  if (!own || !name || !address1 || !city || !province || !country || !postal) {
    return res.status(400).json({ error: 'name and full address (line 1, city, province, country, postal) are required' });
  }
  const id = uid();
  db.prepare('INSERT INTO locations (id,ownership_id,name,address1,address2,city,province,country,postal) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, own, name, address1, address2 || null, city, province, country, postal);
  res.status(201).json({ id });
});

// Holiday calendar (per ownership, optionally per location)
router.get('/holidays', (req, res) => res.json(scoped(req, 'SELECT * FROM holidays')));
router.post('/holidays', (req, res) => {
  const { date, name, location_id } = req.body;
  if (!date || !name) return res.status(400).json({ error: 'date and name are required' });
  const id = uid();
  db.prepare('INSERT INTO holidays (id,ownership_id,location_id,date,name) VALUES (?,?,?,?,?)')
    .run(id, scopeOwnership(req.user) || req.body.ownership_id || req.user.ownership_id, location_id || null, date, name);
  res.status(201).json({ id });
});

// --------------------------- Staff accounts ---------------------------------
router.get('/staff', (req, res) => {
  const own = scopeOwnership(req.user);
  const sql = `SELECT id, email, name, role, ownership_id, must_reset_password, created_at FROM users
               WHERE role IN ('COACH','EVENT_MANAGER','FRANCHISOR_ADMIN','FRANCHISEE_ADMIN')`;
  res.json(own ? db.prepare(sql + ' AND ownership_id = ?').all(own) : db.prepare(sql).all());
});

// Create coach / event manager / admin accounts; temp password emailed.
router.post('/staff', (req, res) => {
  const { email, name, role } = req.body;
  const allowed = isFranchisor(req.user)
    ? ['COACH', 'EVENT_MANAGER', 'FRANCHISOR_ADMIN']
    : ['COACH', 'EVENT_MANAGER', 'FRANCHISEE_ADMIN'];
  if (!allowed.includes(role)) return res.status(403).json({ error: `You may only create: ${allowed.join(', ')}` });
  if (!email || !name) return res.status(400).json({ error: 'email and name are required' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(400).json({ error: 'A user with this email already exists' });
  const tempPassword = 'Fvca-' + uid().slice(0, 8);
  const id = uid();
  db.prepare(`INSERT INTO users (id,email,password_hash,role,ownership_id,name,must_reset_password) VALUES (?,?,?,?,?,?,1)`)
    .run(id, email, hashPassword(tempPassword), role, req.user.ownership_id, name);
  sendEmail(email, 'Your FVCA staff account', `Temporary password: ${tempPassword} — set a new password on first login.`);
  res.status(201).json({ id, temp_password: tempPassword });
});

// ---------------------- Offerings & schedules -------------------------------
router.get('/offerings', (req, res) => {
  const own = scopeOwnership(req.user);
  const sql = `
    SELECT o.*, loc.name AS location_name, v.class_setting, v.sessions_per_week, v.list_price_cents,
           l.name AS level_name, p.name AS planet_name
    FROM offerings o
    JOIN locations loc ON loc.id = o.location_id
    JOIN course_variants v ON v.id = o.variant_id
    JOIN courses c ON c.id = v.course_id
    JOIN levels l ON l.id = c.level_id
    JOIN planets p ON p.id = l.planet_id` + (own ? ' WHERE o.ownership_id = ?' : '');
  res.json(own ? db.prepare(sql).all(own) : db.prepare(sql).all());
});

// Choose planets/courses applicable to a location (franchisee or corporate)
router.post('/offerings', (req, res) => {
  const { location_id, variant_id } = req.body;
  const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(location_id);
  if (!loc) return res.status(400).json({ error: 'Unknown location' });
  const own = scopeOwnership(req.user);
  if (own && loc.ownership_id !== own) return res.status(403).json({ error: 'Location is not under your ownership' });
  const id = uid();
  db.prepare('INSERT INTO offerings (id,ownership_id,location_id,variant_id,local_price_cents) VALUES (?,?,?,?,NULL)')
    .run(id, loc.ownership_id, location_id, variant_id);
  res.status(201).json({ id });
});

router.post('/batches', (req, res) => {
  const { offering_id, day_of_week, start_time, capacity } = req.body;
  const off = db.prepare('SELECT * FROM offerings WHERE id = ?').get(offering_id);
  if (!off) return res.status(400).json({ error: 'Unknown offering' });
  const own = scopeOwnership(req.user);
  if (own && off.ownership_id !== own) return res.status(403).json({ error: 'Offering is not under your ownership' });
  const id = uid();
  db.prepare('INSERT INTO batches (id,ownership_id,offering_id,day_of_week,start_time,capacity) VALUES (?,?,?,?,?,?)')
    .run(id, off.ownership_id, offering_id, day_of_week, start_time, capacity || 8);
  res.status(201).json({ id });
});

// ------------------------ Roster generation ---------------------------------
// Generates the staff roster + sessions for the next 2 weeks, honoring
// holidays, coach availability and leaves. Idempotent per (batch, date).
router.post('/roster/generate', (req, res) => {
  const own = scopeOwnership(req.user) || req.body.ownership_id || req.user.ownership_id;
  const days = 14;
  const batches = db.prepare(`
    SELECT b.*, o.location_id, c.session_minutes
    FROM batches b JOIN offerings o ON o.id = b.offering_id
    JOIN course_variants v ON v.id = o.variant_id
    JOIN courses c ON c.id = v.course_id
    WHERE b.ownership_id = ? AND b.active = 1`).all(own);
  const coaches = db.prepare(`SELECT id FROM users WHERE role = 'COACH' AND ownership_id = ?`).all(own).map(r => r.id);
  if (!coaches.length) return res.status(400).json({ error: 'No coaches exist for this ownership yet' });

  let created = 0, skippedHoliday = 0;
  const tx = db.transaction(() => {
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() + i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const dow = d.getDay();
      for (const b of batches) {
        if (b.day_of_week !== dow) continue;
        const holiday = db.prepare(`SELECT id FROM holidays WHERE ownership_id = ? AND date = ? AND (location_id IS NULL OR location_id = ?)`)
          .get(own, dateStr, b.location_id);
        if (holiday) { skippedHoliday++; continue; }
        if (db.prepare('SELECT id FROM roster WHERE batch_id = ? AND work_date = ?').get(b.id, dateStr)) continue;

        // Pick an available coach: availability window covers the slot, no leave
        const coach = coaches.find(cid => {
          const avail = db.prepare(`
            SELECT id FROM coach_availability WHERE coach_user_id = ? AND day_of_week = ?
              AND start_time <= ? AND end_time >= ?
              AND effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?)`)
            .get(cid, dow, b.start_time, b.start_time, dateStr, dateStr);
          if (!avail) return false;
          const leave = db.prepare(`SELECT id FROM coach_leaves WHERE coach_user_id = ? AND from_date <= ? AND to_date >= ?`)
            .get(cid, dateStr, dateStr);
          return !leave;
        });
        if (!coach) continue;

        const endTime = addMinutes(b.start_time, b.session_minutes || 60);
        db.prepare(`INSERT INTO roster (id,ownership_id,location_id,batch_id,coach_user_id,work_date,published_at)
                    VALUES (?,?,?,?,?,?,datetime('now'))`)
          .run(uid(), own, b.location_id, b.id, coach, dateStr);
        db.prepare(`INSERT OR IGNORE INTO sessions (id,ownership_id,batch_id,coach_user_id,session_date,start_time,end_time)
                    VALUES (?,?,?,?,?,?,?)`)
          .run(uid(), own, b.id, coach, dateStr, b.start_time, endTime);
        created++;
      }
    }
  });
  tx();
  res.json({ success: true, created, skipped_holidays: skippedHoliday });
});

router.get('/roster', (req, res) => {
  const own = scopeOwnership(req.user);
  const sql = `
    SELECT r.*, u.name AS coach_name, loc.name AS location_name, b.start_time,
           p.name AS planet_name, l.name AS level_name
    FROM roster r
    JOIN users u ON u.id = r.coach_user_id
    JOIN locations loc ON loc.id = r.location_id
    JOIN batches b ON b.id = r.batch_id
    JOIN offerings o ON o.id = b.offering_id
    JOIN course_variants v ON v.id = o.variant_id
    JOIN courses c ON c.id = v.course_id
    JOIN levels l ON l.id = c.level_id
    JOIN planets p ON p.id = l.planet_id
    WHERE r.work_date >= date('now')` + (own ? ' AND r.ownership_id = ?' : '') + ' ORDER BY r.work_date, b.start_time';
  res.json(own ? db.prepare(sql).all(own) : db.prepare(sql).all());
});

// -------------------- Customer management (admin) ---------------------------
router.get('/customers', (req, res) => {
  const own = scopeOwnership(req.user);
  const sql = `
    SELECT c.id, c.full_name, u.email, c.nearest_location_id, loc.name AS location_name, c.created_at,
           (SELECT COUNT(*) FROM members m WHERE m.customer_id = c.id) AS member_count
    FROM customers c JOIN users u ON u.id = c.user_id
    JOIN locations loc ON loc.id = c.nearest_location_id` + (own ? ' WHERE c.ownership_id = ?' : '') + ' ORDER BY c.created_at DESC';
  res.json(own ? db.prepare(sql).all(own) : db.prepare(sql).all());
});

// Register a course for a member on behalf of a customer (cash / POS / card on file)
router.post('/customers/:id/register-course', (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  const { items = [], channel = 'CASH' } = req.body;
  if (!['CASH', 'POS', 'CARD_ON_FILE'].includes(channel)) return res.status(400).json({ error: 'channel must be CASH, POS or CARD_ON_FILE' });
  try {
    const result = db.transaction(() => {
      const quote = quoteCart(items);
      for (const ln of quote.lines) {
        const enrollId = uid();
        const off = db.prepare('SELECT * FROM offerings WHERE id = ?').get(ln.offering_id);
        db.prepare(`INSERT INTO enrollments (id,ownership_id,customer_id,member_id,offering_id,status,start_date)
                    VALUES (?,?,?,?,?,'ACTIVE',date('now'))`)
          .run(enrollId, off.ownership_id, c.id, ln.member_id, ln.offering_id);
        for (const bid of ln.batch_ids) db.prepare('INSERT INTO enrollment_slots (enrollment_id,batch_id) VALUES (?,?)').run(enrollId, bid);
        ln.enrollment_id = enrollId;
      }
      for (const f of quote.setup_fees) {
        if (f.member_id) db.prepare(`UPDATE members SET setup_fee_paid_at = datetime('now') WHERE id = ?`).run(f.member_id);
      }
      return settleInvoice({
        ownershipId: c.ownership_id, customer: c, quote,
        channel, actorType: 'ADMIN',
        periodStart: new Date().toISOString().slice(0, 10),
      });
    })();
    res.status(201).json(result);
  } catch (e) {
    if (e.code === 'PAYMENT_FAILED') return res.status(402).json({ error: 'Card on file was declined' });
    res.status(400).json({ error: e.message });
  }
});

// Missed payments by month + retry charge
router.get('/missed-payments', (req, res) => {
  const own = scopeOwnership(req.user);
  const sql = `
    SELECT i.*, c.full_name, u.email, strftime('%Y-%m', i.created_at) AS month
    FROM invoices i JOIN customers c ON c.id = i.customer_id JOIN users u ON u.id = c.user_id
    WHERE i.status IN ('FAILED','DUNNING')` + (own ? ' AND i.ownership_id = ?' : '') + ' ORDER BY i.created_at DESC';
  res.json(own ? db.prepare(sql).all(own) : db.prepare(sql).all());
});

router.post('/invoices/:id/retry-charge', (req, res) => {
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!inv || !['FAILED', 'DUNNING'].includes(inv.status)) return res.status(400).json({ error: 'Invoice is not in a failed state' });
  const pm = db.prepare('SELECT * FROM payment_methods WHERE customer_id = ? AND is_default = 1').get(inv.customer_id);
  if (!pm) return res.status(400).json({ error: 'Customer has no default card on file' });
  const { gatewayCharge } = require('../services/billing');
  const attempt = db.prepare('SELECT COALESCE(MAX(attempt_no),0)+1 AS n FROM transactions WHERE invoice_id = ?').get(inv.id).n;
  const result = gatewayCharge({ token: pm.token, amount_cents: inv.total_cents });
  db.prepare(`INSERT INTO transactions (id,ownership_id,invoice_id,payment_method_id,channel,amount_cents,status,failure_code,actor_type,attempt_no)
              VALUES (?,?,?,?,?,?,?,?,'ADMIN',?)`)
    .run(uid(), inv.ownership_id, inv.id, pm.id, 'CARD_ON_FILE', inv.total_cents,
         result.ok ? 'SUCCEEDED' : 'FAILED', result.failure_code || null, attempt);
  db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(result.ok ? 'PAID' : 'DUNNING', inv.id);
  res.json({ success: result.ok });
});

// Store credit grant (admins can issue credit of their own)
router.post('/customers/:id/store-credit', (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  const { amount_cents } = req.body;
  if (!amount_cents || amount_cents <= 0) return res.status(400).json({ error: 'amount_cents must be positive' });
  db.prepare(`INSERT INTO store_credit_ledger (id,ownership_id,customer_id,amount_cents,reason,granted_by)
              VALUES (?,?,?,?,'ADMIN_GRANT',?)`)
    .run(uid(), c.ownership_id, c.id, amount_cents, req.user.id);
  res.status(201).json({ success: true });
});

// ---------------------- Price change requests -------------------------------
// Franchisee submits; franchisor management approves/rejects. Approval writes
// the local price on all of that ownership's offerings of the variant.
router.get('/price-change-requests', (req, res) => {
  const own = scopeOwnership(req.user);
  const sql = `
    SELECT r.*, ow.name AS ownership_name, p.name AS planet_name, l.name AS level_name,
           v.class_setting, v.sessions_per_week
    FROM price_change_requests r
    JOIN ownerships ow ON ow.id = r.ownership_id
    JOIN course_variants v ON v.id = r.variant_id
    JOIN courses c ON c.id = v.course_id
    JOIN levels l ON l.id = c.level_id
    JOIN planets p ON p.id = l.planet_id` + (own ? ' WHERE r.ownership_id = ?' : '') + ' ORDER BY r.created_at DESC';
  res.json(own ? db.prepare(sql).all(own) : db.prepare(sql).all());
});

router.post('/price-change-requests', (req, res) => {
  if (isFranchisor(req.user)) return res.status(400).json({ error: 'Franchisor sets rates directly; requests are for franchisees' });
  const { variant_id, requested_rate_cents, reason, attachments = [] } = req.body;
  const v = db.prepare('SELECT * FROM course_variants WHERE id = ?').get(variant_id);
  if (!v) return res.status(400).json({ error: 'Unknown course variant' });
  if (!requested_rate_cents || !reason) return res.status(400).json({ error: 'Requested rate and reason are required' });
  const id = uid();
  db.prepare(`INSERT INTO price_change_requests (id,ownership_id,variant_id,franchisor_rate_cents,requested_rate_cents,reason,attachments)
              VALUES (?,?,?,?,?,?,?)`)
    .run(id, req.user.ownership_id, variant_id, v.list_price_cents, requested_rate_cents, reason, JSON.stringify(attachments));
  res.status(201).json({ id });
});

router.put('/price-change-requests/:id/decide', requireFranchisor, (req, res) => {
  const { decision } = req.body; // APPROVED | REJECTED
  if (!['APPROVED', 'REJECTED'].includes(decision)) return res.status(400).json({ error: 'decision must be APPROVED or REJECTED' });
  const r = db.prepare(`SELECT * FROM price_change_requests WHERE id = ? AND status = 'PENDING'`).get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Pending request not found' });
  db.transaction(() => {
    db.prepare(`UPDATE price_change_requests SET status = ?, decided_by = ?, decided_at = datetime('now') WHERE id = ?`)
      .run(decision, req.user.id, r.id);
    if (decision === 'APPROVED') {
      db.prepare(`UPDATE offerings SET local_price_cents = ? WHERE ownership_id = ? AND variant_id = ?`)
        .run(r.requested_rate_cents, r.ownership_id, r.variant_id);
    }
  })();
  const mgmt = db.prepare(`SELECT id FROM users WHERE ownership_id = ? AND role = 'FRANCHISEE_MANAGEMENT'`).get(r.ownership_id);
  if (mgmt) notify(mgmt.id, 'INFO', `Your price change request was ${decision.toLowerCase()}.`);
  res.json({ success: true });
});

// ------------------------------ Tickets --------------------------------------
router.get('/tickets', (req, res) => res.json(scoped(req, `SELECT t.* FROM tickets t`)));
router.post('/tickets', (req, res) => {
  const { location_id, category, description } = req.body;
  if (!['IT', 'NON_IT'].includes(category) || !description) return res.status(400).json({ error: 'category (IT/NON_IT) and description are required' });
  const id = uid();
  db.prepare(`INSERT INTO tickets (id,ownership_id,location_id,category,description,created_by) VALUES (?,?,?,?,?,?)`)
    .run(id, req.user.ownership_id, location_id || null, category, description, req.user.id);
  res.status(201).json({ id });
});
router.put('/tickets/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.prepare('UPDATE tickets SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

// ------------------------------ Reports --------------------------------------
// Revenue by ownership / location / planet / level (management dashboards)
router.get('/reports/revenue', (req, res) => {
  const own = scopeOwnership(req.user);
  const where = `i.status = 'PAID'` + (own ? ` AND i.ownership_id = '${own.replace(/'/g, '')}'` : '');
  const byOwnership = db.prepare(`
    SELECT ow.name, SUM(il.amount_cents) AS revenue_cents
    FROM invoice_lines il JOIN invoices i ON i.id = il.invoice_id
    JOIN ownerships ow ON ow.id = i.ownership_id
    WHERE ${where} GROUP BY ow.id ORDER BY revenue_cents DESC`).all();
  const byLocation = db.prepare(`
    SELECT COALESCE(loc.name,'(no location)') AS name, SUM(il.amount_cents) AS revenue_cents
    FROM invoice_lines il JOIN invoices i ON i.id = il.invoice_id
    LEFT JOIN locations loc ON loc.id = il.location_id
    WHERE ${where} GROUP BY il.location_id ORDER BY revenue_cents DESC`).all();
  const byPlanet = db.prepare(`
    SELECT COALESCE(p.name,'(fees/events)') AS name, SUM(il.amount_cents) AS revenue_cents
    FROM invoice_lines il JOIN invoices i ON i.id = il.invoice_id
    LEFT JOIN planets p ON p.id = il.planet_id
    WHERE ${where} GROUP BY il.planet_id ORDER BY revenue_cents DESC`).all();
  const byLevel = db.prepare(`
    SELECT COALESCE(p.name || ' · ' || l.name,'(fees/events)') AS name, SUM(il.amount_cents) AS revenue_cents
    FROM invoice_lines il JOIN invoices i ON i.id = il.invoice_id
    LEFT JOIN levels l ON l.id = il.level_id
    LEFT JOIN planets p ON p.id = l.planet_id
    WHERE ${where} GROUP BY il.level_id ORDER BY revenue_cents DESC`).all();
  const byMonth = db.prepare(`
    SELECT strftime('%Y-%m', i.created_at) AS name, SUM(il.amount_cents) AS revenue_cents
    FROM invoice_lines il JOIN invoices i ON i.id = il.invoice_id
    WHERE ${where} GROUP BY name ORDER BY name`).all();
  res.json({ by_ownership: byOwnership, by_location: byLocation, by_planet: byPlanet, by_level: byLevel, by_month: byMonth });
});

// Registration efforts failing because of unavailable slots
router.get('/reports/failed-registrations', (req, res) => {
  const own = scopeOwnership(req.user);
  const sql = `
    SELECT ra.created_at, ra.reason, loc.name AS location_name, ow.name AS ownership_name,
           p.name AS planet_name, l.name AS level_name
    FROM registration_attempts ra
    JOIN ownerships ow ON ow.id = ra.ownership_id
    LEFT JOIN locations loc ON loc.id = ra.location_id
    LEFT JOIN batches b ON b.id = ra.batch_id
    LEFT JOIN offerings o ON o.id = b.offering_id
    LEFT JOIN course_variants v ON v.id = COALESCE(ra.variant_id, o.variant_id)
    LEFT JOIN courses c ON c.id = v.course_id
    LEFT JOIN levels l ON l.id = c.level_id
    LEFT JOIN planets p ON p.id = l.planet_id` + (own ? ' WHERE ra.ownership_id = ?' : '') + ' ORDER BY ra.created_at DESC';
  res.json(own ? db.prepare(sql).all(own) : db.prepare(sql).all());
});

// Trial assessments visible to admin/manager
router.get('/trial-assessments', (req, res) => {
  const own = scopeOwnership(req.user);
  const sql = `
    SELECT ta.*, t.trial_date, t.guest_name, u.name AS coach_name,
           m.first_name || ' ' || m.last_name AS member_name
    FROM trial_assessments ta
    JOIN trials t ON t.id = ta.trial_id
    JOIN users u ON u.id = ta.coach_user_id
    LEFT JOIN members m ON m.id = t.member_id` + (own ? ' WHERE ta.ownership_id = ?' : '') + ' ORDER BY ta.submitted_at DESC';
  res.json(own ? db.prepare(sql).all(own) : db.prepare(sql).all());
});

function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return String(Math.floor(total / 60) % 24).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}

module.exports = router;
