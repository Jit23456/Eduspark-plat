const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'fvca_dev_secret_change_me';

const FRANCHISOR_ROLES = ['FRANCHISOR_MANAGEMENT', 'FRANCHISOR_ADMIN'];
const ADMIN_ROLES = [...FRANCHISOR_ROLES, 'FRANCHISEE_MANAGEMENT', 'FRANCHISEE_ADMIN'];
const MANAGEMENT_ROLES = ['FRANCHISOR_MANAGEMENT', 'FRANCHISEE_MANAGEMENT'];

function signToken(user) {
  return jwt.sign(
    {
      id: user.id, email: user.email, name: user.name,
      role: user.role, ownership_id: user.ownership_id,
      must_reset_password: !!user.must_reset_password,
    },
    JWT_SECRET, { expiresIn: '7d' }
  );
}

function authenticate(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token missing' });
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = payload;
    next();
  });
}

// Optional auth: attaches req.user when a valid token is present, never blocks.
function maybeAuthenticate(req, _res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch { /* guest */ }
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied for role ' + (req.user ? req.user.role : 'guest') });
    }
    next();
  };
}

const requireFranchisor = requireRole(...FRANCHISOR_ROLES);
const requireAdmin = requireRole(...ADMIN_ROLES);
const requireManagement = requireRole(...MANAGEMENT_ROLES);
const requireCoach = requireRole('COACH', ...ADMIN_ROLES);
const requireCustomer = requireRole('CUSTOMER');

function isFranchisor(user) { return FRANCHISOR_ROLES.includes(user.role); }

// Tenancy scope: franchisor principals see everything (aggregate reporting);
// everyone else is limited to their own ownership.
function scopeOwnership(user) {
  return isFranchisor(user) || user.role === 'SYSTEM' ? null : user.ownership_id;
}

function getCustomerForUser(userId) {
  return db.prepare('SELECT * FROM customers WHERE user_id = ?').get(userId);
}

// ------------------------------ PII masking --------------------------------
function maskString(v) {
  if (!v) return v;
  const s = String(v);
  if (s.includes('@')) {
    const [a, b] = s.split('@');
    return (a[0] || '*') + '****@' + b;
  }
  if (s.length <= 4) return '****';
  return '****' + s.slice(-3);
}

function maskDate(v) { return v ? '**/**/' + String(v).slice(0, 4).replace(/\d{2}$/, '**') : v; }

function maskCustomer(c) {
  if (!c) return c;
  return {
    ...c,
    dob: maskDate(c.dob), gender: c.gender ? '****' : null,
    phone: maskString(c.phone), emergency_contact: maskString(c.emergency_contact),
  };
}

function maskMember(m) {
  if (!m) return m;
  return {
    ...m,
    dob: maskDate(m.dob), gender: m.gender ? '****' : null,
    email: maskString(m.email), emergency_contact: maskString(m.emergency_contact),
  };
}

// Step-up 2FA: to see/edit unmasked PII the customer must have verified a code
// sent to the phone number registered on the profile within the last 10 min.
const PII_WINDOW_MS = 10 * 60 * 1000;
const piiVerifiedAt = new Map(); // userId -> timestamp

function markPiiVerified(userId) { piiVerifiedAt.set(userId, Date.now()); }
function hasPiiAccess(userId) {
  const t = piiVerifiedAt.get(userId);
  return !!t && Date.now() - t < PII_WINDOW_MS;
}

module.exports = {
  JWT_SECRET, signToken, authenticate, maybeAuthenticate,
  requireRole, requireFranchisor, requireAdmin, requireManagement, requireCoach, requireCustomer,
  isFranchisor, scopeOwnership, getCustomerForUser,
  maskCustomer, maskMember, maskString,
  markPiiVerified, hasPiiAccess,
  FRANCHISOR_ROLES, ADMIN_ROLES,
};
