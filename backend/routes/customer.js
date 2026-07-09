const express = require('express');
const db = require('../db');
const { uid } = require('../db');
const {
  authenticate, requireCustomer, getCustomerForUser,
  maskCustomer, maskMember, hasPiiAccess,
} = require('../middleware/auth');
const { quoteCart } = require('../services/pricing');
const { settleInvoice, loyaltyBalance, storeCreditBalance, notify, sendEmail } = require('../services/billing');
const { currentPhase } = require('./public');

const router = express.Router();
router.use(authenticate, requireCustomer);

function myCustomer(req, res) {
  const c = getCustomerForUser(req.user.id);
  if (!c) { res.status(404).json({ error: 'Customer profile not found' }); return null; }
  return c;
}

// ------------------------------ Profile -------------------------------------
router.get('/profile', (req, res) => {
  const c = myCustomer(req, res); if (!c) return;
  const unlocked = hasPiiAccess(req.user.id);
  const members = db.prepare('SELECT * FROM members WHERE customer_id = ?').all(c.id);
  const accessible = db.prepare(`SELECT l.id, l.name FROM customer_locations cl JOIN locations l ON l.id = cl.location_id WHERE cl.customer_id = ?`).all(c.id);
  const nearest = db.prepare('SELECT id, name FROM locations WHERE id = ?').get(c.nearest_location_id);
  res.json({
    customer: unlocked ? c : maskCustomer(c),
    members: unlocked ? members : members.map(maskMember),
    nearest_location: nearest,
    accessible_locations: accessible,
    pii_unlocked: unlocked,
  });
});

// Editing PII requires a fresh 2FA verification
router.put('/profile', (req, res) => {
  const c = myCustomer(req, res); if (!c) return;
  if (!hasPiiAccess(req.user.id)) return res.status(403).json({ error: 'Verify with 2FA before editing personal information', two_factor_required: true });
  const { full_name, dob, gender, phone, emergency_contact, cfc_id } = req.body;
  db.prepare(`UPDATE customers SET full_name = COALESCE(?, full_name), dob = COALESCE(?, dob),
              gender = COALESCE(?, gender), phone = COALESCE(?, phone),
              emergency_contact = COALESCE(?, emergency_contact), cfc_id = COALESCE(?, cfc_id) WHERE id = ?`)
    .run(full_name, dob, gender, phone, emergency_contact, cfc_id, c.id);
  if (phone) db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, req.user.id);
  res.json({ success: true });
});

