const express = require('express');
const db = require('../db');
const { authenticate, premiumStatus, ah } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /progress/me — the student progress dashboard: per-course lesson
// completion + best exam scores, plus overall totals.
router.get('/me', ah(async (req, res) => {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { active: premiumActive } = await premiumStatus(user.id);

  // Courses for the student's class, plus any course they have touched.
  const courses = await db.all(`
    SELECT DISTINCT c.id, c.title, c.class_level,
           s.name AS subject_name, s.slug AS subject_slug, s.color AS subject_color, s.icon AS subject_icon,
           (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lessons_total
    FROM courses c
    JOIN subjects s ON s.id = c.subject_id
    WHERE c.published = 1 AND (c.class_level = ? OR c.id IN (SELECT course_id FROM lesson_progress WHERE user_id = ?))
    ORDER BY c.class_level, s.name`,
    [user.class_level || -1, user.id]);

  const perCourse = [];
  let lessonsDoneTotal = 0, examsTaken = 0, scoreSum = 0, scoreCount = 0;

  for (const c of courses) {
    const done = await db.get(
      'SELECT COUNT(*) AS c FROM lesson_progress WHERE user_id = ? AND course_id = ?', [user.id, c.id]);
    const exam = await db.get(`
      SELECT COUNT(*) AS attempts,
             MAX(CASE WHEN a.total > 0 THEN (a.score * 100.0 / a.total) ELSE 0 END) AS best_percent
      FROM exam_attempts a JOIN exams e ON e.id = a.exam_id
      WHERE a.user_id = ? AND e.course_id = ?`, [user.id, c.id]);

    const lessonsDone = Number(done.c);
    const lessonsTotal = Number(c.lessons_total);
    const attempts = Number(exam.attempts);
    const best = exam.best_percent !== null && attempts > 0 ? Math.round(Number(exam.best_percent)) : null;

    lessonsDoneTotal += lessonsDone;
    examsTaken += attempts;
    if (best !== null) { scoreSum += best; scoreCount++; }

    perCourse.push({
      course_id: c.id, title: c.title, class_level: c.class_level,
      subject_name: c.subject_name, subject_slug: c.subject_slug,
      subject_color: c.subject_color, subject_icon: c.subject_icon,
      lessons_done: lessonsDone, lessons_total: lessonsTotal,
      percent: lessonsTotal ? Math.round((lessonsDone / lessonsTotal) * 100) : 0,
      exam_attempts: attempts, best_exam_percent: best,
    });
  }

  res.json({
    premium: premiumActive,
    class_level: user.class_level,
    overall: {
      courses_started: perCourse.filter(c => c.lessons_done > 0).length,
      courses_total: perCourse.length,
      lessons_done: lessonsDoneTotal,
      exams_taken: examsTaken,
      average_exam_percent: scoreCount ? Math.round(scoreSum / scoreCount) : null,
    },
    courses: perCourse,
  });
}));

module.exports = router;
