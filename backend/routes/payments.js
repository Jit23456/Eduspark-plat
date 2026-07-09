const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const db = require('../db');
const { uid, nowIso } = require('../db');
const { authenticate, ah, premiumStatus } = require('../middleware/auth');

const router = express.Router();

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const LIVE = !!(KEY_ID && KEY_SECRET);
const razorpay = LIVE ? new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET }) : null;

// One premium: unlocks every course, every class, every subject.
const PLANS = {
  MONTHLY: { id: 'MONTHLY', label: 'Premium Monthly', amount_paise: 19900, days: 31, tagline: 'Full access, billed monthly' },
  YEARLY: { id: 'YEARLY', label: 'Premium Yearly', amount_paise: 149900, days: 366, tagline: '2 months free — best value' },
};

router.get('/plans', (_req, res) => {
  res.json({
    mock: !LIVE,
    key_id: KEY_ID || null,
    plans: Object.values(PLANS),
    note: LIVE ? null : 'Razorpay keys not set — running in demo checkout mode. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env for real payments.',
  });
});

// ---------------------------------------------------------------------------
// POST /payments/create-order — creates a Razorpay order (or a mock order
// when no gateway keys are configured, so the flow is fully demoable).
// ---------------------------------------------------------------------------
router.post('/create-order', authenticate, ah(async (req, res) => {
  const plan = PLANS[req.body.plan];
  if (!plan) return res.status(400).json({ error: 'Unknown plan' });

  let orderId, gateway;
  if (LIVE) {
    try {
      const order = await razorpay.orders.create({
        amount: plan.amount_paise,
        currency: 'INR',
        receipt: `edsp_${Date.now()}`,
        notes: { user_id: req.user.id, plan: plan.id },
      });
      orderId = order.id;
      gateway = 'RAZORPAY';
    } catch (e) {
      // Invalid/expired gateway keys: fall back to the demo checkout so the
      // premium flow keeps working. Fix RAZORPAY_KEY_* in backend/.env.
      console.warn('Razorpay order failed (check RAZORPAY_KEY_ID/SECRET), using demo checkout:',
        (e && e.error && e.error.description) || e.message || e);
      orderId = 'order_mock_' + uid().slice(0, 12);
      gateway = 'MOCK';
    }
  } else {
    orderId = 'order_mock_' + uid().slice(0, 12);
    gateway = 'MOCK';
  }

  await db.run(`INSERT INTO payments (id,user_id,order_id,plan,amount_paise,currency,status,gateway,created_at)
                VALUES (?,?,?,?,?,'INR','CREATED',?,?)`,
    [uid(), req.user.id, orderId, plan.id, plan.amount_paise, gateway, nowIso()]);

  res.json({
    order_id: orderId,
    amount_paise: plan.amount_paise,
    currency: 'INR',
    key_id: KEY_ID || null,
    mock: gateway === 'MOCK',
    plan: plan.id,
    prefill: { name: req.user.name, email: req.user.email },
  });
}));

// ---------------------------------------------------------------------------
// POST /payments/verify — verifies the Razorpay signature (HMAC-SHA256 of
// "order_id|payment_id") and activates premium on the account.
// ---------------------------------------------------------------------------
router.post('/verify', authenticate, ah(async (req, res) => {
  const { order_id, payment_id, signature } = req.body;
  const payment = await db.get('SELECT * FROM payments WHERE order_id = ? AND user_id = ?', [order_id, req.user.id]);
  if (!payment) return res.status(404).json({ error: 'Order not found' });
  if (payment.status === 'PAID') return res.status(400).json({ error: 'This order is already paid' });

  if (payment.gateway === 'RAZORPAY') {
    const expected = crypto.createHmac('sha256', KEY_SECRET).update(`${order_id}|${payment_id}`).digest('hex');
    if (expected !== signature) {
      await db.run('UPDATE payments SET status = ? WHERE id = ?', ['FAILED', payment.id]);
      return res.status(400).json({ error: 'Payment verification failed. If money was deducted it will be auto-refunded by Razorpay.' });
    }
  }
  // MOCK gateway orders are accepted as-is (demo checkout).

  const plan = PLANS[payment.plan] || PLANS.MONTHLY;
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  // Extend from the current expiry when renewing early.
  const base = user.premium_expires_at && user.premium_expires_at > nowIso()
    ? new Date(user.premium_expires_at) : new Date();
  const expires = new Date(base.getTime() + plan.days * 24 * 3600 * 1000).toISOString();

  await db.run('UPDATE payments SET status = ?, payment_id = ? WHERE id = ?', ['PAID', payment_id || 'pay_mock', payment.id]);
  await db.run('UPDATE users SET is_premium = 1, premium_plan = ?, premium_expires_at = ? WHERE id = ?',
    [plan.id, expires, user.id]);

  const { active } = await premiumStatus(user.id);
  res.json({
    success: true,
    is_premium: active,
    premium_plan: plan.id,
    premium_expires_at: expires,
    message: `Welcome to Eduspark Premium! Every course in every class is now unlocked.`,
  });
}));

// GET /payments/history — my payments.
router.get('/history', authenticate, ah(async (req, res) => {
  res.json(await db.all(
    'SELECT id, order_id, payment_id, plan, amount_paise, currency, status, gateway, created_at FROM payments WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id]));
}));

module.exports = router;