// ------------------------------ Members --------------------------------------
router.post('/members', (req, res) => {
  const c = myCustomer(req, res); if (!c) return;
  const m = req.body;
  if (!m.first_name || !m.last_name) return res.status(400).json({ error: 'First and last name are required' });
  const id = uid();
  db.prepare(`INSERT INTO members (id,customer_id,ownership_id,is_self,first_name,last_name,dob,gender,grade,email,emergency_contact,cfc_id,tshirt_size,preferred_color)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, c.id, c.ownership_id, m.is_self ? 1 : 0, m.first_name, m.last_name, m.dob || null, m.gender || null,
         m.grade || null, m.email || null, m.emergency_contact || null, m.cfc_id || null, m.tshirt_size || null, m.preferred_color || null);
  res.status(201).json({ id });
});

router.put('/members/:id', (req, res) => {
  const c = myCustomer(req, res); if (!c) return;
  if (!hasPiiAccess(req.user.id)) return res.status(403).json({ error: 'Verify with 2FA before editing personal information', two_factor_required: true });
  const m = db.prepare('SELECT * FROM members WHERE id = ? AND customer_id = ?').get(req.params.id, c.id);
  if (!m) return res.status(404).json({ error: 'Member not found' });
  const b = req.body;
  db.prepare(`UPDATE members SET first_name=COALESCE(?,first_name), last_name=COALESCE(?,last_name), dob=COALESCE(?,dob),
              gender=COALESCE(?,gender), grade=COALESCE(?,grade), email=COALESCE(?,email),
              emergency_contact=COALESCE(?,emergency_contact), cfc_id=COALESCE(?,cfc_id),
              tshirt_size=COALESCE(?,tshirt_size), preferred_color=COALESCE(?,preferred_color) WHERE id = ?`)
    .run(b.first_name, b.last_name, b.dob, b.gender, b.grade, b.email, b.emergency_contact, b.cfc_id, b.tshirt_size, b.preferred_color, m.id);
  res.json({ success: true });
});

// ------------------------- Enrollment: quote & checkout ----------------------
router.post('/cart/quote', (req, res) => {
  const c = myCustomer(req, res); if (!c) return;
  try {
    res.json(quoteCart(req.body.items || []));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/cart/checkout', (req, res) => {
  const c = myCustomer(req, res); if (!c) return;
  const { items = [], payment_method_id = null, apply_store_credit = false } = req.body;
  if (!items.length) return res.status(400).json({ error: 'Cart is empty' });

  // Validate members belong to this customer and batches match frequency
  for (const item of items) {
    const m = db.prepare('SELECT id FROM members WHERE id = ? AND customer_id = ?').get(item.member_id, c.id);
    if (!m) return res.status(400).json({ error: 'Invalid member on cart line' });
  }

  try {
    const result = db.transaction(() => {
      const quote = quoteCart(items);

      // Capacity check + enrollment creation
      for (const ln of quote.lines) {
        const enrollId = uid();
        const offering = db.prepare('SELECT * FROM offerings WHERE id = ?').get(ln.offering_id);
        for (const batchId of ln.batch_ids) {
          const seat = db.prepare(`
            SELECT b.capacity - (
              SELECT COUNT(*) FROM enrollment_slots es JOIN enrollments e ON e.id = es.enrollment_id
              WHERE es.batch_id = b.id AND e.status IN ('ACTIVE','NOTICE_GIVEN')) AS left
            FROM batches b WHERE b.id = ? AND b.offering_id = ?`).get(batchId, ln.offering_id);
          if (!seat) throw new Error('Selected schedule slot does not belong to this course');
          if (seat.left <= 0) {
            db.prepare(`INSERT INTO registration_attempts (id,ownership_id,location_id,batch_id,variant_id,reason) VALUES (?,?,?,?,?,'FULL')`)
              .run(uid(), offering.ownership_id, offering.location_id, batchId, offering.variant_id);
            throw Object.assign(new Error('One of the selected slots is full — please pick another schedule'), { code: 'FULL' });
          }
        }
        if (ln.class_setting === 'GROUP' && ln.batch_ids.length !== ln.sessions_per_week) {
          throw new Error(`Pick ${ln.sessions_per_week} weekly slot(s) for ${ln.planet_name} ${ln.level_name}`);
        }
        db.prepare(`INSERT INTO enrollments (id,ownership_id,customer_id,member_id,offering_id,status,start_date)
                    VALUES (?,?,?,?,?,'ACTIVE',date('now'))`)
          .run(enrollId, offering.ownership_id, c.id, ln.member_id, ln.offering_id);
        for (const batchId of ln.batch_ids) {
          db.prepare(`INSERT INTO enrollment_slots (enrollment_id,batch_id) VALUES (?,?)`).run(enrollId, batchId);
        }
        ln.enrollment_id = enrollId;
      }

      // Mark setup fee paid for first-time members
      for (const f of quote.setup_fees) {
        if (f.member_id) db.prepare(`UPDATE members SET setup_fee_paid_at = datetime('now') WHERE id = ?`).run(f.member_id);
      }

      const settle = settleInvoice({
        ownershipId: c.ownership_id, customer: c, quote,
        channel: 'CARD_ON_FILE', actorType: 'CUSTOMER',
        paymentMethodId: payment_method_id, applyStoreCredit: apply_store_credit,
        periodStart: new Date().toISOString().slice(0, 10),
      });
      return { quote, ...settle };
    })();

    notify(req.user.id, 'INFO', `Payment of $${(result.invoice.total_cents / 100).toFixed(2)} received. You earned ${result.loyalty_points} loyalty points.`);
    sendEmail(req.user.email, 'FVCA payment receipt', `Invoice ${result.invoice.id} — $${(result.invoice.total_cents / 100).toFixed(2)} CAD.`);
    res.status(201).json(result);
  } catch (e) {
    if (e.code === 'PAYMENT_FAILED') {
      notify(req.user.id, 'PAYMENT_FAILED', 'Your payment failed. Please update your card and retry.');
      return res.status(402).json({ error: 'Payment was declined' });
    }
    res.status(e.code === 'FULL' ? 409 : 400).json({ error: e.message });
  }
});

// Subscription cancellation with the mandatory 15-day notice
router.post('/enrollments/:id/cancel', (req, res) => {
  const c = myCustomer(req, res); if (!c) return;
  const e = db.prepare('SELECT * FROM enrollments WHERE id = ? AND customer_id = ?').get(req.params.id, c.id);
  if (!e) return res.status(404).json({ error: 'Enrollment not found' });
  if (e.status !== 'ACTIVE') return res.status(400).json({ error: 'Enrollment is not active' });
  const noticeDays = db.getConfigInt('CANCEL_NOTICE_DAYS', 15);
  const end = new Date(Date.now() + noticeDays * 86400000).toISOString().slice(0, 10);
  db.prepare(`UPDATE enrollments SET status = 'NOTICE_GIVEN', cancellation_notice_at = datetime('now'), end_date = ? WHERE id = ?`)
    .run(end, e.id);
  res.json({ success: true, message: `Cancellation accepted with ${noticeDays}-day notice. Last day: ${end}.`, end_date: end });
});

// ------------------------------ Dashboard ------------------------------------
router.get('/dashboard', (req, res) => {
  const c = myCustomer(req, res); if (!c) return;
  const members = db.prepare('SELECT * FROM members WHERE customer_id = ?').all(c.id).map(maskMember);

  const enrollments = db.prepare(`
    SELECT e.*, p.name AS planet_name, l.name AS level_name, v.class_setting, v.sessions_per_week,
           loc.name AS location_name, m.first_name || ' ' || m.last_name AS member_name
    FROM enrollments e
    JOIN offerings o ON o.id = e.offering_id
    JOIN course_variants v ON v.id = o.variant_id
    JOIN courses cr ON cr.id = v.course_id
    JOIN levels l ON l.id = cr.level_id
    JOIN planets p ON p.id = l.planet_id
    JOIN locations loc ON loc.id = o.location_id
    JOIN members m ON m.id = e.member_id
    WHERE e.customer_id = ? ORDER BY e.created_at DESC`).all(c.id);

  const upcoming = db.prepare(`
    SELECT s.session_date, s.start_time, s.end_time, s.status,
           p.name AS planet_name, l.name AS level_name, loc.name AS location_name,
           m.first_name || ' ' || m.last_name AS member_name
    FROM sessions s
    JOIN batches b ON b.id = s.batch_id
    JOIN offerings o ON o.id = b.offering_id
    JOIN course_variants v ON v.id = o.variant_id
    JOIN courses cr ON cr.id = v.course_id
    JOIN levels l ON l.id = cr.level_id
    JOIN planets p ON p.id = l.planet_id
    JOIN locations loc ON loc.id = o.location_id
    JOIN enrollment_slots es ON es.batch_id = b.id
    JOIN enrollments e ON e.id = es.enrollment_id AND e.status IN ('ACTIVE','NOTICE_GIVEN')
    JOIN members m ON m.id = e.member_id
    WHERE e.customer_id = ? AND s.session_date >= date('now') AND s.status = 'SCHEDULED'
    ORDER BY s.session_date, s.start_time LIMIT 12`).all(c.id);

  const attendance = db.prepare(`
    SELECT a.status, COUNT(*) AS count, m.id AS member_id
    FROM attendance a JOIN members m ON m.id = a.member_id
    WHERE m.customer_id = ? GROUP BY m.id, a.status`).all(c.id);

  const recentNotes = db.prepare(`
    SELECT sn.*, s.session_date, u.name AS coach_name, m.first_name AS member_first_name
    FROM session_notes sn
    JOIN sessions s ON s.id = sn.session_id
    JOIN users u ON u.id = sn.coach_user_id
    LEFT JOIN members m ON m.id = sn.member_id
    WHERE sn.member_id IN (SELECT id FROM members WHERE customer_id = ?)
    ORDER BY sn.created_at DESC LIMIT 10`).all(c.id);

  const trialAssessments = db.prepare(`
    SELECT ta.*, t.trial_date, u.name AS coach_name,
           b.day_of_week AS rec_day, b.start_time AS rec_time
    FROM trial_assessments ta
    JOIN trials t ON t.id = ta.trial_id
    JOIN users u ON u.id = ta.coach_user_id
    LEFT JOIN batches b ON b.id = ta.recommended_batch_id
    WHERE t.member_id IN (SELECT id FROM members WHERE customer_id = ?)`).all(c.id);

  const events = db.prepare(`SELECT id, name, event_type, start_date, location_id FROM events WHERE status = 'LIVE' AND start_date >= date('now') ORDER BY start_date LIMIT 5`).all();
  const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 15').all(req.user.id);

  res.json({
    members, enrollments, upcoming_sessions: upcoming, attendance,
    session_notes: recentNotes, trial_assessments: trialAssessments,
    upcoming_events: events, notifications,
    loyalty_points: loyaltyBalance(c.id),
    store_credit_cents: storeCreditBalance(c.id),
  });
});

// -------------------------- Billing & receipts -------------------------------
router.get('/invoices', (req, res) => {
  const c = myCustomer(req, res); if (!c) return;
  const invoices = db.prepare('SELECT * FROM invoices WHERE customer_id = ? ORDER BY created_at DESC').all(c.id);
  const lines = db.prepare(`SELECT il.* FROM invoice_lines il JOIN invoices i ON i.id = il.invoice_id WHERE i.customer_id = ?`).all(c.id);
  const discounts = db.prepare(`
    SELECT ad.* FROM applied_discounts ad
    JOIN invoice_lines il ON il.id = ad.invoice_line_id
    JOIN invoices i ON i.id = il.invoice_id WHERE i.customer_id = ?`).all(c.id);
  const txs = db.prepare(`SELECT t.* FROM transactions t JOIN invoices i ON i.id = t.invoice_id WHERE i.customer_id = ? ORDER BY t.created_at DESC`).all(c.id);
  res.json(invoices.map(inv => ({
    ...inv,
    lines: lines.filter(l => l.invoice_id === inv.id).map(l => ({
      ...l, discounts: discounts.filter(d => d.invoice_line_id === l.id),
    })),
    transactions: txs.filter(t => t.invoice_id === inv.id),
  })));
});

router.get('/payment-methods', (req, res) => {
  const c = myCustomer(req, res); if (!c) return;
  res.json(db.prepare('SELECT id, gateway, brand, last4, exp_month, exp_year, is_default, saved_for_recurring FROM payment_methods WHERE customer_id = ?').all(c.id));
});

router.post('/payment-methods', (req, res) => {
  const c = myCustomer(req, res); if (!c) return;
  const { token, brand, last4, exp_month, exp_year, make_default, save_for_recurring } = req.body;
  if (!token || !last4) return res.status(400).json({ error: 'Card token is required' });
  const id = uid();
  if (make_default) db.prepare('UPDATE payment_methods SET is_default = 0 WHERE customer_id = ?').run(c.id);
  db.prepare(`INSERT INTO payment_methods (id,ownership_id,customer_id,gateway,token,brand,last4,exp_month,exp_year,is_default,saved_for_recurring)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, c.ownership_id, c.id, 'MOCK', token, brand || 'Card', last4, exp_month || null, exp_year || null, make_default ? 1 : 0, save_for_recurring ? 1 : 0);
  res.status(201).json({ id });
});

