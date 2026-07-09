const express = require('express');
const db = require('../db');
const { uid, nowIso } = require('../db');
const { authenticate, requireTeacher, ah } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireTeacher);

// Teachers may only touch their own courses; admins may touch any.
async function ownCourse(req, res, courseId) {
  const course = await db.get('SELECT * FROM courses WHERE id = ?', [courseId]);
  if (!course) { res.status(404).json({ error: 'Course not found' }); return null; }
  if (req.user.role !== 'ADMIN' && course.teacher_id !== req.user.id) {
    res.status(403).json({ error: 'You can only manage your own courses' });
    return null;
  }
  return course;
}

// ---------------------------------------------------------------------------
// GET /teacher/overview — my courses with engagement stats.
// ---------------------------------------------------------------------------
router.get('/overview', ah(async (req, res) => {
  const mine = req.user.role === 'ADMIN' ? '' : 'AND c.teacher_id = ?';
  const params = req.user.role === 'ADMIN' ? [] : [req.user.id];
  const courses = await db.all(`
    SELECT c.id, c.title, c.class_level, c.published, c.created_at,
           s.name AS subject_name, s.slug AS subject_slug, s.color AS subject_color, s.icon AS subject_icon,
           (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lesson_count,
           (SELECT COUNT(*) FROM exams e WHERE e.course_id = c.id) AS exam_count,
           (SELECT COUNT(DISTINCT lp.user_id) FROM lesson_progress lp WHERE lp.course_id = c.id) AS active_students
    FROM courses c JOIN subjects s ON s.id = c.subject_id
    WHERE 1=1 ${mine}
    ORDER BY c.class_level, s.name`, params);
  const subjects = await db.all('SELECT id, slug, name, icon, color FROM subjects ORDER BY name');
  res.json({
    subjects,
    courses: courses.map(c => ({
      ...c,
      published: !!Number(c.published),
      lesson_count: Number(c.lesson_count),
      exam_count: Number(c.exam_count),
      active_students: Number(c.active_students),
    })),
  });
}));

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------
router.post('/courses', ah(async (req, res) => {
  const { subject_id, class_level, title, description, video_script, bc_curriculum_url } = req.body;
  const cls = Number(class_level);
  if (!subject_id || !title || !cls || cls < 1 || cls > 10) {
    return res.status(400).json({ error: 'Subject, class (1-10) and title are required' });
  }
  if (!(await db.get('SELECT id FROM subjects WHERE id = ?', [subject_id]))) {
    return res.status(400).json({ error: 'Unknown subject' });
  }
  const id = uid();
  await db.run(`INSERT INTO courses (id,subject_id,teacher_id,class_level,title,description,video_script,bc_curriculum_url,published,created_at)
                VALUES (?,?,?,?,?,?,?,?,1,?)`,
    [id, subject_id, req.user.id, cls, title.trim(), description || null, video_script || null, bc_curriculum_url || null, nowIso()]);
  res.status(201).json(await db.get('SELECT * FROM courses WHERE id = ?', [id]));
}));

router.put('/courses/:id', ah(async (req, res) => {
  const course = await ownCourse(req, res, req.params.id);
  if (!course) return;
  const { title, description, class_level, published, video_script, bc_curriculum_url } = req.body;
  await db.run(`UPDATE courses SET title = ?, description = ?, class_level = ?, published = ?, video_script = ?, bc_curriculum_url = ? WHERE id = ?`,
    [title ?? course.title, description ?? course.description,
     Number(class_level ?? course.class_level),
     published === undefined ? course.published : (published ? 1 : 0),
     video_script ?? course.video_script,
     bc_curriculum_url ?? course.bc_curriculum_url,
     course.id]);
  res.json(await db.get('SELECT * FROM courses WHERE id = ?', [course.id]));
}));

