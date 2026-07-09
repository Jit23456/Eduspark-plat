const express = require('express');
const db = require('../db');
const { uid, nowIso } = require('../db');
const { authenticate, requirePremium, premiumStatus, ah } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /courses/:id — course outline. Everyone signed-in sees the outline
// (lesson titles, exam list); lesson CONTENT and exams stay premium-locked.
// ---------------------------------------------------------------------------
router.get('/:id', ah(async (req, res) => {
  const course = await db.get(`
    SELECT c.*, s.slug AS subject_slug, s.name AS subject_name, s.icon AS subject_icon, s.color AS subject_color,
           u.name AS teacher_name
    FROM courses c JOIN subjects s ON s.id = c.subject_id JOIN users u ON u.id = c.teacher_id
    WHERE c.id = ?`, [req.params.id]);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const { active: premiumActive } = await premiumStatus(req.user.id);

  const lessons = await db.all(
    'SELECT id, title, duration_minutes, position FROM lessons WHERE course_id = ? ORDER BY position', [course.id]);
  const exams = await db.all(`
    SELECT e.id, e.title, e.duration_minutes,
           (SELECT COUNT(*) FROM exam_questions q WHERE q.exam_id = e.id) AS question_count,
           (SELECT SUM(q.marks) FROM exam_questions q WHERE q.exam_id = e.id) AS total_marks
    FROM exams e WHERE e.course_id = ? ORDER BY e.position`, [course.id]);

  const done = await db.all(
    'SELECT lesson_id, completed_at FROM lesson_progress WHERE user_id = ? AND course_id = ?',
    [req.user.id, course.id]);
  const attempts = await db.all(`
    SELECT a.id, a.exam_id, a.score, a.total, a.created_at
    FROM exam_attempts a JOIN exams e ON e.id = a.exam_id
    WHERE a.user_id = ? AND e.course_id = ? ORDER BY a.created_at DESC`, [req.user.id, course.id]);

  res.json({
    course: {
      ...course,
      published: !!Number(course.published),
      // The AI-teacher video narration is premium content like everything else.
      video_script: premiumActive ? course.video_script : null,
    },
    locked: !premiumActive,
    lessons,
    exams: exams.map(e => ({ ...e, question_count: Number(e.question_count), total_marks: Number(e.total_marks || 0) })),
    progress: {
      completed_lesson_ids: done.map(d => d.lesson_id),
      lessons_done: done.length,
      lessons_total: lessons.length,
      percent: lessons.length ? Math.round((done.length / lessons.length) * 100) : 0,
      attempts,
    },
  });
}));

// ---------------------------------------------------------------------------
// Lesson content — PREMIUM ONLY.
// ---------------------------------------------------------------------------
router.get('/:id/lessons/:lessonId', requirePremium, ah(async (req, res) => {
  const lesson = await db.get(
    'SELECT * FROM lessons WHERE id = ? AND course_id = ?', [req.params.lessonId, req.params.id]);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  const completed = await db.get(
    'SELECT completed_at FROM lesson_progress WHERE user_id = ? AND lesson_id = ?',
    [req.user.id, lesson.id]);
  res.json({ ...lesson, completed: !!completed });
}));

router.post('/:id/lessons/:lessonId/complete', requirePremium, ah(async (req, res) => {
  const lesson = await db.get(
    'SELECT id, course_id FROM lessons WHERE id = ? AND course_id = ?', [req.params.lessonId, req.params.id]);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  const existing = await db.get(
    'SELECT completed_at FROM lesson_progress WHERE user_id = ? AND lesson_id = ?', [req.user.id, lesson.id]);
  if (!existing) {
    await db.run('INSERT INTO lesson_progress (user_id, lesson_id, course_id, completed_at) VALUES (?,?,?,?)',
      [req.user.id, lesson.id, lesson.course_id, nowIso()]);
  }
  const done = await db.all('SELECT lesson_id FROM lesson_progress WHERE user_id = ? AND course_id = ?',
    [req.user.id, lesson.course_id]);
  res.json({ success: true, completed_lesson_ids: done.map(d => d.lesson_id) });
}));

// ---------------------------------------------------------------------------
// Exams — PREMIUM ONLY. Questions are served without answers; grading is
// done server-side on submit.
// ---------------------------------------------------------------------------
router.get('/exams/:examId/take', requirePremium, ah(async (req, res) => {
  const exam = await db.get(`
    SELECT e.*, c.title AS course_title, c.id AS course_id
    FROM exams e JOIN courses c ON c.id = e.course_id WHERE e.id = ?`, [req.params.examId]);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  const questions = await db.all(`
    SELECT id, question, option_a, option_b, option_c, option_d, marks, position
    FROM exam_questions WHERE exam_id = ? ORDER BY position`, [exam.id]);
  res.json({ exam, questions });
}));

router.post('/exams/:examId/submit', requirePremium, ah(async (req, res) => {
  const exam = await db.get('SELECT * FROM exams WHERE id = ?', [req.params.examId]);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  const questions = await db.all(
    'SELECT * FROM exam_questions WHERE exam_id = ? ORDER BY position', [exam.id]);
  if (!questions.length) return res.status(400).json({ error: 'This exam has no questions yet' });

  const answers = req.body.answers || {}; // { [questionId]: 0..3 }
  let score = 0, total = 0;
  const review = questions.map(q => {
    total += q.marks;
    const given = answers[q.id];
    const correct = Number(given) === q.correct_index;
    if (correct) score += q.marks;
    return {
      question_id: q.id, question: q.question,
      options: [q.option_a, q.option_b, q.option_c, q.option_d],
      your_answer: given === undefined || given === null ? null : Number(given),
      correct_index: q.correct_index, correct, marks: q.marks,
    };
  });

  const attemptId = uid();
  await db.run(
    'INSERT INTO exam_attempts (id, exam_id, user_id, score, total, answers, created_at) VALUES (?,?,?,?,?,?,?)',
    [attemptId, exam.id, req.user.id, score, total, JSON.stringify(answers), nowIso()]);

  res.json({
    attempt_id: attemptId, score, total,
    percent: total ? Math.round((score / total) * 100) : 0,
    review,
  });
}));

module.exports = router;