router.put('/payment-methods/:id/default', (req, res) => {
  const c = myCustomer(req, res); if (!c) return;
  const pm = db.prepare('SELECT id FROM payment_methods WHERE id = ? AND customer_id = ?').get(req.params.id, c.id);
  if (!pm) return res.status(404).json({ error: 'Card not found' });
  db.prepare('UPDATE payment_methods SET is_default = 0 WHERE customer_id = ?').run(c.id);
  db.prepare('UPDATE payment_methods SET is_default = 1 WHERE id = ?').run(pm.id);
  res.json({ success: true });
});

// Redeem loyalty points into store credit (10,000 pts = $1 by default)
router.post('/loyalty/redeem', (req, res) => {
  const c = myCustomer(req, res); if (!c) return;
  const points = parseInt(req.body.points, 10);
  const rate = db.getConfigInt('LOYALTY_REDEEM_POINTS_PER_DOLLAR', 10000);
  if (!points || points < rate) return res.status(400).json({ error: `Minimum redemption is ${rate} points ($1)` });
  if (points > loyaltyBalance(c.id)) return res.status(400).json({ error: 'Not enough points' });
  const cents = Math.floor(points / rate) * 100;
  const usedPoints = Math.floor(points / rate) * rate;
  db.transaction(() => {
    db.prepare(`INSERT INTO loyalty_ledger (id,ownership_id,customer_id,points,reason,source_ref) VALUES (?,?,?,?,'REDEEM',?)`)
      .run(uid(), c.ownership_id, c.id, -usedPoints, uid());
    db.prepare(`INSERT INTO store_credit_ledger (id,ownership_id,customer_id,amount_cents,reason) VALUES (?,?,?,?,'LOYALTY_REDEEM')`)
      .run(uid(), c.ownership_id, c.id, cents);
  })();
  res.json({ success: true, credited_cents: cents });
});

