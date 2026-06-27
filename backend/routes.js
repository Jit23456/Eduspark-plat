const express = require('express');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const db = require('./db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'eduspark_secret_key_12345';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummykey12345',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummysecretkey123456789'
});

// Middleware: Authenticate JWT Token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// Middleware: Require Teacher Role
function requireTeacher(req, res, next) {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Access denied: Teachers only' });
  }
  next();
}

// Middleware: Require Payment (for Students only)
function requirePayment(req, res, next) {
  if (req.user.role === 'student') {
    // Look up latest payment status from DB to prevent client-side JWT tampering
    const user = db.prepare('SELECT has_paid FROM users WHERE id = ?').get(req.user.id);
    if (!user || user.has_paid !== 1) {
      return res.status(403).json({ 
        error: 'Payment required to access this content', 
        paywall: true 
      });
    }
  }
  next();
}

// --- AUTHENTICATION ROUTES ---

// Normal Email/Phone Sign Up Endpoint
router.post('/auth/signup', (req, res) => {
  const { email, phone_number, password, name, role } = req.body;

  if (!password || !name) {
    return res.status(400).json({ error: 'Name and password are required' });
  }
  if (!email && !phone_number) {
    return res.status(400).json({ error: 'Either email or phone number is required' });
  }

  try {
    // 1. Check if user already exists
    if (email) {
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existingUser) {
        return res.status(400).json({ error: 'A user with this email address already exists' });
      }
    }
    if (phone_number) {
      const existingUser = db.prepare('SELECT id FROM users WHERE phone_number = ?').get(phone_number);
      if (existingUser) {
        return res.status(400).json({ error: 'A user with this phone number already exists' });
      }
    }

    // 2. Hash the password securely using standard pbkdf2
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    const passwordHash = `${salt}:${hash}`;

    // 3. Create a unique ID
    const userId = 'local_' + crypto.randomUUID();

    // 4. Default role/payment settings
    const userRole = role === 'teacher' ? 'teacher' : 'student';
    const hasPaid = userRole === 'teacher' ? 1 : 0;

    // Default letter avatar
    const picture = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

    // 5. Insert into DB
    db.prepare('INSERT INTO users (id, email, phone_number, name, picture, password_hash, role, has_paid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(userId, email || null, phone_number || null, name, picture, passwordHash, userRole, hasPaid);

    const user = { id: userId, email: email || null, phone_number: phone_number || null, name, picture, role: userRole, has_paid: hasPaid };

    // 6. Sign JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user });
  } catch (error) {
    console.error('Sign up error:', error);
    res.status(500).json({ error: 'Failed to create user account: ' + error.message });
  }
});

// Normal Email/Phone Sign In Endpoint
router.post('/auth/signin', (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Email/Phone and password are required' });
  }

  try {
    // 1. Lookup user by email OR phone number
    const user = db.prepare('SELECT * FROM users WHERE email = ? OR phone_number = ?').get(identifier, identifier);
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 2. Verify hashed password
    const [salt, storedHash] = user.password_hash.split(':');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    
    if (hash !== storedHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 3. Sign JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user });
  } catch (error) {
    console.error('Sign in error:', error);
    res.status(500).json({ error: 'Authentication failure' });
  }
});

// Google Sign-In Verification Endpoint
router.post('/auth/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: 'Google credential token is required' });
  }

  try {
    let payload;
    
    // If client ID is configured, verify token with Google API
    if (GOOGLE_CLIENT_ID) {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } else {
      // Decode JWT without verification if GOOGLE_CLIENT_ID is not set (for testing purposes)
      // This allows users to test the Google Login button using localhost configurations
      const parts = credential.split('.');
      if (parts.length === 3) {
        payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      } else {
        throw new Error('Invalid JWT format');
      }
    }

    const { sub: googleId, email, name, picture } = payload;

    // Check if user exists, otherwise create
    let user = db.prepare('SELECT * FROM users WHERE id = ?').get(googleId);
    if (!user) {
      const isFirstUser = db.prepare('SELECT COUNT(*) as count FROM users').get().count === 0;
      // Default first user to teacher, otherwise student
      const role = isFirstUser ? 'teacher' : 'student';
      // Default to unpaid for students, paid for teacher
      const has_paid = role === 'teacher' ? 1 : 0;

      db.prepare('INSERT INTO users (id, email, name, picture, role, has_paid) VALUES (?, ?, ?, ?, ?, ?)')
        .run(googleId, email, name, picture, role, has_paid);
      
      user = { id: googleId, email, name, picture, role, has_paid };
    }

    // Sign Session JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(401).json({ error: 'Google authentication failed' });
  }
});