router.delete('/courses/:id', ah(async (req, res) => {
  const course = await ownCourse(req, res, req.params.id);
  if (!course) return;
  const exams = await db.all('SELECT id FROM exams WHERE course_id = ?', [course.id]);
  for (const e of exams) {
    await db.run('DELETE FROM exam_attempts WHERE exam_id = ?', [e.id]);
    await db.run('DELETE FROM exam_questions WHERE exam_id = ?', [e.id]);
  }
  await db.run('DELETE FROM exams WHERE course_id = ?', [course.id]);
  await db.run('DELETE FROM lesson_progress WHERE course_id = ?', [course.id]);
  await db.run('DELETE FROM lessons WHERE course_id = ?', [course.id]);
  await db.run('DELETE FROM courses WHERE id = ?', [course.id]);
  res.json({ success: true });
}));

// ---------------------------------------------------------------------------
// Curriculum (lessons)
// ---------------------------------------------------------------------------
router.get('/courses/:id/content', ah(async (req, res) => {
  const course = await ownCourse(req, res, req.params.id);
  if (!course) return;
  const lessons = await db.all('SELECT * FROM lessons WHERE course_id = ? ORDER BY position', [course.id]);
  const exams = await db.all('SELECT * FROM exams WHERE course_id = ? ORDER BY position', [course.id]);
  const questions = {};
  for (const e of exams) {
    questions[e.id] = await db.all('SELECT * FROM exam_questions WHERE exam_id = ? ORDER BY position', [e.id]);
  }
  res.json({ course, lessons, exams, questions });
}));

router.post('/courses/:id/lessons', ah(async (req, res) => {
  const course = await ownCourse(req, res, req.params.id);
  if (!course) return;
  const { title, content, video_url, duration_minutes } = req.body;
  if (!title) return res.status(400).json({ error: 'Lesson title is required' });
  const max = await db.get('SELECT COALESCE(MAX(position),0) AS p FROM lessons WHERE course_id = ?', [course.id]);
  const id = uid();
  await db.run('INSERT INTO lessons (id,course_id,title,content,video_url,duration_minutes,position) VALUES (?,?,?,?,?,?,?)',
    [id, course.id, title.trim(), content || null, video_url || null, Number(duration_minutes) || 30, Number(max.p) + 1]);
  res.status(201).json(await db.get('SELECT * FROM lessons WHERE id = ?', [id]));
}));

router.put('/lessons/:id', ah(async (req, res) => {
  const lesson = await db.get('SELECT * FROM lessons WHERE id = ?', [req.params.id]);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  const course = await ownCourse(req, res, lesson.course_id);
  if (!course) return;
  const { title, content, video_url, duration_minutes } = req.body;
  await db.run('UPDATE lessons SET title = ?, content = ?, video_url = ?, duration_minutes = ? WHERE id = ?',
    [title ?? lesson.title, content ?? lesson.content, video_url ?? lesson.video_url,
     Number(duration_minutes ?? lesson.duration_minutes), lesson.id]);
  res.json(await db.get('SELECT * FROM lessons WHERE id = ?', [lesson.id]));
}));

router.delete('/lessons/:id', ah(async (req, res) => {
  const lesson = await db.get('SELECT * FROM lessons WHERE id = ?', [req.params.id]);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  const course = await ownCourse(req, res, lesson.course_id);
  if (!course) return;
  await db.run('DELETE FROM lesson_progress WHERE lesson_id = ?', [lesson.id]);
  await db.run('DELETE FROM lessons WHERE id = ?', [lesson.id]);
  res.json({ success: true });
}));

// ---------------------------------------------------------------------------
// Exams + questions
// ---------------------------------------------------------------------------
router.post('/courses/:id/exams', ah(async (req, res) => {
  const course = await ownCourse(req, res, req.params.id);
  if (!course) return;
  const { title, duration_minutes } = req.body;
  if (!title) return res.status(400).json({ error: 'Exam title is required' });
  const max = await db.get('SELECT COALESCE(MAX(position),0) AS p FROM exams WHERE course_id = ?', [course.id]);
  const id = uid();
  await db.run('INSERT INTO exams (id,course_id,title,duration_minutes,position) VALUES (?,?,?,?,?)',
    [id, course.id, title.trim(), Number(duration_minutes) || 20, Number(max.p) + 1]);
  res.status(201).json(await db.get('SELECT * FROM exams WHERE id = ?', [id]));
}));

