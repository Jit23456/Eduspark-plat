const db = require('../db');
const { uid } = require('../db');

// Mock tokenizing gateway (stand-in for Stripe/Square). The card number never
// reaches the server in real deployments — the client exchanges it for a token
// on the gateway's hosted page; we store token + display metadata only.
function gatewayCharge({ token, amount_cents }) {
  if (token && token.includes('fail')) {
    return { ok: false, failure_code: 'card_declined' };
  }
  return { ok: true, charge_ref: 'ch_' + uid().slice(0, 12) };
}

function loyaltyBalance(customerId) {
  return db.prepare('SELECT COALESCE(SUM(points),0) AS p FROM loyalty_ledger WHERE customer_id = ?').get(customerId).p;
}

function storeCreditBalance(customerId) {
  return db.prepare('SELECT COALESCE(SUM(amount_cents),0) AS c FROM store_credit_ledger WHERE customer_id = ?').get(customerId).c;
}

function awardLoyaltyForSpend(ownershipId, customerId, amountCents, transactionId) {
  const earnPerDollar = db.getConfigInt('LOYALTY_EARN_PER_DOLLAR', 100);
  const points = Math.floor(amountCents / 100) * earnPerDollar;
  if (points <= 0) return 0;
  try {
    db.prepare(`INSERT INTO loyalty_ledger (id,ownership_id,customer_id,points,reason,source_ref) VALUES (?,?,?,?,?,?)`)
      .run(uid(), ownershipId, customerId, points, 'SPEND', transactionId);
  } catch { /* UNIQUE(reason,source_ref): idempotent on retries */ }
  return points;
}

function notify(userId, type, message) {
  db.prepare(`INSERT INTO notifications (id,user_id,type,message) VALUES (?,?,?,?)`)
    .run(uid(), userId, type, message);
}

function sendEmail(to, subject, body) {
  // Email provider stub: logged in dev; swap for SES/SendGrid in production.
  console.log(`[EMAIL] to=${to} subject="${subject}"\n${body}\n`);
}

/**
 * Create an invoice with lines, optionally apply store credit, then charge.
 * quote: output of quoteCart (lines already carry discounts)
 * Returns { invoice, transaction, loyalty_points }
 */
