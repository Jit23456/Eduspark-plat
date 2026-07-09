const express = require('express');
const db = require('../db');
const { uid, hashPassword, verifyPassword } = require('../db');
const { signToken, authenticate, markPiiVerified, hasPiiAccess } = require('../middleware/auth');
const { notify, sendEmail } = require('../services/billing');

const router = express.Router();

// ---------------------------------------------------------------------------
// POST /auth/register — public customer registration.
// Creates the account (both mandatory checkboxes required), customer profile,
// member profiles (incl. "register me as a member as well"), optional card
// save, and grants the welcome bonus.
// ---------------------------------------------------------------------------
router.post('/register', (req, res) => {
  const {
    full_name, dob, email, phone, emergency_contact, gender, cfc_id,
    nearest_location_id, accessible_location_ids = [],
    tnc_accepted, account_consent,
    password, confirm_password,
    register_self_as_member = false,
    members = [],           // [{first_name,last_name,dob,gender,grade,email,emergency_contact,cfc_id,tshirt_size,preferred_color}]
    card = null,            // {brand,last4,exp_month,exp_year,token,save_for_future}
  } = req.body;

  if (!tnc_accepted || !account_consent) {
    return res.status(400).json({ error: 'Both the Terms & Conditions and account-creation checkboxes must be checked' });
  }
  if (!full_name || !dob || !email || !phone || !emergency_contact) {
    return res.status(400).json({ error: 'Full name, DOB, email, phone and emergency contact are required' });
  }
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (password !== confirm_password) return res.status(400).json({ error: 'Password and confirm password do not match' });
  if (!nearest_location_id) return res.status(400).json({ error: 'Please choose your nearest location' });

  const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(nearest_location_id);
  if (!loc) return res.status(400).json({ error: 'Unknown location' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(400).json({ error: 'An account with this email already exists' });
  }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    const userId = uid();
    db.prepare(`INSERT INTO users (id,email,phone,password_hash,role,ownership_id,name) VALUES (?,?,?,?,?,?,?)`)
      .run(userId, email, phone, hashPassword(password), 'CUSTOMER', loc.ownership_id, full_name);

    const customerId = uid();
    db.prepare(`INSERT INTO customers (id,user_id,ownership_id,full_name,dob,gender,phone,emergency_contact,cfc_id,nearest_location_id,tnc_accepted_at,consent_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(customerId, userId, loc.ownership_id, full_name, dob, gender || null, phone, emergency_contact, cfc_id || null, nearest_location_id, now, now);

    for (const lid of accessible_location_ids) {
      if (db.prepare('SELECT id FROM locations WHERE id = ?').get(lid)) {
        db.prepare(`INSERT OR IGNORE INTO customer_locations (customer_id,location_id) VALUES (?,?)`).run(customerId, lid);
      }
    }

    const insMember = db.prepare(`INSERT INTO members (id,customer_id,ownership_id,is_self,first_name,last_name,dob,gender,grade,email,emergency_contact,cfc_id,tshirt_size,preferred_color)
                                  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const createdMembers = [];
    if (register_self_as_member) {
      // Basic contact info is copied from the customer profile
      const [first, ...rest] = full_name.split(' ');
      const mid = uid();
      insMember.run(mid, customerId, loc.ownership_id, 1, first, rest.join(' ') || '-', dob, gender || null, null, null, emergency_contact, cfc_id || null, null, null);
      createdMembers.push({ id: mid, first_name: first, is_self: 1 });
    }
    for (const m of members) {
      if (!m.first_name || !m.last_name) continue;
      const mid = uid();
      insMember.run(mid, customerId, loc.ownership_id, 0, m.first_name, m.last_name, m.dob || null, m.gender || null,
        m.grade || null, m.email || null, m.emergency_contact || emergency_contact, m.cfc_id || null,
        m.tshirt_size || null, m.preferred_color || null);
      createdMembers.push({ id: mid, first_name: m.first_name, is_self: 0 });
    }

    if (card && card.token) {
      db.prepare(`INSERT INTO payment_methods (id,ownership_id,customer_id,gateway,token,brand,last4,exp_month,exp_year,is_default,saved_for_recurring)
                  VALUES (?,?,?,?,?,?,?,?,?,1,?)`)
        .run(uid(), loc.ownership_id, customerId, 'MOCK', card.token, card.brand || 'Card', card.last4 || '0000',
             card.exp_month || null, card.exp_year || null, card.save_for_future ? 1 : 0);
    }

    // Welcome bonus loyalty points for every new account
    const bonus = db.getConfigInt('WELCOME_BONUS_POINTS', 500);
    db.prepare(`INSERT INTO loyalty_ledger (id,ownership_id,customer_id,points,reason,source_ref) VALUES (?,?,?,?,'WELCOME_BONUS',?)`)
      .run(uid(), loc.ownership_id, customerId, bonus, customerId);

    return { userId, customerId, createdMembers };
  });

  try {
    const { userId, customerId, createdMembers } = tx();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    notify(userId, 'INFO', `Welcome to Fraser Valley Chess Academy! You earned ${db.getConfigInt('WELCOME_BONUS_POINTS', 500)} welcome bonus points.`);
    sendEmail(email, 'Welcome to FVCA', 'Your account has been created.');
    res.status(201).json({ token: signToken(user), user: publicUser(user), customer_id: customerId, members: createdMembers });
  } catch (e) {
    res.status(500).json({ error: 'Registration failed: ' + e.message });
  }
});

// ---------------------------------------------------------------------------
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email || '');
  if (!user || !verifyPassword(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

// Temp-password flow for staff accounts: must set a new password on first login
router.post('/set-password', authenticate, (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  db.prepare('UPDATE users SET password_hash = ?, must_reset_password = 0 WHERE id = ?')
    .run(hashPassword(new_password), req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const customer = db.prepare('SELECT id, nearest_location_id FROM customers WHERE user_id = ?').get(user.id);
  res.json({ ...publicUser(user), customer_id: customer ? customer.id : null, pii_unlocked: hasPiiAccess(user.id) });
});

// ---------------------------------------------------------------------------
// Step-up 2FA (SMS to the phone registered on the profile) for viewing or
// editing PII. Dev mode returns the code in the response so it can be demoed.
// ---------------------------------------------------------------------------
router.post('/2fa/request', authenticate, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user.phone) return res.status(400).json({ error: 'No phone number registered on this profile. 2FA requires a registered phone number.' });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  db.prepare(`INSERT INTO two_factor_codes (user_id,code,purpose,expires_at) VALUES (?,?,'PII',?)
              ON CONFLICT(user_id,purpose) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at`)
    .run(user.id, code, expires);
  console.log(`[SMS] to=${user.phone} code=${code}`);
  res.json({ sent_to: user.phone.slice(0, 4) + '****' + user.phone.slice(-2), dev_code: process.env.NODE_ENV === 'production' ? undefined : code });
});

router.post('/2fa/verify', authenticate, (req, res) => {
  const { code } = req.body;
  const row = db.prepare(`SELECT * FROM two_factor_codes WHERE user_id = ? AND purpose = 'PII'`).get(req.user.id);
  if (!row || row.code !== String(code) || row.expires_at < new Date().toISOString()) {
    return res.status(400).json({ error: 'Invalid or expired code' });
  }
  db.prepare(`DELETE FROM two_factor_codes WHERE user_id = ? AND purpose = 'PII'`).run(req.user.id);
  markPiiVerified(req.user.id);
  res.json({ success: true, unlocked_minutes: 10 });
});

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, ownership_id: u.ownership_id, must_reset_password: !!u.must_reset_password };
}

module.exports = router;