// Mock/Dev Login for easy local testing
router.post('/auth/mock', (req, res) => {
  const { role, hasPaid } = req.body; // 'teacher', 'student-paid', 'student-unpaid'
  let mockUser;

  if (role === 'teacher') {
    mockUser = db.prepare('SELECT * FROM users WHERE id = ?').get('mock_teacher_id');
  } else if (role === 'student' && hasPaid) {
    mockUser = db.prepare('SELECT * FROM users WHERE id = ?').get('mock_paid_student_id');
  } else {
    mockUser = db.prepare('SELECT * FROM users WHERE id = ?').get('mock_unpaid_student_id');
  }

  if (!mockUser) {
    return res.status(404).json({ error: 'Mock user not found' });
  }

  const token = jwt.sign(
    { id: mockUser.id, email: mockUser.email, name: mockUser.name, role: mockUser.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: mockUser });
});

// Get User Profile
router.get('/auth/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// --- PAYMENT ROUTES ---

// Mock payment checkout endpoint
router.post('/payment/mock-checkout', authenticateToken, (req, res) => {
  db.prepare('UPDATE users SET has_paid = 1 WHERE id = ?').run(req.user.id);
  res.json({ success: true, message: 'Payment successful! Account upgraded.' });
});

// Create Razorpay Order
router.post('/payment/razorpay-order', authenticateToken, async (req, res) => {
  const options = {
    amount: 2999 * 100, // INR 2999.00 in paise
    currency: 'INR',
    receipt: `receipt_order_${Date.now()}`
  };

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || keyId === 'rzp_test_dummykey12345' || keyId.includes('dummy')) {
    console.log('Razorpay Key is dummy or missing. Returning dummy order for real checkout attempt.');
    return res.json({
      id: `order_dummy_${Date.now()}`,
      amount: options.amount,
      currency: options.currency,
      key_id: 'rzp_test_dummykey12345',
      mock: false
    });
  }

  try {
    const rzpInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
    const order = await rzpInstance.orders.create(options);
    console.log('Razorpay Real Order Created Successfully:', order.id);
    res.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
      mock: false
    });
  } catch (error) {
    console.error('Razorpay Order Creation Error Details:', error);
    // If real order creation fails, return fallback so frontend checkout widget displays gracefully
    res.json({
      id: `order_dummy_${Date.now()}`,
      amount: options.amount,
      currency: options.currency,
      key_id: keyId,
      mock: false,
      error: 'Order creation warning: ' + (error.description || error.message || 'Check API credentials')
    });
  }
});

// Verify Razorpay Signature
router.post('/payment/razorpay-verify', authenticateToken, (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

  if (!razorpay_payment_id || !razorpay_order_id) {
    return res.status(400).json({ error: 'Payment details are incomplete' });
  }

  // Handle mock checkout validation
  if (razorpay_order_id.startsWith('order_dummy_')) {
    console.log('Verifying mock order. Upgrading student.');
    db.prepare('UPDATE users SET has_paid = 1 WHERE id = ?').run(req.user.id);
    return res.json({ success: true, message: 'Mock payment verified. Account upgraded!' });
  }

  try {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      db.prepare('UPDATE users SET has_paid = 1 WHERE id = ?').run(req.user.id);
      res.json({ success: true, message: 'Payment verified successfully! Account upgraded.' });
    } else {
      res.status(400).json({ error: 'Invalid payment signature. Verification failed.' });
    }
  } catch (error) {
    console.error('Razorpay verification error:', error);
    res.status(500).json({ error: 'Internal verification failure' });
  }
});