router.put('/notifications/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// -------------------------- Event registration -------------------------------
router.post('/events/:id/register', (req, res) => {
  const c = myCustomer(req, res); if (!c) return;
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!ev || ev.status !== 'LIVE') return res.status(400).json({ error: 'Event is not open for registration' });
  const { member_id, section_id, bye_rounds = [], play_up = false, cfc_id_requested = false,
          tshirt_size, interac_email, car_plate, payment_method_id, apply_store_credit = false } = req.body;

  const member = db.prepare('SELECT * FROM members WHERE id = ? AND customer_id = ?').get(member_id, c.id);
  if (!member) return res.status(400).json({ error: 'Pick one of your member profiles' });
  if (ev.fide_required && !member.fide_id) return res.status(400).json({ error: 'This event requires a FIDE ID on the member profile' });
  if (db.prepare('SELECT id FROM event_registrations WHERE event_id = ? AND member_id = ?').get(ev.id, member.id)) {
    return res.status(400).json({ error: 'This member is already registered for this event' });
  }

  const phase = currentPhase(ev.id);
  if (!phase) return res.status(400).json({ error: 'Registration is closed (no active price phase)' });

  // Byes cannot use the last round; respect the event's max byes
  const byes = (Array.isArray(bye_rounds) ? bye_rounds : []).map(Number).filter(n => n >= 1);
  if (ev.rounds && byes.some(b => b >= ev.rounds)) return res.status(400).json({ error: 'Byes cannot be used in the last round' });
  if (ev.max_byes != null && byes.length > ev.max_byes) return res.status(400).json({ error: `Maximum ${ev.max_byes} byes allowed` });
  if (play_up && !ev.play_up_allowed) return res.status(400).json({ error: 'Playing up is not allowed for this event' });

  const extraLines = [{
    line_type: ev.event_type === 'CAMP' ? 'CAMP' : 'EVENT_ENTRY',
    description: `${ev.name} — ${phase.phase_type.replace('_', ' ')} entry`,
    amount_cents: phase.price_cents, member_id: member.id, location_id: ev.location_id,
  }];
  if (play_up && ev.play_up_fee_cents) {
    extraLines.push({ line_type: 'PLAY_UP_FEE', description: `${ev.name} — play-up fee`, amount_cents: ev.play_up_fee_cents, member_id: member.id, location_id: ev.location_id });
  }
  if (cfc_id_requested && ev.cfc_id_fee_cents) {
    extraLines.push({ line_type: 'CFC_ID_FEE', description: `${ev.name} — CFC ID procurement`, amount_cents: ev.cfc_id_fee_cents, member_id: member.id, location_id: ev.location_id });
  }

  try {
    const result = db.transaction(() => {
      const settle = settleInvoice({
        ownershipId: ev.ownership_id, customer: c, quote: null, extraLines,
        channel: 'CARD_ON_FILE', actorType: 'CUSTOMER',
        paymentMethodId: payment_method_id, applyStoreCredit: apply_store_credit,
      });
      const regId = uid();
      db.prepare(`INSERT INTO event_registrations
        (id,ownership_id,event_id,customer_id,member_id,section_id,bye_rounds,play_up,cfc_id_requested,tshirt_size,interac_email,car_plate,phase_type,price_paid_cents)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(regId, ev.ownership_id, ev.id, c.id, member.id, section_id || null, JSON.stringify(byes),
             play_up ? 1 : 0, cfc_id_requested ? 1 : 0, tshirt_size || member.tshirt_size || null,
             interac_email || null, car_plate || null, phase.phase_type, phase.price_cents);
      return { ...settle, registration_id: regId };
    })();
    notify(req.user.id, 'EVENT', `${member.first_name} is registered for ${ev.name}!`);
    res.status(201).json(result);
  } catch (e) {
    if (e.code === 'PAYMENT_FAILED') return res.status(402).json({ error: 'Payment was declined' });
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
