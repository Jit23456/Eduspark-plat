-- Eduspark schema for Supabase (run in SQL editor, or let the backend create it automatically via SUPABASE_DB_URL)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  google_id TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('STUDENT','TEACHER','ADMIN')),
  class_level INTEGER,
  is_premium INTEGER NOT NULL DEFAULT 0,
  premium_plan TEXT,
  premium_expires_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  teacher_id TEXT NOT NULL REFERENCES users(id),
  class_level INTEGER NOT NULL CHECK (class_level BETWEEN 1 AND 10),
  title TEXT NOT NULL,
  description TEXT,
  video_script TEXT,
  bc_curriculum_url TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  title TEXT NOT NULL,
  content TEXT,
  video_url TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  position INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  title TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 20,
  position INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS exam_questions (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id),
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_index INTEGER NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  marks INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  answers TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id TEXT NOT NULL REFERENCES users(id),
  lesson_id TEXT NOT NULL REFERENCES lessons(id),
  course_id TEXT NOT NULL REFERENCES courses(id),
  completed_at TEXT NOT NULL,
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  order_id TEXT NOT NULL,
  payment_id TEXT,
  plan TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED','PAID','FAILED')),
  gateway TEXT NOT NULL DEFAULT 'RAZORPAY',
  created_at TEXT NOT NULL
);