// --- COURSE & CURRICULUM ROUTES ---

// Get all courses (Filter by subject and/or class_number)
router.get('/courses', authenticateToken, (req, res) => {
  const { subject, class_number } = req.query;
  let coursesList;
  
  if (subject && class_number) {
    coursesList = db.prepare('SELECT * FROM courses WHERE subject = ? AND class_number = ?')
      .all(subject, class_number);
  } else if (subject) {
    coursesList = db.prepare('SELECT * FROM courses WHERE subject = ?').all(subject);
  } else if (class_number) {
    coursesList = db.prepare('SELECT * FROM courses WHERE class_number = ?').all(class_number);
  } else {
    coursesList = db.prepare('SELECT * FROM courses').all();
  }

  res.json(coursesList);
});

// Get single course details
router.get('/courses/:courseId', authenticateToken, (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.courseId);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  res.json(course);
});

// Get lessons for a course (GATED BY PAYMENT FOR STUDENTS)
router.get('/courses/:courseId/lessons', authenticateToken, requirePayment, (req, res) => {
  const lessons = db.prepare('SELECT id, course_id, title, order_index, day_number FROM lessons WHERE course_id = ? ORDER BY order_index ASC')
    .all(req.params.courseId);
  res.json(lessons);
});

// Get full content of a specific lesson (GATED BY PAYMENT FOR STUDENTS)
router.get('/lessons/:lessonId', authenticateToken, requirePayment, (req, res) => {
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.lessonId);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

  // Get next lesson ID for navigation
  const nextLesson = db.prepare('SELECT id FROM lessons WHERE course_id = ? AND order_index > ? ORDER BY order_index ASC LIMIT 1')
    .get(lesson.course_id, lesson.order_index);

  // Check completion progress
  const completion = db.prepare('SELECT * FROM progress WHERE user_id = ? AND lesson_id = ?')
    .get(req.user.id, lesson.id);

  res.json({
    ...lesson,
    isCompleted: !!completion,
    nextLessonId: nextLesson ? nextLesson.id : null,
    locked: false
  });
});

// Add Lesson (TEACHER ONLY)
router.post('/courses/:courseId/lessons', authenticateToken, requireTeacher, (req, res) => {
  const { title, content, order_index } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  const orderIdx = order_index || (db.prepare('SELECT COUNT(*) as count FROM lessons WHERE course_id = ?').get(req.params.courseId).count + 1);

  const result = db.prepare('INSERT INTO lessons (course_id, title, content, order_index) VALUES (?, ?, ?, ?)')
    .run(req.params.courseId, title, content, orderIdx);

  res.status(201).json({
    id: result.lastInsertRowid,
    course_id: Number(req.params.courseId),
    title,
    content,
    order_index: orderIdx
  });
});

// Update Lesson (TEACHER ONLY)
router.put('/lessons/:lessonId', authenticateToken, requireTeacher, (req, res) => {
  const { title, content, order_index } = req.body;
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.lessonId);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

  const newTitle = title || lesson.title;
  const newContent = content || lesson.content;
  const newOrder = order_index !== undefined ? order_index : lesson.order_index;

  db.prepare('UPDATE lessons SET title = ?, content = ?, order_index = ? WHERE id = ?')
    .run(newTitle, newContent, newOrder, req.params.lessonId);

  res.json({
    id: Number(req.params.lessonId),
    course_id: lesson.course_id,
    title: newTitle,
    content: newContent,
    order_index: newOrder
  });
});

// Delete Lesson (TEACHER ONLY)
router.delete('/lessons/:lessonId', authenticateToken, requireTeacher, (req, res) => {
  const result = db.prepare('DELETE FROM lessons WHERE id = ?').run(req.params.lessonId);
  if (result.changes === 0) return res.status(404).json({ error: 'Lesson not found' });
  res.json({ success: true, message: 'Lesson deleted successfully' });
});