function settleInvoice({ ownershipId, customer, quote, extraLines = [], channel, actorType, paymentMethodId, applyStoreCredit = false, periodStart = null, periodEnd = null }) {
  const invoiceId = uid();
  const allDiscounts = [];

  const insLine = db.prepare(`INSERT INTO invoice_lines
    (id,invoice_id,ownership_id,line_type,enrollment_id,member_id,location_id,planet_id,level_id,description,amount_cents)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);

  let subtotal = 0, discount = 0;
  const lineRows = [];

  for (const ln of (quote ? quote.lines : [])) {
    const lineId = uid();
    const lineDiscount = ln.discounts.reduce((s, d) => s + d.amount_cents, 0);
    subtotal += ln.base_cents;
    discount += lineDiscount;
    lineRows.push({
      id: lineId, line_type: 'COURSE', enrollment_id: ln.enrollment_id || null,
      member_id: ln.member_id, location_id: ln.location_id, planet_id: ln.planet_id, level_id: ln.level_id,
      description: `${ln.planet_name} · ${ln.level_name} · ${ln.class_setting} ${ln.sessions_per_week}x/week (${ln.location_name})`,
      amount_cents: ln.base_cents,
    });
    for (const d of ln.discounts) allDiscounts.push({ line_id: lineId, ...d });
  }
  for (const f of (quote ? quote.setup_fees : [])) {
    subtotal += f.amount_cents;
    lineRows.push({
      id: uid(), line_type: 'SETUP_FEE', enrollment_id: null, member_id: f.member_id,
      location_id: null, planet_id: null, level_id: null,
      description: 'One-time member setup fee', amount_cents: f.amount_cents,
    });
  }
  for (const ex of extraLines) {
    subtotal += ex.amount_cents;
    lineRows.push({ id: uid(), enrollment_id: null, member_id: null, location_id: null, planet_id: null, level_id: null, ...ex });
  }

  let total = subtotal - discount;
  let creditApplied = 0;
  if (applyStoreCredit) {
    const bal = storeCreditBalance(customer.id);
    creditApplied = Math.min(bal, total);
    total -= creditApplied;
  }

  db.prepare(`INSERT INTO invoices (id,ownership_id,customer_id,period_start,period_end,subtotal_cents,discount_cents,store_credit_cents,total_cents,status)
              VALUES (?,?,?,?,?,?,?,?,?,'OPEN')`)
    .run(invoiceId, ownershipId, customer.id, periodStart, periodEnd, subtotal, discount, creditApplied, total);

  for (const r of lineRows) {
    insLine.run(r.id, invoiceId, ownershipId, r.line_type, r.enrollment_id, r.member_id, r.location_id, r.planet_id, r.level_id, r.description, r.amount_cents);
  }
  const insDisc = db.prepare(`INSERT INTO applied_discounts (id,invoice_line_id,tier_id,amount_cents,explanation) VALUES (?,?,?,?,?)`);
  for (const d of allDiscounts) insDisc.run(uid(), d.line_id, d.tier_id || null, d.amount_cents, d.explanation);

  // Charge
  let txRow = null;
  let status = 'PAID';
  if (total > 0 && channel !== 'CASH') {
    const pm = paymentMethodId
      ? db.prepare('SELECT * FROM payment_methods WHERE id = ? AND customer_id = ?').get(paymentMethodId, customer.id)
      : db.prepare('SELECT * FROM payment_methods WHERE customer_id = ? AND is_default = 1').get(customer.id);
    if (!pm) throw new Error('No payment method on file');
    const result = gatewayCharge({ token: pm.token, amount_cents: total });
    status = result.ok ? 'PAID' : 'FAILED';
    txRow = { id: uid(), payment_method_id: pm.id, status: result.ok ? 'SUCCEEDED' : 'FAILED', failure_code: result.failure_code || null };
    db.prepare(`INSERT INTO transactions (id,ownership_id,invoice_id,payment_method_id,channel,amount_cents,status,failure_code,actor_type)
                VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(txRow.id, ownershipId, invoiceId, pm.id, channel, total, txRow.status, txRow.failure_code, actorType);
    if (!result.ok) throw Object.assign(new Error('Payment declined'), { code: 'PAYMENT_FAILED', invoiceId });
  } else {
    // Cash / fully covered by credit — record a transaction for the audit trail
    txRow = { id: uid(), payment_method_id: null, status: 'SUCCEEDED', failure_code: null };
    db.prepare(`INSERT INTO transactions (id,ownership_id,invoice_id,payment_method_id,channel,amount_cents,status,failure_code,actor_type)
                VALUES (?,?,?,?,?,?,'SUCCEEDED',NULL,?)`)
      .run(txRow.id, ownershipId, invoiceId, null, channel || 'CASH', total, actorType);
  }

  if (creditApplied > 0) {
    db.prepare(`INSERT INTO store_credit_ledger (id,ownership_id,customer_id,amount_cents,reason,origin_transaction_id)
                VALUES (?,?,?,?,'REDEEMED',?)`)
      .run(uid(), ownershipId, customer.id, -creditApplied, txRow.id);
  }

  db.prepare(`UPDATE invoices SET status = ? WHERE id = ?`).run(status, invoiceId);

  // Loyalty: every settled dollar earns points
  const points = awardLoyaltyForSpend(ownershipId, customer.id, total + creditApplied, txRow.id);

  return {
    invoice: db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId),
    transaction: txRow,
    loyalty_points: points,
  };
}

module.exports = { gatewayCharge, settleInvoice, loyaltyBalance, storeCreditBalance, awardLoyaltyForSpend, notify, sendEmail };
