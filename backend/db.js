const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'eduspark.db');
const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    phone_number TEXT,
    name TEXT NOT NULL,
    picture TEXT,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'student', -- 'student' or 'teacher'
    has_paid INTEGER NOT NULL DEFAULT 0, -- 0 for unpaid, 1 for paid
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL, -- geography, history, math, physics, biology, computer_science, english
    class_number INTEGER NOT NULL, -- 1 to 10
    title TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL, -- HTML string from TipTap editor
    order_index INTEGER NOT NULL,
    video_url TEXT,
    pdf_url TEXT,
    day_number INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    options TEXT NOT NULL, -- JSON string array, e.g., ["A", "B", "C", "D"]
    correct_option INTEGER NOT NULL, -- 0-based index of correct option
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    exam_id INTEGER NOT NULL,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    answers TEXT NOT NULL, -- JSON string of user answers
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS progress (
    user_id TEXT NOT NULL,
    lesson_id INTEGER NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, lesson_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
  );
`);

// Function to seed database if empty
function seedDatabase() {
  const courseCount = db.prepare('SELECT COUNT(*) as count FROM courses').get().count;
  if (courseCount > 0) {
    console.log('Database already has data. Skipping seed.');
    return;
  }

  console.log('Seeding initial database data...');

  const subjects = [
    { id: 'geography', name: 'Geography', desc: 'Explore the Earth, climate, maps, and cultures.' },
    { id: 'history', name: 'History', desc: 'Journey through ancient civilizations, wars, and world events.' },
    { id: 'math', name: 'Math', desc: 'Master algebra, geometry, calculus, and logic.' },
    { id: 'physics', name: 'Physics', desc: 'Learn the laws of nature, motion, energy, and force.' },
    { id: 'chemistry', name: 'Chemistry', desc: 'Discover chemical reactions, elements, atoms, and molecular structures.' },
    { id: 'biology', name: 'Biology', desc: 'Study living organisms, cells, ecosystems, and anatomy.' },
    { id: 'computer_science', name: 'Computer Science', desc: 'Introduction to programming, algorithms, and technology.' },
    { id: 'english', name: 'English', desc: 'Enhance your grammar, literature, composition, and vocabulary.' }
  ];

  // Insert mock users (including one teacher, one paid student, one unpaid student)
  const insertUser = db.prepare('INSERT OR REPLACE INTO users (id, email, name, picture, role, has_paid) VALUES (?, ?, ?, ?, ?, ?)');
  insertUser.run('mock_teacher_id', 'teacher@eduspark.com', 'Professor Sarah Smith', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', 'teacher', 1);
  insertUser.run('mock_paid_student_id', 'student.paid@eduspark.com', 'Alex Miller (Paid Student)', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150', 'student', 1);
  insertUser.run('mock_unpaid_student_id', 'student.unpaid@eduspark.com', 'Jordan Vance (Unpaid Student)', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'student', 0);

  const insertCourse = db.prepare('INSERT INTO courses (subject, class_number, title, description) VALUES (?, ?, ?, ?)');
  const insertLesson = db.prepare('INSERT INTO lessons (course_id, title, content, order_index, video_url, pdf_url, day_number) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insertExam = db.prepare('INSERT INTO exams (course_id, title, description) VALUES (?, ?, ?)');
  const insertQuestion = db.prepare('INSERT INTO questions (exam_id, question_text, options, correct_option) VALUES (?, ?, ?, ?)');

  // Loop through classes 1 to 10
  for (let classNum = 1; classNum <= 10; classNum++) {
    for (const sub of subjects) {
      const courseTitle = `${sub.name} for Class ${classNum}`;
      const courseDesc = `Standard curriculum for Class ${classNum} ${sub.name}. ${sub.desc}`;
      
      const courseResult = insertCourse.run(sub.id, classNum, courseTitle, courseDesc);
      const courseId = courseResult.lastInsertRowid;

      // Seed 7 lessons representing Day 1 to Day 7 for each course
      const lessonsData = [];
      const topics = [
        { title: 'Introductory Basics', focus: 'foundational guidelines, syllabus outlines, and dictionary definitions' },
        { title: 'Historical Frameworks', focus: 'origins, timeline milestones, historical pioneers, and global expansions' },
        { title: 'Core Theoretical Models', focus: 'principles, structural formulas, scientific hypotheses, and abstractions' },
        { title: 'Practical Demonstrations', focus: 'classroom laboratory experiments, equations, and simulations' },
        { title: 'Real World Applications', focus: 'professional careers, field research tools, and practical exercises' },
        { title: 'Common Misconceptions', focus: 'logical fallacies, critical analysis, myths, and standard reviews' },
        { title: 'Comprehensive Exam Review', focus: 'summaries, downloadable worksheet practices, and test preps' }
      ];

      const youtubeVideos = {
        math: 'https://www.youtube.com/embed/dpUbg244xXk',
        physics: 'https://www.youtube.com/embed/kKKM8Y-u7ds',
        chemistry: 'https://www.youtube.com/embed/rd0fW3wTstU',
        biology: 'https://www.youtube.com/embed/8IlzK7Z5cGg',
        geography: 'https://www.youtube.com/embed/jNQXAC9IVRw',
        history: 'https://www.youtube.com/embed/Yocja_N5s1I',
        computer_science: 'https://www.youtube.com/embed/zOjov-2OZ0E',
        english: 'https://www.youtube.com/embed/14-bE-pE3iQ'
      };

      for (let day = 1; day <= 7; day++) {
        const t = topics[day - 1];
        lessonsData.push({
          title: `Day ${day}: ${t.title} of ${sub.name}`,
          content: `
            <h2>Welcome to Class ${classNum} ${sub.name} &bull; Day ${day}</h2>
            <p>Today we explore the <strong>${t.title}</strong> of ${sub.name}. We will focus specifically on ${t.focus}.</p>
            <h3>Key Study Guidelines:</h3>
            <ul>
              <li>Watch the accompanying video lecture in full.</li>
              <li>Download the PDF worksheet and complete all exercises.</li>
              <li>Take detailed notes for the upcoming chapter exam.</li>
            </ul>
            <blockquote>
              "The beautiful thing about learning is that no one can take it away from you." — B.B. King
            </blockquote>
          `,
          video_url: youtubeVideos[sub.id] || 'https://www.youtube.com/embed/dpUbg244xXk',
          pdf_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          day_number: day
        });
      }

      lessonsData.forEach((l, idx) => {
        insertLesson.run(courseId, l.title, l.content.trim(), idx + 1, l.video_url, l.pdf_url, l.day_number);
      });

      // Seed an exam for each course
      const examTitle = `${sub.name} Chapter 1 Exam`;
      const examDesc = `Test your understanding of the introductory lessons in ${sub.name}.`;
      const examResult = insertExam.run(courseId, examTitle, examDesc);
      const examId = examResult.lastInsertRowid;

      // Seed 3 questions for each exam
      let questionsData = [];
      if (sub.id === 'math') {
        questionsData = [
          {
            text: `What is the value of 5 + (3 * ${classNum})?`,
            options: JSON.stringify([`${5 + 3 * classNum}`, `${(5 + 3) * classNum}`, `${5 * classNum + 3}`, 'None of the above']),
            correct: 0
          },
          {
            text: `Which mathematical property states that: a + b = b + a?`,
            options: JSON.stringify(['Distributive Property', 'Associative Property', 'Commutative Property', 'Identity Property']),
            correct: 2
          },
          {
            text: `If x + ${classNum} = 15, what is the value of x?`,
            options: JSON.stringify([`${15 + classNum}`, `${15 - classNum}`, `${15 * classNum}`, `${(15/classNum).toFixed(1)}`]),
            correct: 1
          }
        ];
      } else if (sub.id === 'physics') {
        questionsData = [
          {
            text: 'What is the SI unit of force?',
            options: JSON.stringify(['Joule', 'Newton', 'Watt', 'Pascal']),
            correct: 1
          },
          {
            text: 'Which law states that action and reaction are equal and opposite?',
            options: JSON.stringify(['Newton\'s First Law', 'Newton\'s Second Law', 'Newton\'s Third Law', 'Law of Gravitation']),
            correct: 2
          },
          {
            text: 'What happens to the speed of light when it enters water from air?',
            options: JSON.stringify(['Increases', 'Decreases', 'Remains the same', 'Becomes zero']),
            correct: 1
          }
        ];
      } else if (sub.id === 'chemistry') {
        questionsData = [
          {
            text: 'What is the chemical symbol for water?',
            options: JSON.stringify(['CO2', 'H2O', 'NaCl', 'O2']),
            correct: 1
          },
          {
            text: 'Which subatomic particle has a negative charge?',
            options: JSON.stringify(['Proton', 'Neutron', 'Electron', 'Positron']),
            correct: 2
          },
          {
            text: 'What is the pH level of pure water?',
            options: JSON.stringify(['5', '7', '9', '14']),
            correct: 1
          }
        ];
      } else if (sub.id === 'computer_science') {
        questionsData = [
          {
            text: 'What does CPU stand for?',
            options: JSON.stringify(['Computer Personal Unit', 'Central Processing Unit', 'Central Processor Utility', 'Core Power Unit']),
            correct: 1
          },
          {
            text: 'Which of the following is an operating system?',
            options: JSON.stringify(['Python', 'Google Chrome', 'Microsoft Windows', 'HTML']),
            correct: 2
          },
          {
            text: 'In programming, what is a boolean?',
            options: JSON.stringify(['A type of loop', 'A text string', 'A variable that can be True or False', 'A decimal number']),
            correct: 2
          }
        ];
      } else {
        // Generic questions for other subjects
        questionsData = [
          {
            text: `Which of the following is core to Class ${classNum} ${sub.name}?`,
            options: JSON.stringify(['The study of systems and structures', 'Memorization of random words', 'Doing complex math without paper', 'None of the above']),
            correct: 0
          },
          {
            text: `True or False: The principles learned in ${sub.name} apply globally.`,
            options: JSON.stringify(['True', 'False']),
            correct: 0
          },
          {
            text: `What is the primary method of evaluation in this ${sub.name} module?`,
            options: JSON.stringify(['Writing an essay', 'Multiple choice quiz', 'Class presentation', 'Oral recitation']),
            correct: 1
          }
        ];
      }

      questionsData.forEach(q => {
        insertQuestion.run(examId, q.text, q.options, q.correct);
      });
    }
  }

  console.log('Seeding completed successfully.');
}

db.seedDatabase = seedDatabase;
seedDatabase();

module.exports = db;