// --- EXAM & QUIZ ROUTES ---

// Get exam details for a course
router.get('/courses/:courseId/exams', authenticateToken, (req, res) => {
  const exams = db.prepare('SELECT * FROM exams WHERE course_id = ?').all(req.params.courseId);
  res.json(exams);
});

// Get quiz questions (GATED BY PAYMENT FOR STUDENTS)
router.get('/exams/:examId/questions', authenticateToken, requirePayment, (req, res) => {
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.examId);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });

  const questions = db.prepare('SELECT id, question_text, options FROM questions WHERE exam_id = ?')
    .all(req.params.examId);

  // Parse JSON options
  const formattedQuestions = questions.map(q => ({
    ...q,
    options: JSON.parse(q.options)
  }));

  res.json({
    exam,
    questions: formattedQuestions
  });
});

// Create Quiz (TEACHER ONLY)
router.post('/courses/:courseId/exams', authenticateToken, requireTeacher, (req, res) => {
  const { title, description, questions } = req.body; // questions: [{text, options: ["A", "B"...], correct: 0}]
  if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'Title and at least one question are required' });
  }

  // Transaction for atomic insertions
  const insertTransaction = db.transaction(() => {
    const examResult = db.prepare('INSERT INTO exams (course_id, title, description) VALUES (?, ?, ?)')
      .run(req.params.courseId, title, description || '');
    const examId = examResult.lastInsertRowid;

    const questionInsert = db.prepare('INSERT INTO questions (exam_id, question_text, options, correct_option) VALUES (?, ?, ?, ?)');
    questions.forEach(q => {
      questionInsert.run(examId, q.question_text, JSON.stringify(q.options), q.correct_option);
    });

    return examId;
  });

  try {
    const examId = insertTransaction();
    res.status(201).json({ id: examId, title, description, message: 'Exam created successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create exam: ' + err.message });
  }
});

