const http = require('http');
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const db = require('./db');

// Reset database records to avoid test conflicts
console.log('Resetting SQLite database records for tests...');
db.exec(`
  DELETE FROM progress;
  DELETE FROM submissions;
  DELETE FROM questions;
  DELETE FROM exams;
  DELETE FROM lessons;
  DELETE FROM courses;
  DELETE FROM users;
`);
db.seedDatabase();

const app = express();
app.use(express.json());
app.use('/api', routes);

const TEST_PORT = 5001;
const server = app.listen(TEST_PORT);
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

async function runTests() {
  console.log('--- STARTING BACKEND API VERIFICATION TESTS ---');
  let passed = true;

  // Helper function for fetches
  async function apiFetch(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    const status = res.status;
    let data = null;
    try {
      data = await res.json();
    } catch (e) {}
    return { status, data };
  }

  try {
    // 1. Test Mock Auth Endpoint for Teacher
    console.log('1. Testing Teacher Auth...');
    const tAuth = await apiFetch('/auth/mock', {
      method: 'POST',
      body: JSON.stringify({ role: 'teacher', hasPaid: true })
    });
    if (tAuth.status !== 200 || !tAuth.data.token || tAuth.data.user.role !== 'teacher') {
      console.error('FAIL: Teacher Auth failed', tAuth);
      passed = false;
    } else {
      console.log('PASS: Teacher Auth successful');
    }
    const teacherToken = tAuth.data.token;

    // 2. Test Mock Auth Endpoint for Paid Student
    console.log('2. Testing Paid Student Auth...');
    const sPaidAuth = await apiFetch('/auth/mock', {
      method: 'POST',
      body: JSON.stringify({ role: 'student', hasPaid: true })
    });
    if (sPaidAuth.status !== 200 || !sPaidAuth.data.token || sPaidAuth.data.user.has_paid !== 1) {
      console.error('FAIL: Paid Student Auth failed', sPaidAuth);
      passed = false;
    } else {
      console.log('PASS: Paid Student Auth successful');
    }
    const studentPaidToken = sPaidAuth.data.token;

    // 3. Test Mock Auth Endpoint for Unpaid Student
    console.log('3. Testing Unpaid Student Auth...');
    const sUnpaidAuth = await apiFetch('/auth/mock', {
      method: 'POST',
      body: JSON.stringify({ role: 'student', hasPaid: false })
    });
    if (sUnpaidAuth.status !== 200 || !sUnpaidAuth.data.token || sUnpaidAuth.data.user.has_paid !== 0) {
      console.error('FAIL: Unpaid Student Auth failed', sUnpaidAuth);
      passed = false;
    } else {
      console.log('PASS: Unpaid Student Auth successful');
    }
    const studentUnpaidToken = sUnpaidAuth.data.token;

    // 3b. Test Traditional Sign Up & Sign In
    console.log('3b. Testing Traditional Sign Up & Sign In...');
    
    // Create new email student
    const signUpRes1 = await apiFetch('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'teststudent@eduspark.com',
        password: 'password123',
        name: 'Test Student One',
        role: 'student'
      })
    });
    if (signUpRes1.status !== 201 || !signUpRes1.data.token || signUpRes1.data.user.email !== 'teststudent@eduspark.com') {
      console.error('FAIL: Traditional Email Sign Up failed', signUpRes1);
      passed = false;
    } else {
      console.log('PASS: Traditional Email Sign Up successful');
    }

    // Try registering same email again (should fail)
    const signUpResDuplicate = await apiFetch('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: 'teststudent@eduspark.com',
        password: 'password123',
        name: 'Test Duplicate Student',
        role: 'student'
      })
    });
    if (signUpResDuplicate.status !== 400) {
      console.error('FAIL: Duplicate Email Sign Up did NOT block registration', signUpResDuplicate);
      passed = false;
    } else {
      console.log('PASS: Duplicate Email Sign Up blocked successfully');
    }

    // Create new phone student
    const signUpRes2 = await apiFetch('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        phone_number: '9876543210',
        password: 'password123',
        name: 'Test Student Two',
        role: 'student'
      })
    });
    if (signUpRes2.status !== 201 || !signUpRes2.data.token || signUpRes2.data.user.phone_number !== '9876543210') {
      console.error('FAIL: Traditional Phone Sign Up failed', signUpRes2);
      passed = false;
    } else {
      console.log('PASS: Traditional Phone Sign Up successful');
    }

    // Test Sign In with Email
    const signInEmailRes = await apiFetch('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'teststudent@eduspark.com',
        password: 'password123'
      })
    });
    if (signInEmailRes.status !== 200 || !signInEmailRes.data.token) {
      console.error('FAIL: Traditional Email Sign In failed', signInEmailRes);
      passed = false;
    } else {
      console.log('PASS: Traditional Email Sign In successful');
    }

    // Test Sign In with Phone
    const signInPhoneRes = await apiFetch('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({
        identifier: '9876543210',
        password: 'password123'
      })
    });
    if (signInPhoneRes.status !== 200 || !signInPhoneRes.data.token) {
      console.error('FAIL: Traditional Phone Sign In failed', signInPhoneRes);
      passed = false;
    } else {
      console.log('PASS: Traditional Phone Sign In successful');
    }

    // Test Sign In with Incorrect Password
    const signInBadRes = await apiFetch('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'teststudent@eduspark.com',
        password: 'wrongpassword'
      })
    });
    if (signInBadRes.status !== 401) {
      console.error('FAIL: Sign In with bad password did NOT reject', signInBadRes);
      passed = false;
    } else {
      console.log('PASS: Sign In rejected bad credentials successfully');
    }

    // 4. Test Course Listing (Geography Class 5)
    console.log('4. Testing Course Listing...');
    const coursesRes = await apiFetch('/courses?subject=geography&class_number=5', {
      headers: { Authorization: `Bearer ${studentUnpaidToken}` }
    });
    if (coursesRes.status !== 200 || coursesRes.data.length === 0) {
      console.error('FAIL: Fetching geography courses failed', coursesRes);
      passed = false;
    } else {
      console.log('PASS: Fetching geography courses returned', coursesRes.data.length, 'courses');
    }
    const courseId = coursesRes.data[0].id;

    // 5. Test Payment Gate restriction (unpaid student should be blocked from lesson listings)
    console.log('5. Testing Payment Gate Block on Unpaid Student...');
    const lessonsBlockRes = await apiFetch(`/courses/${courseId}/lessons`, {
      headers: { Authorization: `Bearer ${studentUnpaidToken}` }
    });
    if (lessonsBlockRes.status !== 403 || !lessonsBlockRes.data.paywall) {
      console.error('FAIL: Unpaid student was NOT blocked from lessons listing', lessonsBlockRes);
      passed = false;
    } else {
      console.log('PASS: Unpaid student blocked with 403 paywall status successfully');
    }

    // 6. Test Payment Gate authorization (paid student should pass)
    console.log('6. Testing Payment Gate Pass on Paid Student...');
    const lessonsPassRes = await apiFetch(`/courses/${courseId}/lessons`, {
      headers: { Authorization: `Bearer ${studentPaidToken}` }
    });
    if (lessonsPassRes.status !== 200 || !Array.isArray(lessonsPassRes.data) || lessonsPassRes.data.length === 0) {
      console.error('FAIL: Paid student was blocked or lessons count is zero', lessonsPassRes);
      passed = false;
    } else {
      console.log('PASS: Paid student accessed syllabus lessons successfully, count:', lessonsPassRes.data.length);
    }
    const firstLessonId = lessonsPassRes.data[0].id;

    // 7. Test Lesson Content fetching and status
    console.log('7. Testing Lesson Content retrieval...');
    const lessonDetailRes = await apiFetch(`/lessons/${firstLessonId}`, {
      headers: { Authorization: `Bearer ${studentPaidToken}` }
    });
    if (lessonDetailRes.status !== 200 || !lessonDetailRes.data.content) {
      console.error('FAIL: Could not load lesson details', lessonDetailRes);
      passed = false;
    } else {
      console.log('PASS: Lesson detail retrieved successfully (includes HTML Content)');
    }

    // 8. Test Lesson Progress Completion Logging
    console.log('8. Testing Progress Logging...');
    const progressLogRes = await apiFetch('/progress/complete-lesson', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentPaidToken}` },
      body: JSON.stringify({ lessonId: firstLessonId })
    });
    if (progressLogRes.status !== 200 || !progressLogRes.data.success) {
      console.error('FAIL: Progress logging failed', progressLogRes);
      passed = false;
    } else {
      console.log('PASS: Student progress completion logged');
    }

    // Check progress index
    const progressRes = await apiFetch('/progress', {
      headers: { Authorization: `Bearer ${studentPaidToken}` }
    });
    if (progressRes.status !== 200 || progressRes.data.completedLessonsCount === 0) {
      console.error('FAIL: Progress dashboard metric not updated', progressRes);
      passed = false;
    } else {
      console.log('PASS: Progress dashboard dashboard metrics verified');
    }

    // 9. Test Exam retrieval and submission
    console.log('9. Testing Quiz and Exam Submission...');
    const examListRes = await apiFetch(`/courses/${courseId}/exams`, {
      headers: { Authorization: `Bearer ${studentPaidToken}` }
    });
    if (examListRes.status !== 200 || examListRes.data.length === 0) {
      console.error('FAIL: Could not retrieve course exams', examListRes);
      passed = false;
    } else {
      console.log('PASS: Course exams list loaded');
    }
    const examId = examListRes.data[0].id;

    const examQuestionsRes = await apiFetch(`/exams/${examId}/questions`, {
      headers: { Authorization: `Bearer ${studentPaidToken}` }
    });
    if (examQuestionsRes.status !== 200 || examQuestionsRes.data.questions.length === 0) {
      console.error('FAIL: Could not load quiz questions', examQuestionsRes);
      passed = false;
    } else {
      console.log('PASS: Quiz questions loaded successfully');
    }

    // Mock answers
    const answersObj = {};
    examQuestionsRes.data.questions.forEach(q => {
      // answer randomly or just send option 0
      answersObj[q.id] = 0;
    });

    const examSubmitRes = await apiFetch(`/exams/${examId}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentPaidToken}` },
      body: JSON.stringify({ answers: answersObj })
    });

    if (examSubmitRes.status !== 200 || !examSubmitRes.data.success) {
      console.error('FAIL: Exam grading failed', examSubmitRes);
      passed = false;
    } else {
      console.log('PASS: Exam submitted and graded successfully, score percentage:', examSubmitRes.data.percentage, '%');
    }

    // 10. Test Razorpay Order Creation and Signature Verification
    console.log('10. Testing Razorpay Payment Integration...');
    const orderRes = await apiFetch('/payment/razorpay-order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentUnpaidToken}` }
    });
    if (orderRes.status !== 200 || !orderRes.data.id) {
      console.error('FAIL: Razorpay order creation failed', orderRes);
      passed = false;
    } else {
      console.log('PASS: Razorpay order created successfully, order ID:', orderRes.data.id);
    }

    const orderId = orderRes.data.id;
    const verifyRes = await apiFetch('/payment/razorpay-verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentUnpaidToken}` },
      body: JSON.stringify({
        razorpay_payment_id: 'pay_dummypayment12345',
        razorpay_order_id: orderId,
        razorpay_signature: 'dummy_signature_verified'
      })
    });

    if (verifyRes.status !== 200 || !verifyRes.data.success) {
      console.error('FAIL: Razorpay payment signature verification failed', verifyRes);
      passed = false;
    } else {
      console.log('PASS: Razorpay signature verified successfully');
    }

    // Verify unpaid user can now open lessons
    const lessonsUnlockRes = await apiFetch(`/courses/${courseId}/lessons`, {
      headers: { Authorization: `Bearer ${studentUnpaidToken}` }
    });
    if (lessonsUnlockRes.status !== 200) {
      console.error('FAIL: Student remains blocked after checkout payment update', lessonsUnlockRes);
      passed = false;
    } else {
      console.log('PASS: Student payment status successfully unlocked lessons access');
    }

  } catch (err) {
    console.error('CRITICAL TEST ERROR:', err);
    passed = false;
  } finally {
    server.close(() => {
      console.log('--- TEST SERVER CLOSED ---');
      if (passed) {
        console.log('====================================');
        console.log(' ALL BACKEND VERIFICATION TESTS PASSED ');
        console.log('====================================');
        process.exit(0);
      } else {
        console.log('====================================');
        console.log(' SOME VERIFICATION TESTS FAILED ');
        console.log('====================================');
        process.exit(1);
      }
    });
  }
}

// Start tests
setTimeout(runTests, 1000);
