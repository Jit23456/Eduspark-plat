const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'eduspark_dev_secret_change_me';

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET, { expiresIn: '7d' }
  );
}

// Express 4 does not catch rejected async handlers: wrap every async route.
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function authenticate(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Please sign in to continue' });
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ error: 'Session expired — please sign in again' });
    req.user = payload;
    next();
  });
}

// Attaches req.user when a valid token is present; never blocks guests.
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
      return res.status(403).json({ error: 'You do not have access to this area' });
    }
    next();
  };
}

const requireTeacher = requireRole('TEACHER', 'ADMIN');
const requireAdmin = requireRole('ADMIN');

// Premium status is always read fresh from the DB (never trusted from the
// JWT) so an upgrade unlocks content immediately and expiry locks it again.
async function premiumStatus(userId) {
  const u = await db.get('SELECT role, is_premium, premium_expires_at FROM users WHERE id = ?', [userId]);
  if (!u) return { active: false, user: null };
  if (u.role === 'TEACHER' || u.role === 'ADMIN') return { active: true, user: u };
  const active = !!Number(u.is_premium) &&
    (!u.premium_expires_at || u.premium_expires_at > new Date().toISOString());
  return { active, user: u };
}

// Hard gate for course content: non-premium students get 402 with an
// upgrade hint the frontend uses to open the paywall.
const requirePremium = ah(async (req, res, next) => {
  const { active } = await premiumStatus(req.user.id);
  if (!active) {
    return res.status(402).json({
      error: 'This is premium content. Upgrade to Eduspark Premium to unlock every course, exam and progress tracking.',
      premium_required: true,
    });
  }
  next();
});

module.exports = {
  JWT_SECRET, signToken, ah,
  authenticate, maybeAuthenticate,
  requireRole, requireTeacher, requireAdmin,
  requirePremium, premiumStatus,
};
