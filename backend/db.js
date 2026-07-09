const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Eduspark data layer.
// Default: local SQLite (zero-config). Set SUPABASE_DB_URL to your Supabase
// Postgres connection string (Project Settings -> Database -> Connection
// string) and the same queries run against Supabase instead.
// ---------------------------------------------------------------------------
const usePg = !!process.env.SUPABASE_DB_URL;

let sqlite = null;
let pool = null;

if (usePg) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
} else {
  const Database = require('better-sqlite3');
  // Serverless (Vercel) filesystems are read-only except /tmp: the demo DB
  // lives there and reseeds on cold starts. Use Supabase for durable data.
  const dbPath = process.env.VERCEL
    ? path.join('/tmp', 'eduspark.db')
    : path.join(__dirname, 'eduspark.db');
  sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
}

// Placeholders are written as `?` everywhere; translated to $1,$2… for pg.
function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => '$' + ++i);
}

async function all(sql, params = []) {
  if (usePg) return (await pool.query(toPg(sql), params)).rows;
  return sqlite.prepare(sql).all(...params);
}

async function get(sql, params = []) {
  if (usePg) return (await pool.query(toPg(sql), params)).rows[0];
  return sqlite.prepare(sql).get(...params);
}

async function run(sql, params = []) {
  if (usePg) { await pool.query(toPg(sql), params); return; }
  sqlite.prepare(sql).run(...params);
}

