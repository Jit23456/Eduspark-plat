'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { 
  GraduationCap, 
  User, 
  LogOut, 
  BookOpen, 
  BarChart2, 
  CreditCard, 
  Settings, 
  Users, 
  Check, 
  Plus, 
  Trash2, 
  FileText, 
  Lock, 
  Award, 
  Sparkles,
  ChevronRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Quote,
  RefreshCw,
  X,
  Atom,
  Globe,
  Zap,
  Dna,
  Laptop,
  TrendingUp
} from 'lucide-react';

const SUBJECTS = [
  { id: 'geography', name: 'Geography', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', img: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=400&auto=format&fit=crop&q=80' },
  { id: 'history', name: 'History', color: 'bg-amber-50 text-amber-700 border-amber-200', img: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=400&auto=format&fit=crop&q=80' },
  { id: 'math', name: 'Math', color: 'bg-blue-50 text-blue-700 border-blue-200', img: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400&auto=format&fit=crop&q=80' },
  { id: 'physics', name: 'Physics', color: 'bg-purple-50 text-purple-700 border-purple-200', img: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400&auto=format&fit=crop&q=80' },
  { id: 'chemistry', name: 'Chemistry', color: 'bg-teal-50 text-teal-700 border-teal-200', img: '/images/chemistry.png' },
  { id: 'biology', name: 'Biology', color: 'bg-rose-50 text-rose-700 border-rose-200', img: 'https://images.unsplash.com/photo-1532187643603-ba119ca4109e?w=400&auto=format&fit=crop&q=80' },
  { id: 'computer_science', name: 'Computer Science', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', img: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=400&auto=format&fit=crop&q=80' },
  { id: 'english', name: 'English', color: 'bg-sky-50 text-sky-700 border-sky-200', img: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&auto=format&fit=crop&q=80' }
];

export default function Dashboard() {
  const { user, token, logout, mockCheckout, refreshUser, apiUrl } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('courses'); // 'courses', 'progress', 'billing', 'teacher', 'daily-path'
  const [selectedClass, setSelectedClass] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [mockOrderData, setMockOrderData] = useState(null);

  // Daily Path Timeline States
  const [timelineSubject, setTimelineSubject] = useState('math');
  const [timelineLessons, setTimelineLessons] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Student progress state
  const [progressData, setProgressData] = useState(null);

  // Teacher dashboard state
  const [students, setStudents] = useState([]);
  const [teacherSelectedClass, setTeacherSelectedClass] = useState(1);
  const [teacherSelectedSubject, setTeacherSelectedSubject] = useState('math');
  const [courseLessons, setCourseLessons] = useState([]);
  const [teacherCourses, setTeacherCourses] = useState([]);
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [isCreatingLesson, setIsCreatingLesson] = useState(false);

  // Exam Builder state
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamDesc, setNewExamDesc] = useState('');
  const [quizQuestions, setQuizQuestions] = useState([
    { question_text: '', options: ['', '', '', ''], correct_option: 0 }
  ]);
  const [isCreatingExam, setIsCreatingExam] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!user && !localStorage.getItem('eduspark_token')) {
      router.push('/');
    }
  }, [user, router]);

  // Load appropriate data when tab changes or initially
  useEffect(() => {
    if (!token) return;
    if (user?.role === 'student') {
      loadStudentProgress();
    }
    if (activeTab === 'teacher' && user?.role === 'teacher') {
      loadStudentsList();
      loadTeacherCourses();
    }
  }, [activeTab, token, user]);

  // Load daily timeline lessons
  useEffect(() => {
    if (!token || user?.role !== 'student' || activeTab !== 'daily-path') return;
    
    // If unpaid student, we do not fetch lessons (since they are gated), we render mock placeholder locked nodes.
    if (user?.has_paid !== 1) {
      setTimelineLessons([
        { id: 101, title: 'Day 1: Introductory Basics', day_number: 1, locked: true },
        { id: 102, title: 'Day 2: Historical Frameworks', day_number: 2, locked: true },
        { id: 103, title: 'Day 3: Core Theoretical Models', day_number: 3, locked: true },
        { id: 104, title: 'Day 4: Practical Demonstrations', day_number: 4, locked: true },
        { id: 105, title: 'Day 5: Real World Applications', day_number: 5, locked: true },
        { id: 106, title: 'Day 6: Common Misconceptions', day_number: 6, locked: true },
        { id: 107, title: 'Day 7: Comprehensive Exam Review', day_number: 7, locked: true },
      ]);
      setTimelineLoading(false);
      return;
    }

    const fetchTimelineLessons = async () => {
      setTimelineLoading(true);
      try {
        const courseRes = await fetch(`${apiUrl}/courses?subject=${timelineSubject}&class_number=${selectedClass}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!courseRes.ok) throw new Error('Failed to load course details.');
        const courses = await courseRes.json();
        if (courses.length === 0) {
          setTimelineLessons([]);
          return;
        }
        const activeCourse = courses[0];
        
        const lessonsRes = await fetch(`${apiUrl}/courses/${activeCourse.id}/lessons`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (lessonsRes.ok) {
          const lessonsData = await lessonsRes.json();
          setTimelineLessons(lessonsData);
        } else {
          setTimelineLessons([]);
        }
      } catch (err) {
        console.error(err);
        setTimelineLessons([]);
      } finally {
        setTimelineLoading(false);
      }
    };

    fetchTimelineLessons();
  }, [token, selectedClass, timelineSubject, activeTab, user]);

  // Load teacher lessons when selected course/class changes
  useEffect(() => {
    if (user?.role === 'teacher' && teacherCourses.length > 0) {
      loadTeacherLessons();
    }
  }, [teacherSelectedClass, teacherSelectedSubject, teacherCourses]);

  // TipTap Rich Text Editor Configuration
  const editor = useEditor({
    extensions: [StarterKit],
    content: `<h3>Lesson Subheading</h3><p>Start writing your rich educational content here...</p>`,
  });

  const loadStudentProgress = async () => {
    try {
      const res = await fetch(`${apiUrl}/progress`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProgressData(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadStudentsList = async () => {
    try {
      const res = await fetch(`${apiUrl}/admin/students`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadTeacherCourses = async () => {
    try {
      const res = await fetch(`${apiUrl}/courses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTeacherCourses(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadTeacherLessons = async () => {
    const course = teacherCourses.find(
      c => c.subject === teacherSelectedSubject && c.class_number === Number(teacherSelectedClass)
    );
    if (!course) {
      setCourseLessons([]);
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/courses/${course.id}/lessons`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCourseLessons(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleCheckout = async () => {
    setLoading(true);
    setError('');
    
    try {
      // 1. Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Razorpay SDK failed to load. Are you offline?');
      }

      // 2. Create order on backend
      const orderRes = await fetch(`${apiUrl}/payment/razorpay-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (!orderRes.ok) {
        throw new Error('Failed to initiate transaction order.');
      }

      const orderData = await orderRes.json();



      // 3. Configure Razorpay checkout options
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Eduspark Platform',
        description: 'Class 1 to 10 Premium Access Package',
        order_id: orderData.id,
        handler: async function (response) {
          setLoading(true);
          try {
            // Verify payment
            const verifyRes = await fetch(`${apiUrl}/payment/razorpay-verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              await refreshUser(); // Update state locally
              setSuccessMsg('Payment successfully processed! Your account is upgraded.');
              setTimeout(() => setSuccessMsg(''), 5000);
              setActiveTab('courses');
            } else {
              setError(verifyData.error || 'Payment signature verification failed.');
            }
          } catch (err) {
            setError('Verification request failed.');
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          name: user.name,
          email: user.email
        },
        theme: {
          color: '#0176d3'
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        setError('Payment was not completed: ' + (response.error.description || 'Transaction cancelled.'));
      });
      rzp.open();
    } catch (err) {
      setError(err.message || 'Razorpay checkout error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const toggleStudentPayment = async (userId, currentStatus) => {
    try {
      const res = await fetch(`${apiUrl}/admin/students/${userId}/payment`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ has_paid: !currentStatus })
      });
      if (res.ok) {
        loadStudentsList();
        setSuccessMsg('Student payment status updated.');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Lesson handler
  const handleAddLesson = async () => {
    if (!newLessonTitle.trim()) {
      setError('Lesson title is required.');
      return;
    }
    const htmlContent = editor?.getHTML() || '';
    if (!htmlContent.trim()) {
      setError('Lesson content is required.');
      return;
    }

    const course = teacherCourses.find(
      c => c.subject === teacherSelectedSubject && c.class_number === Number(teacherSelectedClass)
    );
    if (!course) return;

    try {
      setError('');
      const res = await fetch(`${apiUrl}/courses/${course.id}/lessons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newLessonTitle,
          content: htmlContent
        })
      });

      if (res.ok) {
        setNewLessonTitle('');
        editor?.commands.setContent('<p>Write content here...</p>');
        setIsCreatingLesson(false);
        loadTeacherLessons();
        setSuccessMsg('Lesson added successfully!');
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to add lesson.');
      }
    } catch (err) {
      setError('Server connection error.');
    }
  };

  // Add Exam Builder handlers
  const handleAddExamQuestionField = () => {
    setQuizQuestions([...quizQuestions, { question_text: '', options: ['', '', '', ''], correct_option: 0 }]);
  };

  const handleRemoveExamQuestionField = (idx) => {
    if (quizQuestions.length === 1) return;
    setQuizQuestions(quizQuestions.filter((_, i) => i !== idx));
  };

  const handleQuestionTextChange = (idx, text) => {
    const updated = [...quizQuestions];
    updated[idx].question_text = text;
    setQuizQuestions(updated);
  };

  const handleOptionTextChange = (qIdx, oIdx, text) => {
    const updated = [...quizQuestions];
    updated[qIdx].options[oIdx] = text;
    setQuizQuestions(updated);
  };

  const handleCorrectOptionChange = (qIdx, oIdx) => {
    const updated = [...quizQuestions];
    updated[qIdx].correct_option = oIdx;
    setQuizQuestions(updated);
  };

  const handleAddExam = async () => {
    if (!newExamTitle.trim()) {
      setError('Exam title is required.');
      return;
    }

    // Validate questions
    for (let i = 0; i < quizQuestions.length; i++) {
      const q = quizQuestions[i];
      if (!q.question_text.trim()) {
        setError(`Question ${i + 1} has no text.`);
        return;
      }
      if (q.options.some(opt => !opt.trim())) {
        setError(`Question ${i + 1} has incomplete options.`);
        return;
      }
    }

    const course = teacherCourses.find(
      c => c.subject === teacherSelectedSubject && c.class_number === Number(teacherSelectedClass)
    );
    if (!course) return;

    try {
      setError('');
      const res = await fetch(`${apiUrl}/courses/${course.id}/exams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newExamTitle,
          description: newExamDesc,
          questions: quizQuestions
        })
      });

      if (res.ok) {
        setNewExamTitle('');
        setNewExamDesc('');
        setQuizQuestions([{ question_text: '', options: ['', '', '', ''], correct_option: 0 }]);
        setIsCreatingExam(false);
        setSuccessMsg('Subject Exam created successfully!');
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create exam.');
      }
    } catch (err) {
      setError('Server connection error.');
    }
  };

  const navigateToCourse = (subjectId) => {
    router.push(`/course/${subjectId}/${selectedClass}`);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#f3f3f3] flex flex-col">
      {/* Salesforce-Style Global Header */}
      <header className="h-14 bg-[#0a2240] text-white flex items-center justify-between px-6 border-b-4 border-[#0176d3] shadow-md z-10">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-[#0176d3]" />
          <span className="font-bold text-lg tracking-wider font-sans">
            EDU<span className="text-[#0176d3]">SPARK</span>
          </span>
          <span className="bg-[#0176d3] text-xs font-bold px-2 py-0.5 rounded ml-2">STUDENT PORTAL</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <img 
              src={user.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'} 
              alt={user.name} 
              className="h-8 w-8 rounded-full border border-gray-400 object-cover"
            />
            <div className="text-left hidden md:block">
              <div className="text-xs font-bold leading-tight">{user.name}</div>
              <div className="text-[10px] text-gray-400 capitalize">{user.role} {user.role === 'student' && (user.has_paid ? '(Premium)' : '(Free Account)')}</div>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-red-200 hover:text-red-400 transition font-semibold"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Salesforce-Style Banner Header / Record Detail Panel */}
      <div className="bg-white border-b border-[#dddbda] px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-[#0176d3] rounded text-white flex items-center justify-center shadow">
            <GraduationCap className="h-8 w-8" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-[#514f4d] uppercase tracking-wider">Workspace Dashboard</div>
            <h1 className="text-2xl font-bold text-[#080707] flex items-center gap-2 leading-none">
              Welcome back, {user.name.split(' ')[0]}!
              {user.role === 'student' && (
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${user.has_paid ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                  {user.has_paid ? 'Premium Active' : 'Basic Account (Locked)'}
                </span>
              )}
            </h1>
          </div>
        </div>
        
        {/* Salesforce Actions */}
        <div className="flex gap-2">
          {user.role === 'student' && !user.has_paid && (
            <button
              onClick={() => setActiveTab('billing')}
              className="slds-button-brand flex items-center gap-1.5 shadow"
            >
              <CreditCard className="h-4 w-4" />
              <span>Unlock Premium Access</span>
            </button>
          )}
          <button
            onClick={() => {
              if (user.role === 'student') {
                loadStudentProgress();
                setSuccessMsg('Workspace data refreshed.');
                setTimeout(() => setSuccessMsg(''), 2000);
              } else {
                loadStudentsList();
                loadTeacherCourses();
              }
            }}
            className="slds-button-neutral flex items-center gap-1.5"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Salesforce horizontal tabs */}
      <div className="bg-white border-b border-[#dddbda] px-6 flex">
        <button
          onClick={() => setActiveTab('courses')}
          className={`py-3 px-4 font-semibold text-sm border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'courses' 
              ? 'border-[#0176d3] text-[#0176d3]' 
              : 'border-transparent text-[#514f4d] hover:text-[#0176d3] hover:border-[#dddbda]'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Courses
        </button>

        {user.role === 'student' && (
          <button
            onClick={() => setActiveTab('daily-path')}
            className={`py-3 px-4 font-semibold text-sm border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'daily-path' 
                ? 'border-[#0176d3] text-[#0176d3]' 
                : 'border-transparent text-[#514f4d] hover:text-[#0176d3] hover:border-[#dddbda]'
            }`}
          >
            <Sparkles className="h-4 w-4 text-orange-500 animate-pulse" />
            Daily Path
          </button>
        )}

        {user.role === 'student' && (
          <>
            <button
              onClick={() => setActiveTab('progress')}
              className={`py-3 px-4 font-semibold text-sm border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'progress' 
                  ? 'border-[#0176d3] text-[#0176d3]' 
                  : 'border-transparent text-[#514f4d] hover:text-[#0176d3] hover:border-[#dddbda]'
              }`}
            >
              <BarChart2 className="h-4 w-4" />
              My Progress
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`py-3 px-4 font-semibold text-sm border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'billing' 
                  ? 'border-[#0176d3] text-[#0176d3]' 
                  : 'border-transparent text-[#514f4d] hover:text-[#0176d3] hover:border-[#dddbda]'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              Payment Status
            </button>
          </>
        )}

        {user.role === 'teacher' && (
          <button
            onClick={() => setActiveTab('teacher')}
            className={`py-3 px-4 font-semibold text-sm border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'teacher' 
                ? 'border-[#0176d3] text-[#0176d3]' 
                : 'border-transparent text-[#514f4d] hover:text-[#0176d3] hover:border-[#dddbda]'
            }`}
          >
            <Users className="h-4 w-4" />
            Teacher Panel
          </button>
        )}
      </div>

      {/* Main Workspace Frame */}
      <div className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        
        {successMsg && (
          <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded flex items-center gap-2 shadow-sm">
            <Check className="h-5 w-5 text-emerald-600" />
            <span className="text-sm text-emerald-800 font-medium">{successMsg}</span>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded flex items-center gap-2 shadow-sm">
            <Lock className="h-5 w-5 text-rose-600" />
            <span className="text-sm text-rose-800 font-medium">{error}</span>
          </div>
        )}

        {/* Tab content: Courses */}
        {activeTab === 'courses' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Filter Panel */}
            <div className="slds-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="font-bold text-lg text-[#080707]">Select Student Class Level</h3>
                <p className="text-xs text-[#514f4d]">Configure courses and chapter modules optimized for grades 1 to 10.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(cls => (
                  <button
                    key={cls}
                    onClick={() => setSelectedClass(cls)}
                    className={`h-9 w-12 font-bold text-sm rounded border flex items-center justify-center transition-all ${
                      selectedClass === cls
                        ? 'bg-[#0176d3] text-white border-[#0176d3] shadow-md'
                        : 'bg-white text-[#0176d3] border-[#dddbda] hover:bg-gray-50'
                    }`}
                  >
                    C{cls}
                  </button>
                ))}
              </div>
            </div>

            {/* Paywall Warning Banner */}
            {user.role === 'student' && !user.has_paid && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900 text-sm">Account Locks Active</h4>
                    <p className="text-xs text-amber-800 max-w-xl">
                      You are logged in on a basic free student tier. To unlock allGeography, Math, computer science, and English curriculum lessons and quizzes, update your billing details.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('billing')}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2.5 rounded shadow whitespace-nowrap transition"
                >
                  Configure Checkout
                </button>
              </div>
            )}

            {/* Subject Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {SUBJECTS.map((sub) => {
                return (
                  <div 
                    key={sub.id} 
                    className="slds-card flex flex-col justify-between hover-lift group overflow-hidden"
                  >
                    {/* Subject Banner Image */}
                    <div className="relative h-36 w-full overflow-hidden">
                      <img 
                        src={sub.img} 
                        alt={sub.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                      <div className="absolute top-3 left-3 z-10">
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded border shadow-sm capitalize ${sub.color}`}>
                          {sub.name}
                        </span>
                      </div>
                      <div className="absolute top-3 right-3 z-10">
                        {user.role === 'student' && !user.has_paid ? (
                          <span className="bg-orange-500 text-white rounded-full px-2.5 py-0.5 text-[9px] font-bold flex items-center gap-1 shadow-sm">
                            <Lock className="h-2.5 w-2.5" /> Locked
                          </span>
                        ) : (
                          <span className="bg-emerald-600 text-white rounded-full px-2.5 py-0.5 text-[9px] font-bold flex items-center gap-1 shadow-sm">
                            <Check className="h-2.5 w-2.5" /> Unlocked
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-5 flex-grow">
                      <h4 className="font-bold text-base text-[#080707] group-hover:text-[#0176d3] transition">
                        Class {selectedClass} - {sub.name}
                      </h4>
                      <p className="text-xs text-[#514f4d] mt-1.5 line-clamp-2 leading-relaxed">
                        Explore core academic principles, detailed chapter modules, review exercises, and quizzes.
                      </p>
                    </div>

                    <button
                      onClick={() => navigateToCourse(sub.id)}
                      className="border-t border-[#dddbda] bg-gray-50 py-3 px-5 hover:bg-blue-50 text-left text-xs font-bold text-[#0176d3] flex justify-between items-center group-hover:bg-blue-50 transition cursor-pointer"
                    >
                      <span>
                        {user.role === 'student' && !user.has_paid ? 'View Locked Syllabus' : 'Open Course Modules'}
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab content: Daily Path */}
        {activeTab === 'daily-path' && (
          <div className="space-y-6 animate-fadeIn pb-12">
            {/* Filter Panel (Class and Subject) */}
            <div className="slds-card p-6 space-y-6 border-b-4 border-b-[#0176d3]">
              <div>
                <h3 className="font-bold text-xl text-[#080707] flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-yellow-500 animate-spin" />
                  Your Kids Learning Roadmap
                </h3>
                <p className="text-xs text-[#514f4d]">Choose your Grade and Subject to display your interactive 7-day school roadmap!</p>
              </div>

              {/* Class Picker */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Select Grade Level</label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(cls => (
                    <button
                      key={cls}
                      onClick={() => setSelectedClass(cls)}
                      className={`h-10 px-4 font-bold text-xs rounded-full border-2 flex items-center justify-center transition-all ${
                        selectedClass === cls
                          ? 'bg-[#0176d3] text-white border-[#0176d3] shadow-lg scale-105'
                          : 'bg-white text-[#0176d3] border-blue-200 hover:bg-blue-50'
                      }`}
                    >
                      🏫 Grade {cls}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject Picker */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Select Subject Path</label>
                <div className="flex flex-wrap gap-3">
                  {SUBJECTS.map((sub) => {
                    const isSelected = timelineSubject === sub.id;
                    const emojiMap = {
                      math: '📐',
                      geography: '🌍',
                      history: '📜',
                      physics: '⚡',
                      chemistry: '🧪',
                      biology: '🧬',
                      computer_science: '💻',
                      english: '📚'
                    };
                    return (
                      <button
                        key={sub.id}
                        onClick={() => setTimelineSubject(sub.id)}
                        className={`px-4 py-2.5 rounded-xl border-2 font-bold text-xs flex items-center gap-2 capitalize transition-all ${
                          isSelected
                            ? 'bg-blue-500 text-white border-blue-500 shadow-md scale-105'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <span>{emojiMap[sub.id] || '✨'}</span>
                        <span>{sub.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Timeline Roadmap */}
            <div className="slds-card p-8 bg-gradient-to-b from-blue-50/30 to-indigo-50/30 rounded-xl relative overflow-hidden">
              {/* Graphic background bubbles */}
              <div className="absolute top-10 left-10 w-24 h-24 bg-pink-100 rounded-full blur-2xl opacity-60"></div>
              <div className="absolute bottom-10 right-10 w-32 h-32 bg-yellow-100 rounded-full blur-2xl opacity-60"></div>

              {timelineLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                  <p className="text-xs text-gray-500 mt-3 font-semibold">Generating path modules...</p>
                </div>
              ) : timelineLessons.length === 0 ? (
                <div className="text-center py-16 text-gray-400 italic">
                  No daily path generated for Grade {selectedClass} {timelineSubject}.
                </div>
              ) : (
                <div className="relative max-w-2xl mx-auto py-8">
                  {/* Vertical connector line */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-1 border-r-4 border-dashed border-blue-200 -translate-x-1/2 z-0"></div>

                  <div className="space-y-12 relative z-10">
                    {timelineLessons.map((lesson, idx) => {
                      const dayNum = lesson.day_number || idx + 1;
                      const isCompleted = progressData?.completedLessonIds?.includes(lesson.id);
                      const isPaid = user?.has_paid === 1;

                      // Alignment layout: left, right winding
                      const alignStyles = [
                        'md:justify-start pr-0 md:pr-32', // Left
                        'md:justify-end pl-0 md:pl-32',  // Right
                      ];
                      const alignment = alignStyles[idx % 2];

                      // Decorative emoji
                      const emojis = ['🚀', '🌟', '🎨', '🧠', '🏆', '🍎', '🌈'];
                      const emoji = emojis[idx % emojis.length];

                      return (
                        <div 
                          key={lesson.id} 
                          className={`flex justify-center ${alignment} items-center w-full transition-all group`}
                        >
                          <div className="bg-white hover:shadow-xl transition-all duration-300 rounded-2xl border-2 border-blue-100 p-5 max-w-sm w-full relative flex gap-4 hover:-translate-y-1">
                            {/* Connector badge */}
                            <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border-4 border-white bg-blue-500 shadow-md text-white font-extrabold text-[10px] items-center justify-center hidden md:flex z-20">
                              {dayNum}
                            </div>

                            {/* Left Side: Avatar/Badge */}
                            <div className={`h-12 w-12 rounded-xl shrink-0 flex items-center justify-center text-xl shadow-sm ${
                              isCompleted 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : !isPaid
                                  ? 'bg-gray-100 text-gray-400 border border-gray-200' 
                                  : 'bg-blue-100 text-blue-700'
                            }`}>
                              {isCompleted ? '✅' : (!isPaid ? '🔒' : emoji)}
                            </div>

                            {/* Content Side */}
                            <div className="text-left space-y-1 flex-1">
                              <div className="flex justify-between items-start">
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-500">
                                  Day {dayNum}
                                </span>
                                {!isPaid && (
                                  <span className="bg-orange-500 text-white font-extrabold rounded-full px-2 py-0.5 text-[8px] flex items-center gap-1 shadow-sm uppercase tracking-wider">
                                    <Lock className="h-2 w-2" /> Locked
                                  </span>
                                )}
                              </div>
                              <h4 className="font-extrabold text-sm text-[#080707] group-hover:text-blue-600 transition">
                                {lesson.title}
                              </h4>
                              <p className="text-[10px] text-gray-500 leading-tight">
                                Click to start day {dayNum} classroom activities and worksheets.
                              </p>
                              
                              <div className="pt-2">
                                <button
                                  onClick={() => {
                                    if (!isPaid) {
                                      handleCheckout();
                                    } else {
                                      router.push(`/course/${timelineSubject}/${selectedClass}?lessonId=${lesson.id}`);
                                    }
                                  }}
                                  className={`w-full py-1.5 rounded-lg font-bold text-[10px] tracking-wide transition shadow-sm ${
                                    isCompleted 
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100' 
                                      : !isPaid
                                        ? 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 cursor-pointer'
                                        : 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
                                  }`}
                                >
                                  {isCompleted 
                                    ? 'Review Daily Activity' 
                                    : !isPaid
                                      ? 'Unlock Premium Day'
                                      : 'Start Daily Class 🚀'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab content: Student Progress */}
        {activeTab === 'progress' && progressData && (
          <div className="space-y-6 animate-fadeIn">
            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="slds-card p-6 flex items-center gap-4">
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center text-[#0176d3]">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-[#514f4d] uppercase">Completed Lessons</div>
                  <div className="text-2xl font-bold text-[#080707]">{progressData.completedLessonsCount}</div>
                </div>
              </div>

              <div className="slds-card p-6 flex items-center gap-4">
                <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-700">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-[#514f4d] uppercase">Exam Assessments Taken</div>
                  <div className="text-2xl font-bold text-[#080707]">{progressData.examAttemptsCount}</div>
                </div>
              </div>

              <div className="slds-card p-6 flex items-center gap-4">
                <div className="h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-[#514f4d] uppercase">Average Score</div>
                  <div className="text-2xl font-bold text-[#080707]">
                    {progressData.examAttemptsCount > 0 
                      ? `${Math.round(progressData.subjectProgress.reduce((acc, curr) => acc + curr.averageGrade, 0) / progressData.subjectProgress.filter(p => p.averageGrade > 0).length || 0)}%`
                      : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Subject Completion details */}
            <div className="space-y-6">
              <div className="slds-card p-6">
                <h3 className="font-bold text-lg text-[#080707] mb-6 flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 text-[#0176d3]" />
                  Subject Syllabus Completion Metrics
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                  {progressData.subjectProgress.map(sub => {
                    const styleMap = {
                      geography: { color: 'text-emerald-600', stroke: '#059669', bg: 'bg-emerald-50 border-emerald-100', icon: Globe },
                      history: { color: 'text-amber-600', stroke: '#d97706', bg: 'bg-amber-50 border-amber-100', icon: BookOpen },
                      math: { color: 'text-blue-600', stroke: '#2563eb', bg: 'bg-blue-50 border-blue-100', icon: BookOpen },
                      physics: { color: 'text-purple-600', stroke: '#7c3aed', bg: 'bg-purple-50 border-purple-100', icon: Zap },
                      chemistry: { color: 'text-teal-600', stroke: '#0d9488', bg: 'bg-teal-50 border-teal-100', icon: Atom },
                      biology: { color: 'text-rose-600', stroke: '#e11d48', bg: 'bg-rose-50 border-rose-100', icon: Dna },
                      computer_science: { color: 'text-indigo-600', stroke: '#4f46e5', bg: 'bg-indigo-50 border-indigo-100', icon: Laptop },
                      english: { color: 'text-sky-600', stroke: '#0284c7', bg: 'bg-sky-50 border-sky-100', icon: BookOpen }
                    };
                    const style = styleMap[sub.subject] || { color: 'text-slate-600', stroke: '#475569', bg: 'bg-slate-50 border-slate-100', icon: BookOpen };
                    const IconComp = style.icon;
                    const r = 26;
                    const circ = 2 * Math.PI * r;
                    const strokeOffset = circ - (circ * sub.percentComplete) / 100;

                    return (
                      <div 
                        key={sub.subject} 
                        className="rounded-2xl border border-slate-200 p-5 flex flex-col items-center justify-between text-center shadow-xs hover:shadow-md transition-all duration-300 bg-white"
                      >
                        <div className="flex items-center gap-1.5 justify-center mb-4 w-full">
                          <div className={`p-1.5 rounded-lg ${style.bg} ${style.color}`}>
                            <IconComp className="h-4 w-4" />
                          </div>
                          <span className="font-extrabold text-xs capitalize text-slate-800 tracking-wide truncate">
                            {sub.subject.replace('_', ' ')}
                          </span>
                        </div>

                        {/* Circular Progress Ring */}
                        <div className="relative flex items-center justify-center my-2">
                          <svg className="w-20 h-20 transform -rotate-90">
                            <circle cx="40" cy="40" r={r} stroke="#e2e8f0" strokeWidth="6" fill="transparent" />
                            <circle cx="40" cy="40" r={r} stroke={style.stroke} strokeWidth="6" fill="transparent"
                              strokeDasharray={circ}
                              strokeDashoffset={strokeOffset}
                              strokeLinecap="round"
                              className="transition-all duration-1000 ease-out" />
                          </svg>
                          <div className="absolute flex flex-col items-center">
                            <span className="text-xs font-black text-slate-800">{sub.percentComplete}%</span>
                          </div>
                        </div>

                        <div className="mt-4 space-y-1.5 w-full">
                          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            {sub.completedCount} / {sub.totalCount} Lessons
                          </div>
                          {sub.averageGrade > 0 ? (
                            <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-100">
                              <Award className="h-3 w-3" /> Grade: {sub.averageGrade}%
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 bg-slate-50 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-100">
                              No Exams
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Assessment Performance SVG Chart */}
              <div className="slds-card p-6">
                <h3 className="font-bold text-lg text-[#080707] mb-6 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  Subject Assessment Performance Dashboard
                </h3>
                
                {/* SVG Visual Bar Chart */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl"></div>
                  
                  <div className="space-y-4 relative z-10">
                    {progressData.subjectProgress.map((sub, idx) => {
                      const colorMap = {
                        geography: '#10b981',
                        history: '#f59e0b',
                        math: '#3b82f6',
                        physics: '#8b5cf6',
                        chemistry: '#14b8a6',
                        biology: '#f43f5e',
                        computer_science: '#6366f1',
                        english: '#0ea5e9'
                      };
                      const barColor = colorMap[sub.subject] || '#64748b';
                      const grade = sub.averageGrade;
                      const hasGrade = grade > 0;

                      return (
                        <div key={sub.subject} className="grid grid-cols-12 items-center gap-4">
                          <div className="col-span-3 text-right text-xs font-bold text-slate-300 capitalize truncate">
                            {sub.subject.replace('_', ' ')}
                          </div>
                          <div className="col-span-8 bg-slate-800/80 h-3 rounded-full overflow-hidden relative">
                            {hasGrade ? (
                              <div 
                                className="h-full rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${grade}%`, backgroundColor: barColor }}
                              ></div>
                            ) : (
                              <div className="absolute inset-0 flex items-center pl-3">
                                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">No exam attempts logged yet</span>
                              </div>
                            )}
                          </div>
                          <div className="col-span-1 text-left text-xs font-black" style={{ color: hasGrade ? barColor : '#64748b' }}>
                            {hasGrade ? `${grade}%` : '—'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab content: Student Billing */}
        {activeTab === 'billing' && (
          <div className="max-w-2xl mx-auto slds-card p-8 text-center space-y-6 animate-fadeIn">
            <div className="mx-auto h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center text-[#0176d3]">
              <CreditCard className="h-10 w-10" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-[#080707]">Premium Curriculum Licensing</h3>
              <p className="text-sm text-[#514f4d]">
                Upgrade to the premium billing account to unlock full courses, teacher curriculum modules, exams, and detailed performance grading.
              </p>
            </div>

            <div className="border border-[#dddbda] rounded p-6 bg-gray-50 flex justify-between items-center text-left">
              <div>
                <div className="font-bold text-lg text-[#080707]">Eduspark Full Access License</div>
                <div className="text-xs text-[#514f4d]">Valid for Class 1 through 10, all 7 core subjects.</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-extrabold text-[#0176d3]">$29.99</div>
                <div className="text-[10px] text-[#514f4d]">per year / single student</div>
              </div>
            </div>

            {user.has_paid ? (
              <div className="bg-emerald-50 border border-emerald-300 rounded p-4 flex items-center justify-center gap-2 text-emerald-800 font-bold text-sm">
                <Check className="h-5 w-5 text-emerald-600" />
                Premium License Active on this Profile
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full slds-button-brand py-3 flex items-center justify-center gap-2 font-bold tracking-wide"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                      <span>Simulating Secure Bank Gateway...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 text-yellow-300" />
                      <span>Process Simulated Pay Checkout ($29.99)</span>
                    </>
                  )}
                </button>
                <p className="text-[10px] text-[#514f4d]">
                  Secure Sandbox Mode: Clicking the button triggers an API query to immediately set the student billing status to "paid" without requiring real credit card entries.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab content: Teacher Panel */}
        {activeTab === 'teacher' && user.role === 'teacher' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Student management directory */}
            <div className="slds-card p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-bold text-lg text-[#080707]">Student Records & Payment Access</h3>
                  <p className="text-xs text-[#514f4d]">List of enrolled student profiles. Click to toggle payment wall status to debug restrictions.</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-[#514f4d] font-bold border-b border-[#dddbda]">
                      <th className="p-3">Student Name</th>
                      <th className="p-3">Email Address</th>
                      <th className="p-3">Lessons Read</th>
                      <th className="p-3">Quiz Submissions</th>
                      <th className="p-3">Quiz Average</th>
                      <th className="p-3 text-center">Payment Status</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id} className="border-b border-[#dddbda] hover:bg-gray-50 transition">
                        <td className="p-3 font-semibold text-[#080707]">{student.name}</td>
                        <td className="p-3 text-xs text-[#514f4d]">{student.email}</td>
                        <td className="p-3 font-semibold text-center">{student.lessonsCompleted}</td>
                        <td className="p-3 font-semibold text-center">{student.quizCount}</td>
                        <td className="p-3 font-semibold text-center">
                          <span className={student.quizAverage >= 80 ? 'text-emerald-600' : student.quizAverage >= 50 ? 'text-blue-600' : 'text-red-500'}>
                            {student.quizCount > 0 ? `${student.quizAverage}%` : 'No attempts'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${student.has_paid ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            {student.has_paid ? 'Paid' : 'Unpaid (Locked)'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => toggleStudentPayment(student.id, student.has_paid)}
                            className="text-xs slds-button-neutral py-1.5 px-3 whitespace-nowrap"
                          >
                            Toggle Billing
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Curriculum management & TipTap workspace */}
            <div className="slds-card p-6">
              <h3 className="font-bold text-lg text-[#080707] mb-2">Curriculum Authoring Console</h3>
              <p className="text-xs text-[#514f4d] mb-6">Select Class level and Subject to publish new lessons or exams.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-[#514f4d] mb-1">Class Level</label>
                  <select
                    value={teacherSelectedClass}
                    onChange={(e) => setTeacherSelectedClass(Number(e.target.value))}
                    className="w-full p-2 border border-[#dddbda] rounded text-sm bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(c => (
                      <option key={c} value={c}>Class {c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#514f4d] mb-1">Subject</label>
                  <select
                    value={teacherSelectedSubject}
                    onChange={(e) => setTeacherSelectedSubject(e.target.value)}
                    className="w-full p-2 border border-[#dddbda] rounded text-sm bg-white capitalize"
                  >
                    {SUBJECTS.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Display existing lessons */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-[#dddbda] pb-3">
                  <h4 className="font-bold text-sm text-[#080707] uppercase">
                    Published Lessons ({courseLessons.length})
                  </h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsCreatingLesson(true);
                        setIsCreatingExam(false);
                      }}
                      className="slds-button-brand py-1.5 px-3 flex items-center gap-1 text-xs"
                    >
                      <Plus className="h-4 w-4" /> Add Lesson (TipTap)
                    </button>
                    <button
                      onClick={() => {
                        setIsCreatingExam(true);
                        setIsCreatingLesson(false);
                      }}
                      className="slds-button-neutral py-1.5 px-3 flex items-center gap-1 text-xs"
                    >
                      <Plus className="h-4 w-4" /> Build Chapter Exam
                    </button>
                  </div>
                </div>

                {courseLessons.length === 0 ? (
                  <p className="text-xs text-[#514f4d] italic py-4">No lessons found for this class and subject. Click Add Lesson to publish.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {courseLessons.map((lesson) => (
                      <div key={lesson.id} className="p-3 border border-[#dddbda] rounded flex items-center justify-between bg-gray-50">
                        <span className="text-xs font-bold text-[#080707]">{lesson.order_index}. {lesson.title}</span>
                        <div className="text-[10px] text-gray-500 font-semibold">TipTap Rich Content</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Lesson Creation form using TipTap */}
              {isCreatingLesson && (
                <div className="border border-[#0176d3] rounded-lg p-6 bg-blue-50/50 mt-6 space-y-4 animate-slideDown">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-[#0176d3] text-sm">Create Lesson with TipTap Editor</h4>
                    <button 
                      onClick={() => setIsCreatingLesson(false)}
                      className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                    >
                      Cancel
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#514f4d] mb-1">Lesson Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Map Projections and Grid Systems"
                      value={newLessonTitle}
                      onChange={(e) => setNewLessonTitle(e.target.value)}
                      className="w-full p-2 border border-[#dddbda] rounded text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#514f4d] mb-1.5">Lesson Body Content</label>
                    
                    {/* TipTap Rich Text Toolbar */}
                    <div className="flex flex-wrap gap-1 p-2 bg-gray-100 border-t border-x border-[#dddbda] rounded-t-sm">
                      <button
                        onClick={() => editor?.chain().focus().toggleBold().run()}
                        className={`p-1.5 rounded hover:bg-gray-200 transition ${editor?.isActive('bold') ? 'bg-gray-300' : ''}`}
                        title="Bold"
                      >
                        <Bold className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => editor?.chain().focus().toggleItalic().run()}
                        className={`p-1.5 rounded hover:bg-gray-200 transition ${editor?.isActive('italic') ? 'bg-gray-300' : ''}`}
                        title="Italic"
                      >
                        <Italic className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                        className={`p-1.5 rounded hover:bg-gray-200 transition ${editor?.isActive('heading', { level: 2 }) ? 'bg-gray-300' : ''}`}
                        title="Heading 2"
                      >
                        <Heading2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                        className={`p-1.5 rounded hover:bg-gray-200 transition ${editor?.isActive('heading', { level: 3 }) ? 'bg-gray-300' : ''}`}
                        title="Heading 3"
                      >
                        <Heading3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => editor?.chain().focus().toggleBulletList().run()}
                        className={`p-1.5 rounded hover:bg-gray-200 transition ${editor?.isActive('bulletList') ? 'bg-gray-300' : ''}`}
                        title="Bullet List"
                      >
                        <List className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                        className={`p-1.5 rounded hover:bg-gray-200 transition ${editor?.isActive('orderedList') ? 'bg-gray-300' : ''}`}
                        title="Ordered List"
                      >
                        <ListOrdered className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                        className={`p-1.5 rounded hover:bg-gray-200 transition ${editor?.isActive('blockquote') ? 'bg-gray-300' : ''}`}
                        title="Blockquote"
                      >
                        <Quote className="h-4 w-4" />
                      </button>
                    </div>

                    {/* TipTap content area */}
                    <EditorContent editor={editor} className="bg-white rounded-b-sm" />
                  </div>

                  <button
                    onClick={handleAddLesson}
                    className="slds-button-brand py-2 px-4 text-xs shadow-md"
                  >
                    Publish Lesson
                  </button>
                </div>
              )}

              {/* Exam Builder form */}
              {isCreatingExam && (
                <div className="border border-[#0176d3] rounded-lg p-6 bg-blue-50/50 mt-6 space-y-4 animate-slideDown">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-[#0176d3] text-sm">Build Chapter Multiple Choice Assessment</h4>
                    <button 
                      onClick={() => setIsCreatingExam(false)}
                      className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#514f4d] mb-1">Exam Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Chapter 1 Geography Assessment"
                        value={newExamTitle}
                        onChange={(e) => setNewExamTitle(e.target.value)}
                        className="w-full p-2 border border-[#dddbda] rounded text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#514f4d] mb-1">Description</label>
                      <input
                        type="text"
                        placeholder="Topics covered, guidelines, etc."
                        value={newExamDesc}
                        onChange={(e) => setNewExamDesc(e.target.value)}
                        className="w-full p-2 border border-[#dddbda] rounded text-sm bg-white"
                      />
                    </div>
                  </div>

                  {/* Questions List */}
                  <div className="space-y-6 pt-2">
                    <div className="text-xs font-bold text-[#514f4d] uppercase border-b border-[#dddbda] pb-1">
                      Exam Questions ({quizQuestions.length})
                    </div>

                    {quizQuestions.map((q, qIdx) => (
                      <div key={qIdx} className="p-4 border border-[#dddbda] bg-white rounded space-y-3 relative shadow-sm">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-xs text-[#0176d3]">Question #{qIdx + 1}</span>
                          {quizQuestions.length > 1 && (
                            <button
                              onClick={() => handleRemoveExamQuestionField(qIdx)}
                              className="text-red-500 hover:text-red-700 transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        <div>
                          <input
                            type="text"
                            placeholder="Enter question text"
                            value={q.question_text}
                            onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                            className="w-full p-2 border border-[#dddbda] rounded text-xs"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {q.options.map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct-${qIdx}`}
                                checked={q.correct_option === oIdx}
                                onChange={() => handleCorrectOptionChange(qIdx, oIdx)}
                                className="h-4 w-4 text-[#0176d3]"
                              />
                              <input
                                type="text"
                                placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                                value={opt}
                                onChange={(e) => handleOptionTextChange(qIdx, oIdx, e.target.value)}
                                className="w-full p-1.5 border border-[#dddbda] rounded text-xs"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={handleAddExamQuestionField}
                      className="slds-button-neutral flex items-center gap-1 py-1.5 px-3 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Question Row
                    </button>
                  </div>

                  <button
                    onClick={handleAddExam}
                    className="slds-button-brand py-2.5 px-5 text-xs shadow-md w-full"
                  >
                    Save and Publish Exam
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>


    </div>
  );
}
