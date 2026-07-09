const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, 'fvca.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Schema — Fraser Valley Chess Academy platform
// Vocabulary: Ownership (corporate / franchisee) -> Location
//             Customer (account holder) -> Member (learner profile)
//             Planet -> Level -> Course -> CourseVariant (setting x frequency)
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS ownerships (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('CORPORATE','FRANCHISEE')),
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  name TEXT NOT NULL,
  address1 TEXT NOT NULL,
  address2 TEXT,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  country TEXT NOT NULL,
  postal TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS holidays (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  location_id TEXT REFERENCES locations(id),      -- NULL = all locations of ownership
  date TEXT NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN (
    'FRANCHISOR_MANAGEMENT','FRANCHISOR_ADMIN',
    'FRANCHISEE_MANAGEMENT','FRANCHISEE_ADMIN',
    'COACH','EVENT_MANAGER','CUSTOMER','SYSTEM')),
  ownership_id TEXT REFERENCES ownerships(id),
  name TEXT NOT NULL,
  must_reset_password INTEGER NOT NULL DEFAULT 0, -- temp-password flow for staff accounts
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS two_factor_codes (
  user_id TEXT NOT NULL REFERENCES users(id),
  code TEXT NOT NULL,
  purpose TEXT NOT NULL,          -- 'PII'
  expires_at TEXT NOT NULL,
  PRIMARY KEY (user_id, purpose)
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  full_name TEXT NOT NULL,
  dob TEXT NOT NULL,              -- masked (PII)
  gender TEXT,                    -- masked (PII)
  phone TEXT NOT NULL,            -- masked (PII)
  emergency_contact TEXT NOT NULL,-- masked (PII)
  cfc_id TEXT,
  nearest_location_id TEXT NOT NULL REFERENCES locations(id),
  tnc_accepted_at TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customer_locations (
  customer_id TEXT NOT NULL REFERENCES customers(id),
  location_id TEXT NOT NULL REFERENCES locations(id),
  PRIMARY KEY (customer_id, location_id)
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  is_self INTEGER NOT NULL DEFAULT 0,     -- "Register me as a member as well"
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob TEXT,                               -- masked (PII)
  gender TEXT,                            -- masked (PII)
  grade TEXT,
  email TEXT,                             -- only if separate from parent; masked
  emergency_contact TEXT,                 -- masked (PII)
  cfc_id TEXT,                            -- chess products only
  fide_id TEXT,
  tshirt_size TEXT,
  preferred_color TEXT,
  setup_fee_paid_at TEXT,                 -- one-time member setup fee marker
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------ Catalog -----------------------------------
CREATE TABLE IF NOT EXISTS planets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS levels (
  id TEXT PRIMARY KEY,
  planet_id TEXT NOT NULL REFERENCES planets(id),
  name TEXT NOT NULL,
  level_order INTEGER NOT NULL,
  overview TEXT                            -- module overview / highlights
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  level_id TEXT NOT NULL REFERENCES levels(id),
  image_url TEXT,
  session_minutes INTEGER NOT NULL,        -- Pre-K/Elem 60, Middle 90, High 90/120
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS course_variants (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  class_setting TEXT NOT NULL CHECK (class_setting IN ('GROUP','PRIVATE')),
  sessions_per_week INTEGER NOT NULL DEFAULT 1,
  list_price_cents INTEGER NOT NULL,        -- franchisor monthly rate
  currency TEXT NOT NULL DEFAULT 'CAD'
);

-- Which courses each location offers, with optional approved local price
CREATE TABLE IF NOT EXISTS offerings (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  location_id TEXT NOT NULL REFERENCES locations(id),
  variant_id TEXT NOT NULL REFERENCES course_variants(id),
  local_price_cents INTEGER,                -- NULL = franchisor rate applies
  active INTEGER NOT NULL DEFAULT 1
);

-- Weekly schedule slots (batches); public sees remaining seat count
CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  offering_id TEXT NOT NULL REFERENCES offerings(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

-- --------------------------- Enrollment -----------------------------------
CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  offering_id TEXT NOT NULL REFERENCES offerings(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','NOTICE_GIVEN','CANCELLED','PAUSED')),
  start_date TEXT NOT NULL,
  cancellation_notice_at TEXT,              -- 15-day notice clock starts here
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS enrollment_slots (
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  batch_id TEXT NOT NULL REFERENCES batches(id),
  PRIMARY KEY (enrollment_id, batch_id)
);

-- Franchisor-configurable discount tiers (user-stories Rules 1-3)
CREATE TABLE IF NOT EXISTS discount_tiers (
  id TEXT PRIMARY KEY,
  rule_type TEXT NOT NULL CHECK (rule_type IN
    ('GROUP_FREQUENCY','MULTI_PLANET','PRIVATE_FREQUENCY')),
  threshold_count INTEGER NOT NULL,          -- sessions/week or planet count
  percent REAL NOT NULL,
  UNIQUE (rule_type, threshold_count)
);

CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------ Billing ------------------------------------
-- No PAN is ever stored: only the gateway token + display metadata (SAQ-A).
CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  gateway TEXT NOT NULL DEFAULT 'MOCK',
  token TEXT NOT NULL,
  brand TEXT, last4 TEXT, exp_month INTEGER, exp_year INTEGER,
  is_default INTEGER NOT NULL DEFAULT 0,
  saved_for_recurring INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  period_start TEXT, period_end TEXT,        -- NULL for one-off (events, merch)
  subtotal_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  store_credit_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','PAID','FAILED','DUNNING','VOID','REFUNDED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  line_type TEXT NOT NULL CHECK (line_type IN
    ('COURSE','SETUP_FEE','EVENT_ENTRY','PLAY_UP_FEE','CFC_ID_FEE',
     'MERCHANDISE','CAMP','REFUND_FEE','SUB_EVENT')),
  enrollment_id TEXT REFERENCES enrollments(id),
  member_id TEXT REFERENCES members(id),
  location_id TEXT REFERENCES locations(id),  -- for revenue reporting
  planet_id TEXT REFERENCES planets(id),
  level_id TEXT REFERENCES levels(id),
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS applied_discounts (
  id TEXT PRIMARY KEY,
  invoice_line_id TEXT NOT NULL REFERENCES invoice_lines(id),
  tier_id TEXT REFERENCES discount_tiers(id),
  amount_cents INTEGER NOT NULL,
  explanation TEXT NOT NULL                  -- '3 planets: -10%', 'Twice weekly: -25%'
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  payment_method_id TEXT REFERENCES payment_methods(id),
  channel TEXT NOT NULL CHECK (channel IN ('CARD_ONLINE','CARD_ON_FILE','POS','CASH')),
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SUCCEEDED','FAILED','REFUNDED')),
  failure_code TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('SYSTEM','ADMIN','CUSTOMER')),
  attempt_no INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cancellation credits are free; cash-back refunds incur the refund fee.
-- Every cancellation credit must tie back to the original transaction.
CREATE TABLE IF NOT EXISTS store_credit_ledger (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  amount_cents INTEGER NOT NULL,             -- negative = spent
  reason TEXT NOT NULL CHECK (reason IN ('CANCELLATION','ADMIN_GRANT','REDEEMED','LOYALTY_REDEEM')),
  origin_transaction_id TEXT REFERENCES transactions(id),
  granted_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (reason <> 'CANCELLATION' OR origin_transaction_id IS NOT NULL)
);

-- Append-only: balance is SUM(points). $1 spent = LOYALTY_EARN points.
CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  points INTEGER NOT NULL,                   -- negative = redemption
  reason TEXT NOT NULL CHECK (reason IN ('SPEND','WELCOME_BONUS','REDEEM','ADJUST')),
  source_ref TEXT,                           -- transaction id for SPEND (idempotency)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (reason, source_ref)
);

-- ----------------------------- Scheduling ----------------------------------
CREATE TABLE IF NOT EXISTS coach_availability (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  coach_user_id TEXT NOT NULL REFERENCES users(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT                          -- NULL = carries over automatically
);

CREATE TABLE IF NOT EXISTS coach_leaves (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  coach_user_id TEXT NOT NULL REFERENCES users(id),
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  note TEXT
);

-- Staff roster: generated 2 weeks ahead, honors holidays + leaves
CREATE TABLE IF NOT EXISTS roster (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  location_id TEXT NOT NULL REFERENCES locations(id),
  batch_id TEXT NOT NULL REFERENCES batches(id),
  coach_user_id TEXT NOT NULL REFERENCES users(id),
  work_date TEXT NOT NULL,
  published_at TEXT,
  UNIQUE (batch_id, work_date)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  batch_id TEXT NOT NULL REFERENCES batches(id),
  coach_user_id TEXT REFERENCES users(id),
  session_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED'
    CHECK (status IN ('SCHEDULED','COMPLETED','CANCELLED','HOLIDAY')),
  UNIQUE (batch_id, session_date)
);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  session_id TEXT NOT NULL REFERENCES sessions(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  status TEXT NOT NULL DEFAULT 'EXPECTED'
    CHECK (status IN ('EXPECTED','PRESENT','ABSENT','LATE','MAKEUP','TRIAL')),
  marked_by TEXT,
  marked_at TEXT,
  UNIQUE (session_id, member_id)
);

CREATE TABLE IF NOT EXISTS session_notes (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  session_id TEXT NOT NULL REFERENCES sessions(id),
  member_id TEXT REFERENCES members(id),     -- NULL = whole class
  topics_covered TEXT,
  homework_assigned TEXT,
  homework_done INTEGER,
  coach_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------- Trials ------------------------------------
CREATE TABLE IF NOT EXISTS trials (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  batch_id TEXT NOT NULL REFERENCES batches(id),
  trial_date TEXT NOT NULL,
  member_id TEXT REFERENCES members(id),     -- NULL for guests pre-account
  guest_name TEXT, guest_email TEXT, guest_phone TEXT,
  status TEXT NOT NULL DEFAULT 'BOOKED'
    CHECK (status IN ('BOOKED','ATTENDED','NO_SHOW','CONVERTED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trial_assessments (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  trial_id TEXT NOT NULL UNIQUE REFERENCES trials(id),
  coach_user_id TEXT NOT NULL REFERENCES users(id),
  feedback TEXT NOT NULL,
  attachment_url TEXT,
  recommended_batch_id TEXT REFERENCES batches(id),
  submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------- Events / Tournaments ----------------------------
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  location_id TEXT REFERENCES locations(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('TOURNAMENT','CAMP','CLUB','OTHER')),
  name TEXT NOT NULL,
  description TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  rounds INTEGER,
  max_byes INTEGER,                          -- byes cannot use the last round
  fide_required INTEGER NOT NULL DEFAULT 0,
  play_up_allowed INTEGER NOT NULL DEFAULT 0,
  play_up_fee_cents INTEGER,                 -- editable per tournament
  cfc_id_fee_cents INTEGER,                  -- surcharge when we procure a CFC ID
  prize_text TEXT,
  public_list_enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PLANNED'
    CHECK (status IN ('PLANNED','LIVE','CLOSED','ARCHIVED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Early Bird / Standard / Rush pricing; effective phase resolved by date
CREATE TABLE IF NOT EXISTS event_price_phases (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  phase_type TEXT NOT NULL CHECK (phase_type IN ('EARLY_BIRD','STANDARD','RUSH')),
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  UNIQUE (event_id, phase_type)
);

CREATE TABLE IF NOT EXISTS event_sections (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id),
  name TEXT NOT NULL,                        -- 'U1000', 'U1500', 'Open'
  min_rating INTEGER, max_rating INTEGER,
  prize_text TEXT
);

CREATE TABLE IF NOT EXISTS event_registrations (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  event_id TEXT NOT NULL REFERENCES events(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  section_id TEXT REFERENCES event_sections(id),
  bye_rounds TEXT,                           -- JSON array of round numbers
  play_up INTEGER NOT NULL DEFAULT 0,
  cfc_id_requested INTEGER NOT NULL DEFAULT 0,
  tshirt_size TEXT,
  interac_email TEXT,
  car_plate TEXT,
  phase_type TEXT,
  price_paid_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, member_id)
);

-- ---------------------- Franchise operations -------------------------------
CREATE TABLE IF NOT EXISTS price_change_requests (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),  -- requesting franchisee
  variant_id TEXT NOT NULL REFERENCES course_variants(id),
  franchisor_rate_cents INTEGER NOT NULL,     -- snapshot of rate at request time
  requested_rate_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  attachments TEXT,                            -- JSON array of file names
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED','WITHDRAWN')),
  decided_by TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  location_id TEXT REFERENCES locations(id),
  category TEXT NOT NULL CHECK (category IN ('IT','NON_IT')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,                         -- PAYMENT_FAILED, MISSED_CLASS, EVENT, INFO
  message TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Failed registration attempts due to full slots (management report)
CREATE TABLE IF NOT EXISTS registration_attempts (
  id TEXT PRIMARY KEY,
  ownership_id TEXT NOT NULL REFERENCES ownerships(id),
  location_id TEXT REFERENCES locations(id),
  batch_id TEXT REFERENCES batches(id),
  variant_id TEXT REFERENCES course_variants(id),
  reason TEXT NOT NULL DEFAULT 'FULL',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const uid = () => crypto.randomUUID();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const check = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

function getConfig(key, fallback = null) {
  const row = db.prepare('SELECT value FROM system_config WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function getConfigInt(key, fallback = 0) {
  const v = getConfig(key);
  return v === null ? fallback : parseInt(v, 10);
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
function seed() {
  if (db.prepare('SELECT COUNT(*) AS c FROM ownerships').get().c > 0) return;
  console.log('Seeding FVCA demo data...');

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    // Ownerships & locations
    const corpId = uid();
    const franId = uid();
    db.prepare(`INSERT INTO ownerships (id,type,name,owner_name,owner_email) VALUES (?,?,?,?,?)`)
      .run(corpId, 'CORPORATE', 'FVCA Corporate', 'Head Office', 'management@fvca.ca');
    db.prepare(`INSERT INTO ownerships (id,type,name,owner_name,owner_email) VALUES (?,?,?,?,?)`)
      .run(franId, 'FRANCHISEE', 'FVCA Surrey Franchise', 'Priya Sharma', 'surrey.mgmt@fvca.ca');

    const locAbby = uid(), locLangley = uid(), locSurrey = uid();
    const insLoc = db.prepare(`INSERT INTO locations (id,ownership_id,name,address1,address2,city,province,country,postal) VALUES (?,?,?,?,?,?,?,?,?)`);
    insLoc.run(locAbby, corpId, 'Abbotsford HQ', '2020 Marshall Rd', null, 'Abbotsford', 'BC', 'Canada', 'V2S 1A1');
    insLoc.run(locLangley, corpId, 'Langley Centre', '8700 Glover Rd', 'Unit 4', 'Langley', 'BC', 'Canada', 'V1M 2R6');
    insLoc.run(locSurrey, franId, 'Surrey Central', '10153 King George Blvd', null, 'Surrey', 'BC', 'Canada', 'V3T 2W1');

    // Holidays
    const insHol = db.prepare(`INSERT INTO holidays (id,ownership_id,location_id,date,name) VALUES (?,?,?,?,?)`);
    insHol.run(uid(), corpId, null, '2026-07-01', 'Canada Day');
    insHol.run(uid(), corpId, null, '2026-08-03', 'BC Day');
    insHol.run(uid(), franId, null, '2026-08-03', 'BC Day');

    // Users
    const pw = hashPassword('Password123!');
    const insUser = db.prepare(`INSERT INTO users (id,email,phone,password_hash,role,ownership_id,name,must_reset_password) VALUES (?,?,?,?,?,?,?,?)`);
    const uMgmt = uid(), uAdmin = uid(), uFranMgmt = uid(), uFranAdmin = uid();
    const uCoach = uid(), uCoach2 = uid(), uCoachSurrey = uid(), uCustomer = uid(), uSystem = uid();
    insUser.run(uMgmt, 'management@fvca.ca', '+1-604-555-0100', pw, 'FRANCHISOR_MANAGEMENT', corpId, 'Head Office', 0);
    insUser.run(uAdmin, 'admin@fvca.ca', '+1-604-555-0101', pw, 'FRANCHISOR_ADMIN', corpId, 'Corporate Admin', 0);
    insUser.run(uFranMgmt, 'surrey.mgmt@fvca.ca', '+1-604-555-0200', pw, 'FRANCHISEE_MANAGEMENT', franId, 'Priya Sharma', 0);
    insUser.run(uFranAdmin, 'surrey.admin@fvca.ca', '+1-604-555-0201', pw, 'FRANCHISEE_ADMIN', franId, 'Surrey Admin', 0);
    insUser.run(uCoach, 'coach@fvca.ca', '+1-604-555-0300', pw, 'COACH', corpId, 'GM Aleks Petrov', 0);
    insUser.run(uCoach2, 'coach2@fvca.ca', '+1-604-555-0301', pw, 'COACH', corpId, 'Ms. Emily Watts', 0);
    insUser.run(uCoachSurrey, 'coach.surrey@fvca.ca', '+1-604-555-0302', pw, 'COACH', franId, 'IM Daniel Cho', 0);
    insUser.run(uCustomer, 'parent@example.com', '+1-604-555-0400', pw, 'CUSTOMER', corpId, 'Sarah Thompson', 0);
    insUser.run(uSystem, 'system@internal.fvca', null, pw, 'SYSTEM', corpId, 'System Actor', 0);

    // Planets & levels & courses & variants
    const planetDefs = [
      { name: 'Chess', icon: '♞', desc: 'From first moves to tournament mastery — CFC & FIDE pathway.' },
      { name: 'Maths', icon: '∑', desc: 'Grade-aligned mathematics enrichment, Grades 1–10.' },
      { name: 'English', icon: '✎', desc: 'Reading, writing, grammar and public speaking.' },
      { name: 'Finance', icon: '$', desc: 'Money smarts for young minds — saving, investing, entrepreneurship.' },
      { name: 'Fine Arts', icon: '🎨', desc: 'Drawing, painting and creative expression.' },
    ];
    const insPlanet = db.prepare(`INSERT INTO planets (id,name,description,icon) VALUES (?,?,?,?)`);
    const insLevel = db.prepare(`INSERT INTO levels (id,planet_id,name,level_order,overview) VALUES (?,?,?,?,?)`);
    const insCourse = db.prepare(`INSERT INTO courses (id,level_id,image_url,session_minutes) VALUES (?,?,?,?)`);
    const insVariant = db.prepare(`INSERT INTO course_variants (id,course_id,class_setting,sessions_per_week,list_price_cents) VALUES (?,?,?,?,?)`);
    const insOffering = db.prepare(`INSERT INTO offerings (id,ownership_id,location_id,variant_id,local_price_cents) VALUES (?,?,?,?,?)`);
    const insBatch = db.prepare(`INSERT INTO batches (id,ownership_id,offering_id,day_of_week,start_time,capacity) VALUES (?,?,?,?,?,?)`);

    const planetIds = {};
    const allVariants = []; // {variantId, planetName, levelName, groupSetting}
    const levelDefs = {
      Chess: [
        ['Pawn Pioneers (PP)', 'Board basics, piece movement, checkmates in one.', 60, 14900],
        ['Knight Navigators (NK)', 'Tactics: forks, pins, skewers. First rated games.', 60, 15900],
        ['Rook Rangers (RR)', 'Openings, endgame technique, tournament preparation.', 90, 17900],
        ['Wizard Warriors (WW)', 'Advanced strategy, CFC/FIDE tournament pathway.', 90, 19900],
      ],
      Maths: [
        ['Grade 7', 'Integers, fractions, algebraic thinking.', 90, 14900],
        ['Grade 8', 'Linear relations, geometry, data analysis.', 90, 15400],
        ['Grade 10', 'Functions, trigonometry, exam mastery.', 120, 15900],
      ],
      English: [
        ['Young Writers', 'Story craft, grammar foundations.', 60, 13900],
        ['Essay Excellence', 'Persuasive and analytical writing.', 90, 15900],
      ],
      Finance: [
        ['Money Explorers', 'Saving, budgeting, smart spending.', 60, 13900],
      ],
      'Fine Arts': [
        ['Studio Foundations', 'Drawing, colour theory, mixed media.', 60, 13900],
      ],
    };

    for (const p of planetDefs) {
      const pid = uid();
      planetIds[p.name] = pid;
      insPlanet.run(pid, p.name, p.desc, p.icon);
      (levelDefs[p.name] || []).forEach(([lname, overview, minutes, base], i) => {
        const lid = uid();
        insLevel.run(lid, pid, lname, i + 1, overview);
        const cid = uid();
        insCourse.run(cid, lid, null, minutes);
        // Group variants: 1x flat, 2x/3x priced pre-discount from the same base
        for (const freq of [1, 2, 3]) {
          const vid = uid();
          insVariant.run(vid, cid, 'GROUP', freq, base * freq);
          allVariants.push({ vid, planet: p.name, level: lname, setting: 'GROUP', freq });
        }
        // Private variants at ~2.2x the group rate
        for (const freq of [1, 2]) {
          const vid = uid();
          insVariant.run(vid, cid, 'PRIVATE', freq, Math.round(base * 2.2) * freq);
          allVariants.push({ vid, planet: p.name, level: lname, setting: 'PRIVATE', freq });
        }
      });
    }

    // Offerings + batches at each location (group variants only get batches)
    const slots = [
      [1, '16:30'], [2, '17:00'], [3, '16:30'], [4, '18:00'], [6, '10:00'], [6, '13:00'],
    ];
    let slotIdx = 0;
    const locs = [
      { loc: locAbby, own: corpId }, { loc: locLangley, own: corpId }, { loc: locSurrey, own: franId },
    ];
    for (const { loc, own } of locs) {
      for (const v of allVariants) {
        const offId = uid();
        insOffering.run(offId, own, loc, v.vid, null);
        if (v.setting === 'GROUP') {
          const [dow, time] = slots[slotIdx % slots.length];
          slotIdx++;
          insBatch.run(uid(), own, offId, dow, time, v.planet === 'Chess' ? 10 : 8);
          if (v.freq >= 2) {
            const [dow2, time2] = slots[(slotIdx + 2) % slots.length];
            insBatch.run(uid(), own, offId, dow2 === dow ? (dow + 2) % 7 : dow2, time2, 10);
          }
        }
      }
    }

    // Discount tiers (all configurable by franchisor)
    const insTier = db.prepare(`INSERT INTO discount_tiers (id,rule_type,threshold_count,percent) VALUES (?,?,?,?)`);
    insTier.run(uid(), 'GROUP_FREQUENCY', 2, 25);
    insTier.run(uid(), 'GROUP_FREQUENCY', 3, 35);
    insTier.run(uid(), 'MULTI_PLANET', 2, 5);
    insTier.run(uid(), 'MULTI_PLANET', 3, 10);
    insTier.run(uid(), 'MULTI_PLANET', 4, 15);
    insTier.run(uid(), 'MULTI_PLANET', 5, 20);
    insTier.run(uid(), 'PRIVATE_FREQUENCY', 2, 10);
    insTier.run(uid(), 'PRIVATE_FREQUENCY', 3, 15);

    // Config
    const insCfg = db.prepare(`INSERT INTO system_config (key,value) VALUES (?,?)`);
    insCfg.run('MEMBER_SETUP_FEE_CENTS', '2500');
    insCfg.run('REFUND_FEE_CENTS', '2500');
    insCfg.run('LOYALTY_EARN_PER_DOLLAR', '100');
    insCfg.run('LOYALTY_REDEEM_POINTS_PER_DOLLAR', '10000');
    insCfg.run('WELCOME_BONUS_POINTS', '500');
    insCfg.run('CANCEL_NOTICE_DAYS', '15');

    // Demo customer + members
    const custId = uid();
    db.prepare(`INSERT INTO customers (id,user_id,ownership_id,full_name,dob,gender,phone,emergency_contact,cfc_id,nearest_location_id,tnc_accepted_at,consent_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(custId, uCustomer, corpId, 'Sarah Thompson', '1986-04-12', 'Female', '+1-604-555-0400', '+1-604-555-0401', null, locAbby, now, now);
    const insMember = db.prepare(`INSERT INTO members (id,customer_id,ownership_id,is_self,first_name,last_name,dob,gender,grade,emergency_contact,cfc_id,tshirt_size,preferred_color)
                                  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const m1 = uid(), m2 = uid();
    insMember.run(m1, custId, corpId, 0, 'Liam', 'Thompson', '2016-09-02', 'Male', 'Grade 4', '+1-604-555-0401', 'CFC178203', 'YM', 'Blue');
    insMember.run(m2, custId, corpId, 0, 'Ava', 'Thompson', '2013-01-19', 'Female', 'Grade 7', '+1-604-555-0401', null, 'YL', 'Purple');

    // Demo saved card (token only)
    db.prepare(`INSERT INTO payment_methods (id,ownership_id,customer_id,gateway,token,brand,last4,exp_month,exp_year,is_default,saved_for_recurring)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(uid(), corpId, custId, 'MOCK', 'tok_' + uid(), 'Visa', '4242', 12, 2028, 1, 1);

    // Welcome bonus for demo customer
    db.prepare(`INSERT INTO loyalty_ledger (id,ownership_id,customer_id,points,reason,source_ref) VALUES (?,?,?,?,?,?)`)
      .run(uid(), corpId, custId, 500, 'WELCOME_BONUS', custId);

    // Coach availability (weekday afternoons + Saturday)
    const insAvail = db.prepare(`INSERT INTO coach_availability (id,ownership_id,coach_user_id,day_of_week,start_time,end_time,effective_from,effective_to) VALUES (?,?,?,?,?,?,?,?)`);
    for (const cu of [[uCoach, corpId], [uCoach2, corpId], [uCoachSurrey, franId]]) {
      for (const d of [1, 2, 3, 4, 6]) {
        insAvail.run(uid(), cu[1], cu[0], d, d === 6 ? '09:00' : '15:30', d === 6 ? '17:00' : '20:00', '2026-01-01', null);
      }
    }

    // Demo tournament + camp
    const evId = uid();
    db.prepare(`INSERT INTO events (id,ownership_id,location_id,event_type,name,description,start_date,end_date,rounds,max_byes,fide_required,play_up_allowed,play_up_fee_cents,cfc_id_fee_cents,prize_text,status)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(evId, corpId, locAbby, 'TOURNAMENT', 'FV Rapids Summer Open 2026',
           'CFC-rated rapid tournament across three sections. Trophies + cash prizes.',
           '2026-08-15', '2026-08-16', 5, 2, 0, 1, 1500, 2000,
           '1st $300 · 2nd $150 · 3rd $75 per section + trophies', 'LIVE');
    const insPhase = db.prepare(`INSERT INTO event_price_phases (id,event_id,phase_type,starts_on,ends_on,price_cents) VALUES (?,?,?,?,?,?)`);
    insPhase.run(uid(), evId, 'EARLY_BIRD', '2026-06-01', '2026-07-15', 4500);
    insPhase.run(uid(), evId, 'STANDARD', '2026-07-16', '2026-08-08', 6000);
    insPhase.run(uid(), evId, 'RUSH', '2026-08-09', '2026-08-15', 7500);
    const insSection = db.prepare(`INSERT INTO event_sections (id,event_id,name,min_rating,max_rating,prize_text) VALUES (?,?,?,?,?,?)`);
    insSection.run(uid(), evId, 'U1000', null, 999, '1st $150 + trophy');
    insSection.run(uid(), evId, 'U1500', 1000, 1499, '1st $200 + trophy');
    insSection.run(uid(), evId, 'Open', null, null, '1st $300 + trophy');

    const campId = uid();
    db.prepare(`INSERT INTO events (id,ownership_id,location_id,event_type,name,description,start_date,end_date,status)
                VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(campId, corpId, locLangley, 'CAMP', 'August Chess & Maths Day Camp',
           'One-week day camp blending chess strategy with maths puzzles. Ages 6-12.',
           '2026-08-24', '2026-08-28', 'LIVE');
    insPhase.run(uid(), campId, 'EARLY_BIRD', '2026-06-15', '2026-07-31', 24900);
    insPhase.run(uid(), campId, 'STANDARD', '2026-08-01', '2026-08-24', 29900);
  });
  tx();
  console.log('Seed complete.');
}

seed();

module.exports = db;
module.exports.uid = uid;
module.exports.hashPassword = hashPassword;
module.exports.verifyPassword = verifyPassword;
module.exports.getConfig = getConfig;
module.exports.getConfigInt = getConfigInt;
