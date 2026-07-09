const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db');
const { uid, nowIso, hashPassword, verifyPassword } = require('../db');
const { signToken, authenticate, ah, premiumStatus } = require('../middleware/auth');

const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

async function publicUser(u) {
  const { active } = await premiumStatus(u.id);
  return {
    id: u.id, name: u.name, email: u.email, role: u.role,
    class_level: u.class_level, avatar_url: u.avatar_url,
    is_premium: active, premium_plan: u.premium_plan,
    premium_expires_at: u.premium_expires_at,
  };
}

// ---------------------------------------------------------------------------
// POST /auth/register — email + password signup (students pick their class).
// ---------------------------------------------------------------------------
router.post('/register', ah(async (req, res) => {
  const { name, email, password, class_level, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const accountRole = role === 'TEACHER' ? 'TEACHER' : 'STUDENT';
  const cls = accountRole === 'STUDENT' ? Number(class_level) : null;
  if (accountRole === 'STUDENT' && (!cls || cls < 1 || cls > 10)) {
    return res.status(400).json({ error: 'Please choose your class (1 to 10)' });
  }
  if (await db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()])) {
    return res.status(400).json({ error: 'An account with this email already exists' });
  }
  const id = uid();
  await db.run(
    `INSERT INTO users (id,name,email,password_hash,role,class_level,is_premium,created_at)
     VALUES (?,?,?,?,?,?,0,?)`,
    [id, name.trim(), email.toLowerCase(), hashPassword(password), accountRole, cls, nowIso()]
  );
  const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
  res.status(201).json({ token: signToken(user), user: await publicUser(user) });
}));

// ---------------------------------------------------------------------------
// POST /auth/login — email + password.
// ---------------------------------------------------------------------------
router.post('/login', ah(async (req, res) => {
  const { email, password } = req.body;
  const user = await db.get('SELECT * FROM users WHERE email = ?', [(email || '').toLowerCase()]);
  if (!user || !user.password_hash || !verifyPassword(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  res.json({ token: signToken(user), user: await publicUser(user) });
}));

// ---------------------------------------------------------------------------
// POST /auth/google — Google Identity Services ID-token sign-in.
// Creates a student account on first sign-in; links google_id afterwards.
// ---------------------------------------------------------------------------
router.post('/google', ah(async (req, res) => {
  if (!googleClient) {
    return res.status(501).json({
      error: 'Google sign-in is not configured yet. Set GOOGLE_CLIENT_ID in backend/.env and NEXT_PUBLIC_GOOGLE_CLIENT_ID in frontend/.env.local (see backend/.env.example).',
    });
  }
  const { credential, class_level } = req.body;
  if (!credential) return res.status(400).json({ error: 'Missing Google credential' });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: 'Google sign-in could not be verified. Please try again.' });
  }

  const email = payload.email.toLowerCase();
  let user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) {
    const id = uid();
    const cls = Number(class_level) >= 1 && Number(class_level) <= 10 ? Number(class_level) : null;
    await db.run(
      `INSERT INTO users (id,name,email,google_id,avatar_url,role,class_level,is_premium,created_at)
       VALUES (?,?,?,?,?,'STUDENT',?,0,?)`,
      [id, payload.name || email.split('@')[0], email, payload.sub, payload.picture || null, cls, nowIso()]
    );
    user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
  } else if (!user.google_id) {
    await db.run('UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?) WHERE id = ?',
      [payload.sub, payload.picture || null, user.id]);
  }
  res.json({ token: signToken(user), user: await publicUser(user) });
}));

// ---------------------------------------------------------------------------
router.get('/me', authenticate, ah(async (req, res) => {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(await publicUser(user));
}));

// PATCH /auth/profile — update name / class (e.g. after first Google sign-in).
router.patch('/profile', authenticate, ah(async (req, res) => {
  const { name, class_level } = req.body;
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const cls = class_level !== undefined && user.role === 'STUDENT'
    ? Number(class_level) : user.class_level;
  if (user.role === 'STUDENT' && cls !== null && (cls < 1 || cls > 10)) {
    return res.status(400).json({ error: 'Class must be between 1 and 10' });
  }
  await db.run('UPDATE users SET name = ?, class_level = ? WHERE id = ?',
    [(name || user.name).trim(), cls, user.id]);
  const updated = await db.get('SELECT * FROM users WHERE id = ?', [user.id]);
  res.json({ token: signToken(updated), user: await publicUser(updated) });
}));

module.exports = router;
