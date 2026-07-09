const db = require('../db');
const { uid } = require('../db');
const { quoteCart } = require('../services/pricing');
const { gatewayCharge, awardLoyaltyForSpend, notify } = require('../services/billing');

// ---------------------------------------------------------------------------
// The "System" actor: automated jobs. Every automated action is recorded with
// actor_type = 'SYSTEM' so the audit trail distinguishes it from humans.
// ---------------------------------------------------------------------------

function log(action, detail) {
  db.prepare(`INSERT INTO audit_log (id,actor_type,actor_id,action,detail) VALUES (?,?,?,?,?)`)
    .run(uid(), 'SYSTEM', 'system@internal.fvca', action, detail || null);
}

// Job 1 — expected attendance sheets: for each rostered session in the next
// day, pre-fill one EXPECTED row per enrolled member so coaches can mark fast.
function generateAttendanceSheets() {
  const sessions = db.prepare(`
    SELECT s.* FROM sessions s
    WHERE s.session_date BETWEEN date('now') AND date('now','+1 day') AND s.status = 'SCHEDULED'`).all();
  let created = 0;
  for (const s of sessions) {
    const members = db.prepare(`
      SELECT e.member_id FROM enrollment_slots es
      JOIN enrollments e ON e.id = es.enrollment_id
      WHERE es.batch_id = ? AND e.status IN ('ACTIVE','NOTICE_GIVEN')
        AND (e.end_date IS NULL OR e.end_date >= ?)`).all(s.batch_id, s.session_date);
    for (const m of members) {
      const r = db.prepare(`INSERT OR IGNORE INTO attendance (id,ownership_id,session_id,member_id,status)
                            VALUES (?,?,?,?,'EXPECTED')`).run(uid(), s.ownership_id, s.id, m.member_id);
      created += r.changes;
    }
    // Trials expected in this session's batch on this date
    const trials = db.prepare(`SELECT * FROM trials WHERE batch_id = ? AND trial_date = ? AND status = 'BOOKED' AND member_id IS NOT NULL`)
      .all(s.batch_id, s.session_date);
    for (const t of trials) {
      const r = db.prepare(`INSERT OR IGNORE INTO attendance (id,ownership_id,session_id,member_id,status)
                            VALUES (?,?,?,?,'TRIAL')`).run(uid(), s.ownership_id, s.id, t.member_id);
      created += r.changes;
    }
  }
  if (created) log('ATTENDANCE_SHEETS', `${created} expected-attendance rows created`);
  return created;
}