async function exec(sql) {
  if (usePg) { await pool.query(sql); return; }
  sqlite.exec(sql);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const uid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

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

// ---------------------------------------------------------------------------
// Schema — kept to the SQL subset shared by SQLite and Postgres.
// Timestamps are set from JS so no dialect-specific defaults are needed.
// ---------------------------------------------------------------------------
const SCHEMA = `
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
`;

// ---------------------------------------------------------------------------
// Seed catalog — 8 subjects x classes 1-10, each course with a curriculum
// band (junior 1-4, middle 5-7, senior 8-10), lessons and one exam.
// ---------------------------------------------------------------------------
const SUBJECTS = [
  { slug: 'math', name: 'Mathematics', icon: 'Calculator', color: '#6366f1', description: 'From counting to calculus-ready: numbers, algebra, geometry and problem solving.' },
  { slug: 'physics', name: 'Physics', icon: 'Atom', color: '#06b6d4', description: 'Forces, energy, electricity and the laws that run the universe.' },
  { slug: 'chemistry', name: 'Chemistry', icon: 'FlaskConical', color: '#f59e0b', description: 'Atoms, reactions and the matter that makes up everything.' },
  { slug: 'biology', name: 'Biology', icon: 'Dna', color: '#10b981', description: 'Cells, plants, the human body and the living world around us.' },
  { slug: 'geography', name: 'Geography', icon: 'Globe2', color: '#3b82f6', description: 'Maps, landforms, climate and how people shape the planet.' },
  { slug: 'history', name: 'History', icon: 'Landmark', color: '#ef4444', description: 'Civilisations, revolutions and the stories that built our world.' },
  { slug: 'computer-science', name: 'Computer Science', icon: 'Cpu', color: '#8b5cf6', description: 'Computers, coding, the internet and future-ready digital skills.' },
  { slug: 'english', name: 'English', icon: 'BookOpen', color: '#ec4899', description: 'Grammar, reading, writing and confident communication.' },
];

// band key by class: 1-4 junior, 5-7 middle, 8-10 senior
const bandOf = (cls) => (cls <= 4 ? 'junior' : cls <= 7 ? 'middle' : 'senior');

const CURRICULUM = {
  math: {
    junior: ['Numbers & Counting', 'Addition & Subtraction', 'Multiplication Basics', 'Shapes & Patterns', 'Measurement & Time'],
    middle: ['Fractions & Decimals', 'Integers & the Number Line', 'Introduction to Algebra', 'Geometry: Angles & Triangles', 'Data Handling & Graphs'],
    senior: ['Linear Equations', 'Polynomials & Factorisation', 'Trigonometry Basics', 'Coordinate Geometry', 'Statistics & Probability'],
  },
  physics: {
    junior: ['Pushes & Pulls: Forces', 'Light & Shadows', 'Sounds Around Us', 'Hot & Cold: Heat', 'Simple Machines'],
    middle: ['Motion & Measurement', 'Electricity & Circuits', 'Magnets & Magnetism', 'Heat & Temperature', 'Light: Reflection'],
    senior: ["Newton's Laws of Motion", 'Work, Energy & Power', "Electricity & Ohm's Law", 'Waves & Sound', 'Light: Refraction & Lenses'],
  },
  chemistry: {
    junior: ['Solids, Liquids & Gases', 'Water & Its Uses', 'Air Around Us', 'Mixing & Separating', 'Everyday Materials'],
    middle: ['Elements & Compounds', 'Physical & Chemical Changes', 'Acids, Bases & Salts', 'Atoms & Molecules', 'Metals & Non-metals'],
    senior: ['Atomic Structure', 'Chemical Reactions & Equations', 'The Periodic Table', 'Carbon & Its Compounds', 'Chemical Bonding'],
  },
  biology: {
    junior: ['Plants Around Us', 'Animals & Their Homes', 'My Amazing Body', 'Food & Nutrition', 'Keeping Healthy'],
    middle: ['The Cell: Unit of Life', 'Human Body Systems', 'Photosynthesis', 'Reproduction in Plants', 'Micro-organisms'],
    senior: ['Life Processes', 'Genetics & Heredity', 'Evolution', 'Human Physiology', 'Ecology & Environment'],
  },
  geography: {
    junior: ['Our Earth', 'Land, Water & Air', 'Maps & Directions', 'Weather & Seasons', 'Our Neighbourhood'],
    middle: ['Latitudes & Longitudes', 'Interior of the Earth', 'Landforms of the Earth', 'Climate & Weather', 'Natural Resources'],
    senior: ['Resources & Development', 'Agriculture', 'Water Resources', 'Industries', 'Population & Settlement'],
  },
  history: {
    junior: ['My Family History', 'Festivals & Traditions', 'Great Leaders', 'Old & New Things', 'Our National Symbols'],
    middle: ['Early Humans', 'Ancient Civilisations', 'The Mauryan Empire', 'Medieval Kingdoms', 'The Mughal Era'],
    senior: ['The Revolt of 1857', 'Nationalism in India', 'The World Wars', 'The French Revolution', 'India After Independence'],
  },
  'computer-science': {
    junior: ['What is a Computer?', 'Parts of a Computer', 'Keyboard & Mouse Skills', 'Paint & Digital Drawing', 'Staying Safe Online'],
    middle: ['Operating Systems', 'Word Processing', 'Spreadsheets', 'Introduction to the Internet', 'Block Coding with Scratch'],
    senior: ['Programming with Python', 'HTML & Web Design', 'Databases & SQL Basics', 'Networking Fundamentals', 'Cyber Security'],
  },
  english: {
    junior: ['Alphabet & Phonics', 'Naming Words: Nouns', 'Action Words: Verbs', 'Simple Sentences', 'Story Time & Reading'],
    middle: ['Parts of Speech', 'Tenses', 'Comprehension Skills', 'Paragraph Writing', 'Poetry Appreciation'],
    senior: ['Grammar Mastery', 'Essay & Letter Writing', 'Literature: Prose & Poetry', 'Reading Comprehension', 'Public Speaking'],
  },
};

// Four seed MCQs per subject per band: [question, [a,b,c,d], correctIndex]
const QUESTIONS = {
  math: {
    junior: [
      ['What is 7 + 5?', ['10', '11', '12', '13'], 2],
      ['Which shape has exactly 3 sides?', ['Square', 'Triangle', 'Circle', 'Rectangle'], 1],
      ['What is 4 × 3?', ['7', '10', '12', '14'], 2],
      ['How many minutes are there in one hour?', ['30', '45', '60', '100'], 2],
    ],
    middle: [
      ['What is 1/2 + 1/4?', ['1/4', '2/6', '3/4', '1'], 2],
      ['What is (−3) + 5?', ['−8', '−2', '2', '8'], 2],
      ['If x + 3 = 10, what is x?', ['3', '7', '10', '13'], 1],
      ['The angles of a triangle add up to…', ['90°', '180°', '270°', '360°'], 1],
    ],
    senior: [
      ['What is the slope of the line y = 2x + 3?', ['3', '2', '5', '1/2'], 1],
      ['Factorise: x² − 9', ['(x−3)(x−3)', '(x+3)(x+3)', '(x−3)(x+3)', 'x(x−9)'], 2],
      ['sin 30° equals…', ['1/2', '√3/2', '1', '0'], 0],
      ['The probability of getting heads on one fair coin toss is…', ['1/4', '1/3', '1/2', '1'], 2],
    ],
  },
  physics: {
    junior: [
      ['A force is a…', ['Push or pull', 'Kind of light', 'Type of sound', 'Colour'], 0],
      ['A shadow forms when light is…', ['Reflected', 'Blocked', 'Bent', 'Coloured'], 1],
      ['Sound is produced by…', ['Heat', 'Vibration', 'Light', 'Magnetism'], 1],
      ['Which of these is a simple machine?', ['Lever', 'Television', 'Cloud', 'Book'], 0],
    ],
    middle: [
      ['The unit of electric current is the…', ['Volt', 'Watt', 'Ampere', 'Ohm'], 2],
      ['A magnet attracts objects made of…', ['Plastic', 'Wood', 'Iron', 'Glass'], 2],
      ['Which of these is a good conductor of electricity?', ['Rubber', 'Copper', 'Wood', 'Paper'], 1],
      ['Speed is calculated as…', ['distance × time', 'distance ÷ time', 'time ÷ distance', 'distance + time'], 1],
    ],
    senior: [
      ["Newton's second law is written as…", ['F = mv', 'F = ma', 'F = m/a', 'F = a/m'], 1],
      ['The SI unit of power is the…', ['Joule', 'Newton', 'Watt', 'Pascal'], 2],
      ["Ohm's law states…", ['V = IR', 'V = I/R', 'V = R/I', 'V = I²R'], 0],
      ['The bending of light as it passes between media is called…', ['Reflection', 'Refraction', 'Diffusion', 'Dispersion'], 1],
    ],
  },
  chemistry: {
    junior: [
      ['Ice is a…', ['Liquid', 'Gas', 'Solid', 'Mixture'], 2],
      ['Which gas in the air do we need to breathe?', ['Carbon dioxide', 'Oxygen', 'Helium', 'Hydrogen'], 1],
      ['What happens when you stir salt into water?', ['It floats', 'It dissolves', 'It burns', 'Nothing'], 1],
      ['Which of these is a natural material?', ['Plastic', 'Nylon', 'Wood', 'Polythene'], 2],
    ],
    middle: [
      ['The chemical formula of water is…', ['CO₂', 'H₂O', 'O₂', 'NaCl'], 1],
      ['Rusting of iron is a…', ['Physical change', 'Chemical change', 'Seasonal change', 'No change'], 1],
      ['Lemon juice tastes sour because it is…', ['Basic', 'Neutral', 'Acidic', 'Salty'], 2],
      ['The smallest particle of an element is a(n)…', ['Molecule', 'Atom', 'Cell', 'Compound'], 1],
    ],
    senior: [
      ['Protons are found in the…', ['Electron cloud', 'Nucleus', 'Shells', 'Orbitals'], 1],
      ['The modern periodic table arranges elements by…', ['Atomic mass', 'Atomic number', 'Density', 'Discovery date'], 1],
      ['CO₂ is the formula of…', ['Carbon monoxide', 'Carbon dioxide', 'Calcium oxide', 'Methane'], 1],
      ['A covalent bond forms when atoms…', ['Transfer electrons', 'Share electrons', 'Lose protons', 'Merge nuclei'], 1],
    ],
  },
  biology: {
    junior: [
      ['Plants make their food mainly in their…', ['Roots', 'Leaves', 'Flowers', 'Stem'], 1],
      ['Which organ pumps blood around the body?', ['Brain', 'Lungs', 'Heart', 'Stomach'], 2],
      ['Where does a fish live?', ['Desert', 'Water', 'Nest', 'Cave'], 1],
      ['Fruits and vegetables are rich in…', ['Plastic', 'Vitamins', 'Metal', 'Sand'], 1],
    ],
    middle: [
      ['The basic unit of life is the…', ['Tissue', 'Organ', 'Cell', 'Organism'], 2],
      ['Photosynthesis needs sunlight, water and…', ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Salt'], 1],
      ['Which organs do we use to breathe?', ['Kidneys', 'Lungs', 'Ears', 'Bones'], 1],
      ['Which of these is a micro-organism?', ['Bacteria', 'Mango tree', 'Sparrow', 'Earthworm'], 0],
    ],
    senior: [
      ['Genes are carried on…', ['Proteins', 'DNA', 'Vitamins', 'Enzymes'], 1],
      ['The “powerhouse of the cell” is the…', ['Nucleus', 'Ribosome', 'Mitochondrion', 'Vacuole'], 2],
      ['The theory of evolution by natural selection was proposed by…', ['Newton', 'Darwin', 'Mendel', 'Einstein'], 1],
      ['In a food chain, green plants are…', ['Consumers', 'Producers', 'Decomposers', 'Predators'], 1],
    ],
  },
  geography: {
    junior: [
      ['The shape of the Earth is closest to a…', ['Cube', 'Sphere', 'Triangle', 'Flat disc'], 1],
      ['How many main directions are there?', ['2', '3', '4', '8'], 2],
      ['The sun rises in the…', ['West', 'North', 'East', 'South'], 2],
      ['A map is a drawing that shows…', ['Only oceans', 'Places and features', 'Only animals', 'The future'], 1],
    ],
    middle: [
      ['The 0° line of latitude is called the…', ['Tropic of Cancer', 'Equator', 'Prime Meridian', 'Arctic Circle'], 1],
      ['The outermost layer of the Earth is the…', ['Core', 'Mantle', 'Crust', 'Magma'], 2],
      ['Which of these is a landform?', ['Mountain', 'Cloud', 'Rainbow', 'Wind'], 0],
      ['Water turning into vapour is called…', ['Condensation', 'Evaporation', 'Precipitation', 'Freezing'], 1],
    ],
    senior: [
      ['Which of these is a renewable resource?', ['Coal', 'Petroleum', 'Solar energy', 'Natural gas'], 2],
      ['Rice is mainly a…', ['Rabi crop', 'Kharif crop', 'Zaid crop', 'Cash-only crop'], 1],
      ['A census mainly counts a country’s…', ['Rivers', 'Population', 'Mountains', 'Forests'], 1],
      ['Turning raw materials into finished goods happens in…', ['Agriculture', 'Industries', 'Fishing', 'Mining only'], 1],
    ],
  },
  history: {
    junior: [
      ['How many colours are on the Indian national flag?', ['2', '3', '4', '5'], 1],
      ['Who is called the “Father of the Nation” in India?', ['Nehru', 'Gandhi', 'Tagore', 'Patel'], 1],
      ['Old and precious things are kept safely in a…', ['Playground', 'Museum', 'Market', 'Stadium'], 1],
      ['Festivals are occasions when people…', ['Stay apart', 'Celebrate together', 'Stop working forever', 'Sleep all day'], 1],
    ],
    middle: [
      ['Early humans first lived in…', ['Skyscrapers', 'Caves', 'Castles', 'Villages'], 1],
      ['Harappa was a city of which civilisation?', ['Egyptian', 'Mesopotamian', 'Indus Valley', 'Greek'], 2],
      ['Ashoka was a famous emperor of the…', ['Mughal empire', 'Mauryan empire', 'Gupta empire', 'Chola empire'], 1],
      ['The Taj Mahal was built by…', ['Akbar', 'Shah Jahan', 'Babur', 'Aurangzeb'], 1],
    ],
    senior: [
      ['The Revolt of 1857 is also called…', ['The Quit India Movement', 'The First War of Independence', 'The Salt March', 'Partition'], 1],
      ['The Second World War ended in…', ['1918', '1939', '1945', '1950'], 2],
      ['The French Revolution began in…', ['1689', '1776', '1789', '1857'], 2],
      ['India became independent in…', ['1942', '1945', '1947', '1950'], 2],
    ],
  },
  'computer-science': {
    junior: [
      ['The “brain” of the computer is the…', ['Monitor', 'CPU', 'Mouse', 'Speaker'], 1],
      ['Which device is used for typing?', ['Keyboard', 'Printer', 'Monitor', 'Speaker'], 0],
      ['The arrow on the screen moved by the mouse is called a…', ['Icon', 'Pointer', 'Window', 'File'], 1],
      ['You should never share your ______ with strangers online.', ['Drawings', 'Password', 'Favourite colour', 'Homework'], 1],
    ],
    middle: [
      ['Which of these is an operating system?', ['Windows', 'MS Word', 'Chrome', 'Paint'], 0],
      ['Which program is best for making tables of numbers?', ['Paint', 'Spreadsheet', 'Media player', 'Notepad'], 1],
      ['WWW stands for…', ['World Wide Web', 'Wide World Web', 'World Web Wide', 'Web World Wide'], 0],
      ['Scratch programs are built using…', ['Text commands only', 'Colourful blocks', 'Spreadsheets', 'Photographs'], 1],
    ],
    senior: [
      ['Python is a…', ['Web browser', 'Programming language', 'Database', 'Computer virus'], 1],
      ['HTML is used to build…', ['Databases', 'Web pages', 'Spreadsheets', 'Networks'], 1],
      ['SQL is used to work with…', ['Images', 'Databases', 'Sound', 'Robots'], 1],
      ['A strong password should contain…', ['Only your name', 'Letters, numbers and symbols', 'Just 123456', 'Your birthday'], 1],
    ],
  },
  english: {
    junior: [
      ['Which word starts with the letter A?', ['Ball', 'Apple', 'Cat', 'Dog'], 1],
      ['“Dog” is a…', ['Verb', 'Noun', 'Adjective', 'Adverb'], 1],
      ['Which of these is an action word?', ['Run', 'Table', 'Blue', 'Happy'], 0],
      ['A sentence always begins with a…', ['Full stop', 'Capital letter', 'Comma', 'Number'], 1],
    ],
    middle: [
      ['In “She sings sweetly”, the word “sweetly” is an…', ['Adjective', 'Adverb', 'Noun', 'Article'], 1],
      ['The past tense of “go” is…', ['Goed', 'Gone', 'Went', 'Going'], 2],
      ['A person who writes poems is called a…', ['Novelist', 'Poet', 'Editor', 'Actor'], 1],
      ['Every paragraph should have one clear…', ['Joke', 'Main idea', 'Picture', 'Rhyme'], 1],
    ],
    senior: [
      ['A good essay has an introduction, a body and a…', ['Riddle', 'Conclusion', 'Recipe', 'Chorus'], 1],
      ['A formal letter usually begins with…', ['Hey!', 'Dear Sir/Madam', 'Yo', 'Once upon a time'], 1],
      ['A comparison using “like” or “as” is called a…', ['Metaphor', 'Simile', 'Idiom', 'Proverb'], 1],
      ['Reading comprehension means…', ['Reading aloud fast', 'Understanding what you read', 'Copying the text', 'Memorising spellings'], 1],
    ],
  },
};

// BC curriculum (curriculum.gov.bc.ca) reference area for each subject.
const BC_AREA = {
  math: 'mathematics',
  physics: 'science',
  chemistry: 'science',
  biology: 'science',
  geography: 'social-studies',
  history: 'social-studies',
  'computer-science': 'adst',
  english: 'english-language-arts',
};
const bcCurriculumUrl = (slug, cls) => `https://curriculum.gov.bc.ca/curriculum/${BC_AREA[slug]}/${cls}/core`;

// Hook line spoken by the AI teacher, per subject.
const SUBJECT_HOOKS = {
  math: 'Numbers are everywhere — from sharing pizza slices with friends to launching rockets into space.',
  physics: 'Physics explains everything that moves, glows, falls and flies — including you on a swing!',
  chemistry: 'Chemistry is like magic you can explain — fizzing, mixing and transforming matter all around us.',
  biology: 'Every leaf, every heartbeat, every butterfly is a biology lesson waiting to be discovered.',
  geography: 'Mountains, rivers, monsoons and maps — geography is the story of our amazing planet.',
  history: 'History is a time machine — we travel to the past to understand our present.',
  'computer-science': 'Computers follow your instructions — learn to code, and you become the one giving them!',
  english: 'Words are your superpower — great readers and speakers can change the world.',
};

// ~150-word narration ≈ one minute of natural speech for the AI teacher video.
function teacherVideoScript(subjectName, slug, cls, topics) {
  return [
    `Hello my dear students, and a very warm welcome to Eduspark! I am your ${subjectName} teacher, and today we begin our journey through Grade ${cls} ${subjectName}.`,
    `This course follows the British Columbia curriculum, so everything you learn here matches what is taught in real classrooms.`,
    SUBJECT_HOOKS[slug],
    `In this grade we will explore ${topics.slice(0, 3).join(', ')}, and much more.`,
    `Watch my hands as I guide you through every idea, step by step — we learn best when we see, hear and do.`,
    `After each lesson, attempt the chapter exam and watch your progress bar grow on your dashboard.`,
    `Remember: every expert was once a beginner. Stay curious, ask questions, and practise a little every day.`,
    `Let us make Grade ${cls} your best year yet. See you in lesson one!`,
  ].join(' ');
}

function lessonContent(subjectName, topic, cls) {
  return [
    `Welcome to "${topic}" — a core chapter of Class ${cls} ${subjectName} at Eduspark.`,
    '',
    `In this lesson you will:`,
    `• Understand the key ideas behind ${topic.toLowerCase()} with simple, age-appropriate explanations.`,
    `• Work through solved examples and real-life applications.`,
    `• Practise with guided questions before attempting the chapter exam.`,
    '',
    `Study tip: read the lesson once, note down new terms, then try to explain ${topic.toLowerCase()} to a friend in your own words. Teaching is the fastest way to learn!`,
    '',
    `When you feel confident, mark this lesson complete and move to the next topic. Your progress is saved automatically to your dashboard.`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Init + seed
// ---------------------------------------------------------------------------
async function seed() {
  const existing = await get('SELECT COUNT(*) AS c FROM subjects');
  if (Number(existing.c) > 0) return;
  console.log('Seeding Eduspark demo data…');
  const now = nowIso();

  // Users
  const teacherId = uid();
  const admin = uid();
  const freeStudent = uid();
  const premiumStudent = uid();
  const insUser = `INSERT INTO users (id,name,email,password_hash,role,class_level,is_premium,premium_plan,premium_expires_at,created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?)`;
  const yearAhead = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
  await run(insUser, [teacherId, 'Ms. Ananya Iyer', 'teacher@eduspark.com', hashPassword('Teacher123!'), 'TEACHER', null, 0, null, null, now]);
  await run(insUser, [admin, 'Eduspark Admin', 'admin@eduspark.com', hashPassword('Admin123!'), 'ADMIN', null, 1, 'YEARLY', yearAhead, now]);
  await run(insUser, [freeStudent, 'Rohan Das', 'student@eduspark.com', hashPassword('Student123!'), 'STUDENT', 6, 0, null, null, now]);
  await run(insUser, [premiumStudent, 'Priya Sharma', 'premium@eduspark.com', hashPassword('Premium123!'), 'STUDENT', 8, 1, 'YEARLY', yearAhead, now]);

  await run(`INSERT INTO payments (id,user_id,order_id,payment_id,plan,amount_paise,currency,status,gateway,created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [uid(), premiumStudent, 'order_seed_demo', 'pay_seed_demo', 'YEARLY', 149900, 'INR', 'PAID', 'MOCK', now]);

  // Subjects + full course catalog
  for (const s of SUBJECTS) {
    const sid = uid();
    await run('INSERT INTO subjects (id,slug,name,icon,color,description) VALUES (?,?,?,?,?,?)',
      [sid, s.slug, s.name, s.icon, s.color, s.description]);

    for (let cls = 1; cls <= 10; cls++) {
      const band = bandOf(cls);
      const topics = CURRICULUM[s.slug][band];
      const courseId = uid();
      await run(`INSERT INTO courses (id,subject_id,teacher_id,class_level,title,description,video_script,bc_curriculum_url,published,created_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [courseId, sid, teacherId, cls,
         `Class ${cls} ${s.name}`,
         `The complete Class ${cls} ${s.name} programme: ${topics.slice(0, 3).join(', ')} and more — structured lessons, chapter exam and progress tracking. Aligned with the BC curriculum.`,
         teacherVideoScript(s.name, s.slug, cls, topics),
         bcCurriculumUrl(s.slug, cls),
         1, now]);

      for (let i = 0; i < topics.length; i++) {
        await run(`INSERT INTO lessons (id,course_id,title,content,video_url,duration_minutes,position)
                   VALUES (?,?,?,?,?,?,?)`,
          [uid(), courseId, topics[i], lessonContent(s.name, topics[i], cls), null, 20 + i * 5, i + 1]);
      }

      const examId = uid();
      await run('INSERT INTO exams (id,course_id,title,duration_minutes,position) VALUES (?,?,?,?,?)',
        [examId, courseId, `Class ${cls} ${s.name} — Chapter Exam`, 15, 1]);
      const qs = QUESTIONS[s.slug][band];
      for (let q = 0; q < qs.length; q++) {
        const [question, opts, correct] = qs[q];
        await run(`INSERT INTO exam_questions (id,exam_id,question,option_a,option_b,option_c,option_d,correct_index,marks,position)
                   VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [uid(), examId, question, opts[0], opts[1], opts[2], opts[3], correct, 1, q + 1]);
      }
    }
  }
  console.log('Seed complete: 8 subjects, 80 courses, 400 lessons, 80 exams.');
}

const ready = (async () => {
  await exec(SCHEMA);
  await seed();
})().catch((e) => {
  console.error('Database init failed:', e);
  throw e;
});

module.exports = {
  all, get, run, exec, ready, usePg,
  uid, nowIso, hashPassword, verifyPassword,
};