router.delete('/exams/:id', ah(async (req, res) => {
  const exam = await db.get('SELECT * FROM exams WHERE id = ?', [req.params.id]);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  const course = await ownCourse(req, res, exam.course_id);
  if (!course) return;
  await db.run('DELETE FROM exam_attempts WHERE exam_id = ?', [exam.id]);
  await db.run('DELETE FROM exam_questions WHERE exam_id = ?', [exam.id]);
  await db.run('DELETE FROM exams WHERE id = ?', [exam.id]);
  res.json({ success: true });
}));

router.post('/exams/:id/questions', ah(async (req, res) => {
  const exam = await db.get('SELECT * FROM exams WHERE id = ?', [req.params.id]);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });
  const course = await ownCourse(req, res, exam.course_id);
  if (!course) return;
  const { question, options, correct_index, marks } = req.body;
  if (!question || !Array.isArray(options) || options.length !== 4 || options.some(o => !o)) {
    return res.status(400).json({ error: 'A question and exactly 4 options are required' });
  }
  const ci = Number(correct_index);
  if (!(ci >= 0 && ci <= 3)) return res.status(400).json({ error: 'correct_index must be 0-3' });
  const max = await db.get('SELECT COALESCE(MAX(position),0) AS p FROM exam_questions WHERE exam_id = ?', [exam.id]);
  const id = uid();
  await db.run(`INSERT INTO exam_questions (id,exam_id,question,option_a,option_b,option_c,option_d,correct_index,marks,position)
                VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, exam.id, question.trim(), options[0], options[1], options[2], options[3], ci, Number(marks) || 1, Number(max.p) + 1]);
  res.status(201).json(await db.get('SELECT * FROM exam_questions WHERE id = ?', [id]));
}));

router.delete('/questions/:id', ah(async (req, res) => {
  const q = await db.get('SELECT * FROM exam_questions WHERE id = ?', [req.params.id]);
  if (!q) return res.status(404).json({ error: 'Question not found' });
  const exam = await db.get('SELECT * FROM exams WHERE id = ?', [q.exam_id]);
  const course = await ownCourse(req, res, exam.course_id);
  if (!course) return;
  await db.run('DELETE FROM exam_questions WHERE id = ?', [q.id]);
  res.json({ success: true });
}));

// ---------------------------------------------------------------------------
// GET /teacher/courses/:id/students — per-student progress for a course.
// ---------------------------------------------------------------------------
router.get('/courses/:id/students', ah(async (req, res) => {
  const course = await ownCourse(req, res, req.params.id);
  if (!course) return;
  const lessonTotal = Number((await db.get('SELECT COUNT(*) AS c FROM lessons WHERE course_id = ?', [course.id])).c);
  const students = await db.all(`
    SELECT u.id, u.name, u.email, u.class_level, u.is_premium,
           COUNT(lp.lesson_id) AS lessons_done,
           MAX(lp.completed_at) AS last_active
    FROM lesson_progress lp JOIN users u ON u.id = lp.user_id
    WHERE lp.course_id = ?
    GROUP BY u.id, u.name, u.email, u.class_level, u.is_premium
    ORDER BY lessons_done DESC`, [course.id]);

  const result = [];
  for (const s of students) {
    const best = await db.get(`
      SELECT MAX(CASE WHEN a.total > 0 THEN (a.score * 100.0 / a.total) ELSE 0 END) AS best_percent,
             COUNT(*) AS attempts
      FROM exam_attempts a JOIN exams e ON e.id = a.exam_id
      WHERE a.user_id = ? AND e.course_id = ?`, [s.id, course.id]);
    result.push({
      ...s,
      is_premium: !!Number(s.is_premium),
      lessons_done: Number(s.lessons_done),
      lessons_total: lessonTotal,
      progress_percent: lessonTotal ? Math.round((Number(s.lessons_done) / lessonTotal) * 100) : 0,
      best_exam_percent: best && best.best_percent !== null ? Math.round(Number(best.best_percent)) : null,
      exam_attempts: best ? Number(best.attempts) : 0,
    });
  }
  res.json({ course: { id: course.id, title: course.title }, students: result });
}));

module.exports = router;