// Job 2 — monthly recurring charge for active enrollments (per customer), with
// discounts recomputed at charge time, plus dunning notification on failure.
function chargeRecurring({ force = false } = {}) {
  const today = new Date();
  if (!force && today.getDate() !== 1) return 0; // bill on the 1st

  const period = today.toISOString().slice(0, 7);
  const customers = db.prepare(`
    SELECT DISTINCT c.* FROM customers c
    JOIN enrollments e ON e.customer_id = c.id
    WHERE e.status IN ('ACTIVE','NOTICE_GIVEN')`).all();

  let charged = 0;
  for (const c of customers) {
    // Skip if already billed this period
    const existing = db.prepare(`SELECT id FROM invoices WHERE customer_id = ? AND period_start = ?`).get(c.id, period + '-01');
    if (existing) continue;

    const enrollments = db.prepare(`
      SELECT e.id, e.member_id, e.offering_id FROM enrollments e
      WHERE e.customer_id = ? AND e.status IN ('ACTIVE','NOTICE_GIVEN')`).all(c.id);
    if (!enrollments.length) continue;

    const items = enrollments.map(e => ({ offering_id: e.offering_id, member_id: e.member_id }));
    try {
      const quote = quoteCart(items);
      quote.setup_fees = []; // setup fee is one-time, never recurs
      const subtotal = quote.lines.reduce((s, l) => s + l.base_cents, 0);
      const discount = quote.lines.reduce((s, l) => s + l.discounts.reduce((a, d) => a + d.amount_cents, 0), 0);
      const total = subtotal - discount;

      const invId = uid();
      db.prepare(`INSERT INTO invoices (id,ownership_id,customer_id,period_start,period_end,subtotal_cents,discount_cents,total_cents,status)
                  VALUES (?,?,?,?,?,?,?,?,'OPEN')`)
        .run(invId, c.ownership_id, c.id, period + '-01', period + '-28', subtotal, discount, total);
      quote.lines.forEach((ln, i) => {
        const lineId = uid();
        db.prepare(`INSERT INTO invoice_lines (id,invoice_id,ownership_id,line_type,enrollment_id,member_id,location_id,planet_id,level_id,description,amount_cents)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
          .run(lineId, invId, c.ownership_id, 'COURSE', enrollments[i].id, ln.member_id, ln.location_id, ln.planet_id, ln.level_id,
               `${ln.planet_name} · ${ln.level_name} (monthly)`, ln.base_cents);
        for (const d of ln.discounts) {
          db.prepare(`INSERT INTO applied_discounts (id,invoice_line_id,tier_id,amount_cents,explanation) VALUES (?,?,?,?,?)`)
            .run(uid(), lineId, d.tier_id || null, d.amount_cents, d.explanation);
        }
      });

      const pm = db.prepare('SELECT * FROM payment_methods WHERE customer_id = ? AND is_default = 1').get(c.id);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(c.user_id);
      if (!pm) {
        db.prepare(`UPDATE invoices SET status = 'FAILED' WHERE id = ?`).run(invId);
        notify(c.user_id, 'PAYMENT_FAILED', 'Monthly billing failed: no card on file.');
        continue;
      }
      const result = gatewayCharge({ token: pm.token, amount_cents: total });
      const txId = uid();
      db.prepare(`INSERT INTO transactions (id,ownership_id,invoice_id,payment_method_id,channel,amount_cents,status,failure_code,actor_type)
                  VALUES (?,?,?,?,?,?,?,?,'SYSTEM')`)
        .run(txId, c.ownership_id, invId, pm.id, 'CARD_ON_FILE', total, result.ok ? 'SUCCEEDED' : 'FAILED', result.failure_code || null);
      db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(result.ok ? 'PAID' : 'DUNNING', invId);
      if (result.ok) {
        awardLoyaltyForSpend(c.ownership_id, c.id, total, txId);
        charged++;
      } else if (user) {
        notify(c.user_id, 'PAYMENT_FAILED', `Your monthly payment of $${(total / 100).toFixed(2)} failed. We will retry; please update your card.`);
      }
    } catch (e) {
      console.error('Recurring charge error for customer', c.id, e.message);
    }
  }
  log('RECURRING_BILLING', `${charged} customers charged for ${period}`);
  return charged;
}

// Job 3 — finalize enrollments whose 15-day notice has elapsed
function finalizeCancellations() {
  const r = db.prepare(`UPDATE enrollments SET status = 'CANCELLED'
                        WHERE status = 'NOTICE_GIVEN' AND end_date < date('now')`).run();
  if (r.changes) log('CANCELLATIONS_FINALIZED', `${r.changes} enrollments cancelled`);
  return r.changes;
}

// Job 4 — mark sessions completed after their date passes
function completePastSessions() {
  const r = db.prepare(`UPDATE sessions SET status = 'COMPLETED'
                        WHERE status = 'SCHEDULED' AND session_date < date('now')`).run();
  return r.changes;
}

function runAll(opts = {}) {
  return {
    attendance_rows: generateAttendanceSheets(),
    customers_charged: chargeRecurring(opts),
    cancellations_finalized: finalizeCancellations(),
    sessions_completed: completePastSessions(),
  };
}

function start() {
  // Hourly tick; billing itself only fires on the 1st of the month.
  setInterval(() => {
    try { runAll(); } catch (e) { console.error('System job error:', e); }
  }, 60 * 60 * 1000);
  try { runAll(); } catch (e) { console.error('System job error:', e); }
}

module.exports = { start, runAll, generateAttendanceSheets, chargeRecurring, finalizeCancellations };