// Submit Quiz Answers (GATED BY PAYMENT FOR STUDENTS)
router.post('/exams/:examId/submit', authenticateToken, requirePayment, (req, res) => {
  const { answers } = req.body; // Object: { [questionId]: selectedOptionIndex }
  if (!answers) return res.status(400).json({ error: 'Answers are required' });

  const questions = db.prepare('SELECT id, correct_option FROM questions WHERE exam_id = ?')
    .all(req.params.examId);

  if (questions.length === 0) return res.status(404).json({ error: 'Exam has no questions' });

  let score = 0;
  questions.forEach(q => {
    if (answers[q.id] !== undefined && Number(answers[q.id]) === q.correct_option) {
      score++;
    }
  });

  // Save submission
  db.prepare('INSERT INTO submissions (user_id, exam_id, score, total_questions, answers) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, req.params.examId, score, questions.length, JSON.stringify(answers));

  res.json({
    score,
    total: questions.length,
    percentage: Math.round((score / questions.length) * 100),
    success: true
  });
});

// --- STUDENT PROGRESS TRACKING ROUTES ---

// Mark a lesson as completed
router.post('/progress/complete-lesson', authenticateToken, (req, res) => {
  const { lessonId } = req.body;
  if (!lessonId) return res.status(400).json({ error: 'Lesson ID is required' });

  try {
    db.prepare('INSERT OR IGNORE INTO progress (user_id, lesson_id) VALUES (?, ?)').run(req.user.id, lessonId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete lesson' });
  }
});

// Remove completion mark for a lesson (toggle off)
router.post('/progress/uncomplete-lesson', authenticateToken, (req, res) => {
  const { lessonId } = req.body;
  if (!lessonId) return res.status(400).json({ error: 'Lesson ID is required' });

  try {
    db.prepare('DELETE FROM progress WHERE user_id = ? AND lesson_id = ?').run(req.user.id, lessonId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to uncomplete lesson' });
  }
});

// Get User Progress Metrics (For Dashboard Charts)
router.get('/progress', authenticateToken, (req, res) => {
  const userId = req.user.id;

  // 1. Total lessons completed
  const completedLessons = db.prepare(`
    SELECT l.id, l.course_id, c.subject, c.class_number 
    FROM progress p
    JOIN lessons l ON p.lesson_id = l.id
    JOIN courses c ON l.course_id = c.id
    WHERE p.user_id = ?
  `).all(userId);

  // 2. Exam submissions and performance
  const examSubmissions = db.prepare(`
    SELECT s.id, s.score, s.total_questions, s.submitted_at, e.title, c.subject, c.class_number
    FROM submissions s
    JOIN exams e ON s.exam_id = e.id
    JOIN courses c ON e.course_id = c.id
    WHERE s.user_id = ?
    ORDER BY s.submitted_at DESC
  `).all(userId);

  // Calculate subject completion rates (Completed lessons / Total lessons)
  const allLessons = db.prepare(`
    SELECT l.id, c.subject, c.class_number
    FROM lessons l
    JOIN courses c ON l.course_id = c.id
  `).all();

  // Compute breakdown per subject
  const subjects = ['geography', 'history', 'math', 'physics', 'chemistry', 'biology', 'computer_science', 'english'];
  const breakdown = subjects.map(sub => {
    const totalSubLessons = allLessons.filter(l => l.subject === sub).length;
    const completedSubLessons = completedLessons.filter(l => l.subject === sub).length;
    const completionRate = totalSubLessons > 0 ? Math.round((completedSubLessons / totalSubLessons) * 100) : 0;

    const subSubmissions = examSubmissions.filter(s => s.subject === sub);
    let avgExamScore = 0;
    if (subSubmissions.length > 0) {
      const sum = subSubmissions.reduce((acc, curr) => acc + (curr.score / curr.total_questions), 0);
      avgExamScore = Math.round((sum / subSubmissions.length) * 100);
    }

    return {
      subject: sub,
      completedCount: completedSubLessons,
      totalCount: totalSubLessons,
      percentComplete: completionRate,
      averageGrade: avgExamScore
    };
  });

  res.json({
    completedLessonsCount: completedLessons.length,
    completedLessonIds: completedLessons.map(l => l.id),
    examAttemptsCount: examSubmissions.length,
    subjectProgress: breakdown,
    recentExams: examSubmissions.slice(0, 5)
  });
});

// --- TEACHER / ADMIN ROUTES ---

// List all students and their metadata (TEACHER ONLY)
router.get('/admin/students', authenticateToken, requireTeacher, (req, res) => {
  // Fetch users with role 'student'
  const students = db.prepare(`
    SELECT id, email, name, picture, has_paid, created_at FROM users WHERE role = 'student'
  `).all();

  // For each student, get completed lessons count and quiz average
  const studentsWithStats = students.map(student => {
    const completed = db.prepare('SELECT COUNT(*) as count FROM progress WHERE user_id = ?').get(student.id).count;
    const subs = db.prepare('SELECT score, total_questions FROM submissions WHERE user_id = ?').all(student.id);
    
    let quizAvg = 0;
    if (subs.length > 0) {
      const totalPct = subs.reduce((acc, curr) => acc + (curr.score / curr.total_questions), 0);
      quizAvg = Math.round((totalPct / subs.length) * 100);
    }

    return {
      ...student,
      lessonsCompleted: completed,
      quizAverage: quizAvg,
      quizCount: subs.length
    };
  });

  res.json(studentsWithStats);
});

// Toggle student payment status (TEACHER ONLY)
router.put('/admin/students/:userId/payment', authenticateToken, requireTeacher, (req, res) => {
  const { has_paid } = req.body;
  if (has_paid === undefined) {
    return res.status(400).json({ error: 'has_paid boolean value is required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('UPDATE users SET has_paid = ? WHERE id = ?').run(has_paid ? 1 : 0, req.params.userId);
  res.json({ success: true, message: `Payment status updated for student ${user.name}` });
});

module.exports = router;
