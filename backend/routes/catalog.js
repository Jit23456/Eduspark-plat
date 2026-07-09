const express = require('express');
const db = require('../db');
const { maybeAuthenticate, premiumStatus, ah } = require('../middleware/auth');

const router = express.Router();

// GET /catalog/subjects — the 8 subjects with course counts.
router.get('/subjects', ah(async (_req, res) => {
  const subjects = await db.all(`
    SELECT s.id, s.slug, s.name, s.icon, s.color, s.description, COUNT(c.id) AS course_count
    FROM subjects s LEFT JOIN courses c ON c.subject_id = s.id AND c.published = 1
    GROUP BY s.id, s.slug, s.name, s.icon, s.color, s.description
    ORDER BY s.name`);
  res.json(subjects.map(s => ({ ...s, course_count: Number(s.course_count) })));
}));

// GET /catalog/courses?subject=math&class_level=6
// Course cards are public; content stays locked behind premium.
router.get('/courses', maybeAuthenticate, ah(async (req, res) => {
  const { subject, class_level } = req.query;
  const where = ['c.published = 1'];
  const params = [];
  if (subject) { where.push('s.slug = ?'); params.push(subject); }
  if (class_level) { where.push('c.class_level = ?'); params.push(Number(class_level)); }

  const rows = await db.all(`
    SELECT c.id, c.title, c.description, c.class_level, c.created_at,
           s.slug AS subject_slug, s.name AS subject_name, s.icon AS subject_icon, s.color AS subject_color,
           u.name AS teacher_name,
           (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lesson_count,
           (SELECT COUNT(*) FROM exams e WHERE e.course_id = c.id) AS exam_count
    FROM courses c
    JOIN subjects s ON s.id = c.subject_id
    JOIN users u ON u.id = c.teacher_id
    WHERE ${where.join(' AND ')}
    ORDER BY c.class_level, s.name`, params);

  let premiumActive = false;
  if (req.user) premiumActive = (await premiumStatus(req.user.id)).active;

  res.json({
    premium: premiumActive,
    courses: rows.map(c => ({
      ...c,
      lesson_count: Number(c.lesson_count),
      exam_count: Number(c.exam_count),
      locked: !premiumActive,
    })),
  });
}));

module.exports = router;
