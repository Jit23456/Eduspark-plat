import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'eduspark_secret_key_12345';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mezznnglfgygkecfyacd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lenpubmdsZmd5Z2tlY2Z5YWNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1Mzc1ODgsImV4cCI6MjA5ODExMzU4OH0.D6ppP4obv5d7HyuXoNSI7R1xCWRhjBTX83wMw6_SFtM';

async function supabaseFetch(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...options.headers
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase Error ${res.status}: ${errText}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function verifyJwt(req) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

export async function GET(req, { params }) {
  const routeParams = await params;
  const path = routeParams.route ? routeParams.route.join('/') : '';
  const user = verifyJwt(req);
  const { searchParams } = new URL(req.url);

  try {
    // GET /api/auth/me
    if (path === 'auth/me') {
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const dbUsers = await supabaseFetch(`users?id=eq.${user.id}&select=*`);
      if (!dbUsers || dbUsers.length === 0) {
        return NextResponse.json({ id: user.id, name: user.name, role: user.role, has_paid: user.has_paid || 0 });
      }
      return NextResponse.json(dbUsers[0]);
    }

    // GET /api/courses
    if (path === 'courses') {
      let query = 'courses?select=*';
      const subject = searchParams.get('subject');
      const classNumber = searchParams.get('class_number');
      if (subject) query += `&subject=eq.${subject}`;
      if (classNumber) query += `&class_number=eq.${classNumber}`;
      query += '&order=class_number.asc,subject.asc';
      const courses = await supabaseFetch(query);
      return NextResponse.json(courses || []);
    }

    // GET /api/courses/:id/lessons
    if (path.startsWith('courses/') && path.endsWith('/lessons')) {
      const courseId = path.split('/')[1];
      const lessons = await supabaseFetch(`lessons?course_id=eq.${courseId}&select=id,course_id,title,order_index,day_number&order=order_index.asc`);
      return NextResponse.json(lessons || []);
    }

    // GET /api/courses/:id/exams
    if (path.startsWith('courses/') && path.endsWith('/exams')) {
      const courseId = path.split('/')[1];
      const exams = await supabaseFetch(`exams?course_id=eq.${courseId}&select=*`);
      return NextResponse.json(exams || []);
    }

    // GET /api/courses/:id
    if (path.startsWith('courses/')) {
      const courseId = path.split('/')[1];
      const courses = await supabaseFetch(`courses?id=eq.${courseId}&select=*`);
      if (!courses || courses.length === 0) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
      return NextResponse.json(courses[0]);
    }

    // GET /api/lessons/:id
    if (path.startsWith('lessons/')) {
      const lessonId = path.split('/')[1];
      const lessons = await supabaseFetch(`lessons?id=eq.${lessonId}&select=*`);
      if (!lessons || lessons.length === 0) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
      const lesson = lessons[0];

      let isLocked = false;
      if (user && user.role === 'student') {
        const dbUsers = await supabaseFetch(`users?id=eq.${user.id}&select=has_paid`);
        if (!dbUsers || dbUsers[0]?.has_paid !== 1) {
          isLocked = true;
        }
      }

      if (isLocked) {
        return NextResponse.json({
          id: lesson.id,
          course_id: lesson.course_id,
          title: lesson.title,
          order_index: lesson.order_index,
          day_number: lesson.day_number,
          content: lesson.content,
          locked: true,
          video_url: null,
          pdf_url: null
        });
      }

      return NextResponse.json({ ...lesson, locked: false });
    }

    // GET /api/exams/:id/questions
    if (path.startsWith('exams/') && path.endsWith('/questions')) {
      const examId = path.split('/')[1];
      const exams = await supabaseFetch(`exams?id=eq.${examId}&select=*`);
      if (!exams || exams.length === 0) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
      const questions = await supabaseFetch(`questions?exam_id=eq.${examId}&select=*`);
      const parsedQuestions = (questions || []).map(q => ({
        ...q,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options
      }));
      return NextResponse.json({ ...exams[0], questions: parsedQuestions });
    }

    // GET /api/exams/:id
    if (path.startsWith('exams/')) {
      const examId = path.split('/')[1];
      const exams = await supabaseFetch(`exams?id=eq.${examId}&select=*`);
      if (!exams || exams.length === 0) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
      const questions = await supabaseFetch(`questions?exam_id=eq.${examId}&select=*`);
      const parsedQuestions = (questions || []).map(q => ({
        ...q,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options
      }));
      return NextResponse.json({ ...exams[0], questions: parsedQuestions });
    }

    // GET /api/progress
    if (path === 'progress') {
      if (!user) return NextResponse.json([], { status: 200 });
      const progress = await supabaseFetch(`progress?user_id=eq.${user.id}&select=*`);
      return NextResponse.json(progress || []);
    }

    // GET /api/admin/students
    if (path === 'admin/students') {
      if (!user || user.role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const students = await supabaseFetch(`users?role=eq.student&select=*`);
      return NextResponse.json(students || []);
    }

    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });
  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  const routeParams = await params;
  const path = routeParams.route ? routeParams.route.join('/') : '';
  const body = await req.json().catch(() => ({}));
  const user = verifyJwt(req);

  try {
    // POST /api/auth/mock
    if (path === 'auth/mock') {
      const { role, hasPaid } = body;
      const userRole = role === 'teacher' ? 'teacher' : 'student';
      const userPaid = userRole === 'teacher' ? 1 : (hasPaid ? 1 : 0);
      const userId = userRole === 'teacher' ? 'mock_teacher_id' : (userPaid ? 'mock_paid_student_id' : 'mock_unpaid_student_id');
      const userName = userRole === 'teacher' ? 'Professor Sarah Smith' : (userPaid ? 'Alex Miller (Paid Student)' : 'Jordan Vance (Unpaid Student)');
      const userEmail = userRole === 'teacher' ? 'teacher@eduspark.com' : (userPaid ? 'student.paid@eduspark.com' : 'student.unpaid@eduspark.com');

      const mockUser = { id: userId, email: userEmail, name: userName, role: userRole, has_paid: userPaid };
      const token = jwt.sign(mockUser, JWT_SECRET, { expiresIn: '7d' });
      return NextResponse.json({ token, user: mockUser });
    }

    // POST /api/auth/signin
    if (path === 'auth/signin') {
      const { identifier, password } = body;
      const dbUsers = await supabaseFetch(`users?or=(email.eq.${identifier},phone_number.eq.${identifier})&select=*`);
      if (!dbUsers || dbUsers.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 400 });
      }
      const u = dbUsers[0];
      const token = jwt.sign({ id: u.id, email: u.email, name: u.name, role: u.role, has_paid: u.has_paid }, JWT_SECRET, { expiresIn: '7d' });
      return NextResponse.json({ token, user: u });
    }

    // POST /api/auth/signup
    if (path === 'auth/signup') {
      const { email, phone_number, password, name, role } = body;
      const userId = 'user_' + Date.now();
      const userRole = role === 'teacher' ? 'teacher' : 'student';
      const hasPaid = userRole === 'teacher' ? 1 : 0;
      const picture = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;

      const newUser = { id: userId, email, phone_number, name, picture, role: userRole, has_paid: hasPaid };
      await supabaseFetch('users', { method: 'POST', body: JSON.stringify(newUser) });

      const token = jwt.sign(newUser, JWT_SECRET, { expiresIn: '7d' });
      return NextResponse.json({ token, user: newUser });
    }

    // POST /api/progress
    if (path === 'progress') {
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const { lessonId } = body;
      await supabaseFetch('progress', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ user_id: user.id, lesson_id: lessonId, completed_at: new Date().toISOString() })
      });
      return NextResponse.json({ success: true });
    }

    // POST /api/exams/:id/submit
    if (path.startsWith('exams/') && path.endsWith('/submit')) {
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const examId = path.split('/')[1];
      const { answers } = body;
      const questions = await supabaseFetch(`questions?exam_id=eq.${examId}&select=*`);
      let score = 0;
      (questions || []).forEach(q => {
        if (answers[q.id] !== undefined && Number(answers[q.id]) === q.correct_option) {
          score++;
        }
      });
      const submission = {
        user_id: user.id,
        exam_id: Number(examId),
        score,
        total_questions: (questions || []).length,
        answers: JSON.stringify(answers),
        submitted_at: new Date().toISOString()
      };
      await supabaseFetch('submissions', { method: 'POST', body: JSON.stringify(submission) });
      return NextResponse.json({ score, totalQuestions: (questions || []).length, passed: score >= Math.ceil((questions || []).length / 2) });
    }

    // POST /api/admin/students/:userId/payment
    if (path.startsWith('admin/students/') && path.endsWith('/payment')) {
      if (!user || user.role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const targetUserId = path.split('/')[2];
      const { hasPaid } = body;
      await supabaseFetch(`users?id=eq.${targetUserId}`, {
        method: 'PATCH',
        body: JSON.stringify({ has_paid: hasPaid ? 1 : 0 })
      });
      return NextResponse.json({ success: true });
    }

    // POST /api/courses/:id/lessons
    if (path.startsWith('courses/') && path.endsWith('/lessons')) {
      if (!user || user.role !== 'teacher') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      const courseId = path.split('/')[1];
      const { title, content, orderIndex, videoUrl, pdfUrl } = body;
      const newLesson = {
        course_id: Number(courseId),
        title,
        content,
        order_index: orderIndex || 1,
        video_url: videoUrl,
        pdf_url: pdfUrl,
        day_number: orderIndex || 1
      };
      const result = await supabaseFetch('lessons', { method: 'POST', body: JSON.stringify(newLesson) });
      return NextResponse.json(result ? result[0] : newLesson);
    }

    // POST /api/payment/razorpay-order
    if (path === 'payment/razorpay-order') {
      let keyId = (process.env.RAZORPAY_KEY_ID || 'rzp_test_T6a0fiCRRVIfl8').trim().replace(/^["']|["']$/g, '');
      let keySecret = (process.env.RAZORPAY_KEY_SECRET || 'qCMh5tFyxLE1ibP2TaA4VZHw').trim().replace(/^["']|["']$/g, '');
      
      try {
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: Number(body.amount) || 299900,
            currency: body.currency || 'INR',
            receipt: `rcpt_${Date.now()}`
          })
        });

        const rzpData = await rzpRes.json();
        if (!rzpRes.ok) {
          return NextResponse.json({ error: rzpData.error?.description || 'Razorpay order creation failed' }, { status: rzpRes.status });
        }

        return NextResponse.json({ ...rzpData, key_id: keyId });
      } catch (rzpErr) {
        console.error('Razorpay Order Error:', rzpErr);
        return NextResponse.json({ error: rzpErr.message || 'Razorpay order creation failed' }, { status: 400 });
      }
    }

    // POST /api/payment/razorpay-verify
    if (path === 'payment/razorpay-verify') {
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = body;
      const keySecret = (process.env.RAZORPAY_KEY_SECRET || 'qCMh5tFyxLE1ibP2TaA4VZHw').trim().replace(/^["']|["']$/g, '');

      const bodyData = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto.createHmac('sha256', keySecret).update(bodyData.toString()).digest('hex');

      if (expectedSignature === razorpay_signature) {
        await supabaseFetch(`users?id=eq.${user.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ has_paid: 1 })
        });
        return NextResponse.json({ success: true, message: 'Payment verified' });
      } else {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    }

    // POST /api/payment/mock-checkout
    if (path === 'payment/mock-checkout') {
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      await supabaseFetch(`users?id=eq.${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ has_paid: 1 })
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });
  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

