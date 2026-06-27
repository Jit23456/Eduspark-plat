'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  GraduationCap, 
  ArrowLeft, 
  Lock, 
  CheckCircle, 
  ChevronRight, 
  BookOpen, 
  Award, 
  Sparkles,
  FileText,
  AlertCircle,
  X
} from 'lucide-react';
const SUBJECT_IMAGES = {
  geography: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800&auto=format&fit=crop&q=80',
  history: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=800&auto=format&fit=crop&q=80',
  math: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800&auto=format&fit=crop&q=80',
  physics: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&auto=format&fit=crop&q=80',
  chemistry: '/images/chemistry.png',
  biology: 'https://images.unsplash.com/photo-1532187643603-ba119ca4109e?w=800&auto=format&fit=crop&q=80',
  computer_science: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=800&auto=format&fit=crop&q=80',
  english: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&auto=format&fit=crop&q=80'
};
export default function CoursePage({ params }) {
  // Unwrap dynamic route parameters using React.use()
  const resolvedParams = use(params);
  const subject = resolvedParams.subject;
  const classNum = resolvedParams.classNum;

  const { token, user, mockCheckout, apiUrl } = useAuth();
  const router = useRouter();

  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [exams, setExams] = useState([]);
  
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [selectedLessonDetail, setSelectedLessonDetail] = useState(null);

  const [paywallActive, setPaywallActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [mockOrderData, setMockOrderData] = useState(null);

  // Fetch course list and set active course
  useEffect(() => {
    if (!token) return;
    fetchCourseDetails();
  }, [token, subject, classNum]);

  // Fetch specific lesson content when selected lesson changes
  useEffect(() => {
    if (!token || !selectedLesson) return;
    fetchLessonContent(selectedLesson.id);
  }, [token, selectedLesson]);

  const fetchCourseDetails = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch course ID by subject and class
      const courseRes = await fetch(`${apiUrl}/courses?subject=${subject}&class_number=${classNum}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!courseRes.ok) throw new Error('Failed to load course details.');
      
      const courses = await courseRes.json();
      if (courses.length === 0) {
        setError('No courses found matching this class and subject.');
        setLoading(false);
        return;
      }
      
      const activeCourse = courses[0];
      setCourse(activeCourse);

      // 2. Fetch lessons (This is gated by payment)
      const lessonsRes = await fetch(`${apiUrl}/courses/${activeCourse.id}/lessons`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (lessonsRes.status === 403) {
        const data = await lessonsRes.json();
        if (data.paywall) {
          setPaywallActive(true);
          setLoading(false);
          return;
        }
      }

      if (!lessonsRes.ok) throw new Error('Failed to load syllabus lessons.');
      const lessonsData = await lessonsRes.json();
      setLessons(lessonsData);
      setPaywallActive(false);

      if (lessonsData.length > 0) {
        // Check if a specific lessonId was passed in the URL search params
        const urlParams = new URLSearchParams(window.location.search);
        const urlLessonId = urlParams.get('lessonId');
        let defaultLesson = lessonsData[0];
        if (urlLessonId) {
          const found = lessonsData.find(l => l.id === Number(urlLessonId));
          if (found) {
            defaultLesson = found;
          }
        }
        setSelectedLesson(defaultLesson);
      }

      // 3. Fetch exams
      const examsRes = await fetch(`${apiUrl}/courses/${activeCourse.id}/exams`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (examsRes.ok) {
        const examsData = await examsRes.json();
        setExams(examsData);
      }

    } catch (err) {
      console.error(err);
      setError(err.message || 'Server error loading course.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLessonContent = async (lessonId) => {
    try {
      const res = await fetch(`${apiUrl}/lessons/${lessonId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 403) {
        setPaywallActive(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setSelectedLessonDetail(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleLessonCompletion = async () => {
    if (!selectedLessonDetail) return;
    
    const isCurrentlyCompleted = selectedLessonDetail.isCompleted;
    const endpoint = isCurrentlyCompleted ? 'uncomplete-lesson' : 'complete-lesson';
    
    try {
      const res = await fetch(`${apiUrl}/progress/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ lessonId: selectedLessonDetail.id })
      });
      
      if (res.ok) {
        // Toggle local state
        setSelectedLessonDetail({
          ...selectedLessonDetail,
          isCompleted: !isCurrentlyCompleted
        });
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
    setPaymentLoading(true);
    setError('');

    try {
      // 1. Load script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Razorpay SDK failed to load.');
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



      // 3. Open Razorpay modal
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Eduspark Platform',
        description: 'Subject Syllabus Unlock Package',
        order_id: orderData.id,
        handler: async function (response) {
          setPaymentLoading(true);
          try {
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
              fetchCourseDetails(); // Re-trigger course load
            } else {
              setError(verifyData.error || 'Signature verification failed.');
            }
          } catch (err) {
            setError('Verification request failed.');
          } finally {
            setPaymentLoading(false);
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
      setPaymentLoading(false);
    }
  };

  const handleNextLesson = () => {
    if (!selectedLessonDetail?.nextLessonId) return;
    const next = lessons.find(l => l.id === selectedLessonDetail.nextLessonId);
    if (next) setSelectedLesson(next);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f3f3f3]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-[#0176d3]"></div>
        <p className="mt-4 text-[#514f4d] font-semibold">Loading Syllabus Modules...</p>
      </div>
    );
  }

  // Salesforce-styled Paywall Overlay
  if (paywallActive) {
    return (
      <div className="min-h-screen bg-[#f3f3f3] flex flex-col">
        {/* Navigation Top Bar */}
        <header className="h-14 bg-white border-b border-[#dddbda] px-6 flex items-center gap-4">
          <button 
            onClick={() => router.push('/dashboard')}
            className="p-1 hover:bg-gray-100 rounded-full text-gray-600 transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="font-bold text-sm text-[#080707]">Return to Dashboard Workspace</span>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-xl w-full slds-card p-8 text-center space-y-6 shadow-xl border border-orange-200">
            <div className="mx-auto h-16 w-16 bg-orange-50 rounded-full flex items-center justify-center text-orange-600 animate-pulse border border-orange-200">
              <Lock className="h-9 w-9" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-[#080707] tracking-tight">Syllabus Access Restricted</h3>
              <p className="text-sm text-[#514f4d] max-w-md mx-auto">
                The curriculum structure for <span className="font-bold capitalize">{subject.replace('_', ' ')} (Class {classNum})</span> is reserved for Premium Student Accounts.
              </p>
            </div>

            <div className="bg-orange-50/50 border border-orange-200 rounded p-6 text-left space-y-3">
              <h4 className="font-bold text-xs text-orange-950 uppercase tracking-wider">With Premium Access, You Unlock:</h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs text-orange-900 font-semibold">
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-orange-600 shrink-0" /> Full Lesson syllabus (TipTap)
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-orange-600 shrink-0" /> Chapter Assessment Exams
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-orange-600 shrink-0" /> Student Progress Stats
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-orange-600 shrink-0" /> Graded Quiz Certifications
                </li>
              </ul>
            </div>

            <div className="pt-2 space-y-4">
              <button
                onClick={handleCheckout}
                disabled={paymentLoading}
                className="w-full bg-[#0176d3] hover:bg-[#014b87] text-white font-bold text-sm py-3 rounded-md shadow-md flex items-center justify-center gap-2 transition"
              >
                {paymentLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                    <span>Processing Simulated Checkout...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 text-yellow-300" />
                    <span>Process Sandbox Upgrade ($29.99/yr)</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-gray-500">
                Bypass Gate: In sandbox mode, clicking this button triggers the payment API to enable immediate access.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#f3f3f3] flex flex-col overflow-hidden">
      {/* Course Header */}
      <header className="bg-white border-b border-[#dddbda] px-6 py-4 flex items-center justify-between shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Class {classNum} &bull; <span className="capitalize">{subject.replace('_', ' ')}</span>
            </div>
            <h1 className="text-xl font-bold text-[#080707] leading-tight">
              {course?.title}
            </h1>
          </div>
        </div>
        
        <div className="flex gap-2">
          {selectedLessonDetail && (
            <button
              onClick={toggleLessonCompletion}
              className={`text-xs font-bold px-4 py-2 rounded border flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedLessonDetail.isCompleted
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-white text-gray-700 border-[#dddbda] hover:bg-gray-50'
              }`}
            >
              <CheckCircle className={`h-4 w-4 ${selectedLessonDetail.isCompleted ? 'text-emerald-600' : 'text-gray-400'}`} />
              <span>{selectedLessonDetail.isCompleted ? 'Completed' : 'Mark Lesson Read'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main double column workspace */}
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-6 gap-6 overflow-hidden h-[calc(100vh-84px)]">
        
        {/* Left column: Syllabus Tree (Scrollable) */}
        <aside className="w-full md:w-80 shrink-0 space-y-6 overflow-y-auto pr-1 h-full pb-8 scroll-smooth">
          {/* Lessons List Card */}
          <div className="slds-card overflow-hidden">
            <div className="bg-gray-100 px-4 py-3 border-b border-[#dddbda] flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
              <BookOpen className="h-4 w-4" /> Syllabus Lessons
            </div>
            <div className="divide-y divide-[#dddbda]">
              {lessons.map((lesson) => (
                <button
                  key={lesson.id}
                  onClick={() => setSelectedLesson(lesson)}
                  className={`w-full text-left p-3.5 text-xs font-semibold flex items-start gap-2.5 transition cursor-pointer ${
                    selectedLesson?.id === lesson.id
                      ? 'bg-blue-50 text-[#0176d3] border-l-4 border-l-[#0176d3]'
                      : 'hover:bg-gray-50 text-gray-700 border-l-4 border-l-transparent'
                  }`}
                >
                  <span className="bg-gray-200 text-gray-600 h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold">
                    {lesson.order_index}
                  </span>
                  <span className="leading-snug">{lesson.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Exams List Card */}
          {exams.length > 0 && (
            <div className="slds-card overflow-hidden border-t-4 border-t-purple-600">
              <div className="bg-gray-100 px-4 py-3 border-b border-[#dddbda] flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
                <Award className="h-4 w-4 text-purple-600" /> Subject Exams
              </div>
              <div className="divide-y divide-[#dddbda]">
                {exams.map((exam) => (
                  <button
                    key={exam.id}
                    onClick={() => router.push(`/exam/${exam.id}`)}
                    className="w-full text-left p-3.5 hover:bg-purple-50 text-xs font-semibold flex items-center justify-between text-gray-700 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-purple-600" />
                      <span>{exam.title}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Right column: Lesson content viewer (Scrollable) */}
        <main className="flex-1 slds-card p-6 flex flex-col justify-between overflow-y-auto h-full pb-8 shadow-md">
          {error ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <h3 className="font-bold text-[#080707] text-lg">Error Loading Content</h3>
              <p className="text-xs text-[#514f4d]">{error}</p>
            </div>
          ) : selectedLessonDetail ? (
            <div className="space-y-6 flex-grow">
              {/* Subject Banner Image */}
              <div className="relative h-44 w-full rounded overflow-hidden shadow-sm shrink-0">
                <img 
                  src={SUBJECT_IMAGES[subject] || 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800'} 
                  alt={subject} 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                <div className="absolute bottom-4 left-4 text-white">
                  <div className="text-[9px] font-extrabold uppercase tracking-widest text-[#0176d3] bg-white/95 px-2 py-0.5 rounded shadow-sm inline-block mb-1.5 font-sans">
                    Lesson {selectedLessonDetail.order_index}
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-white leading-tight">
                    {selectedLessonDetail.title}
                  </h3>
                </div>
              </div>

              {/* Render TipTap HTML body */}
              <article 
                className="prose max-w-none text-gray-800 text-xs px-2"
                dangerouslySetInnerHTML={{ __html: selectedLessonDetail.content }}
              />

              {/* Media Attachments Section (Video & PDF) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-dashed border-[#dddbda]">
                
                {/* Video Lecture Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-extrabold text-[#0176d3] uppercase tracking-wider">🎥 Video Lecture</span>
                    {selectedLessonDetail.locked && (
                      <span className="bg-orange-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Lock className="h-2 w-2" /> Locked
                      </span>
                    )}
                  </div>
                  
                  {selectedLessonDetail.locked ? (
                    <div className="h-44 bg-slate-900/10 rounded-lg flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-300">
                      <Lock className="h-8 w-8 text-gray-400 mb-2 animate-bounce" />
                      <h5 className="font-bold text-xs text-gray-700">Video Lesson Gated</h5>
                      <p className="text-[9px] text-gray-500 max-w-[200px] mt-1 leading-tight">Upgrade to Premium to play this subject's animations and class videos.</p>
                    </div>
                  ) : (
                    <div className="rounded-lg overflow-hidden border border-slate-300 shadow-inner bg-black h-44">
                      {selectedLessonDetail.video_url?.includes('youtube') || selectedLessonDetail.video_url?.includes('embed') ? (
                        <iframe
                          src={selectedLessonDetail.video_url}
                          title={selectedLessonDetail.title}
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <video 
                          src={selectedLessonDetail.video_url || "https://www.w3schools.com/html/mov_bbb.mp4"} 
                          controls 
                          className="w-full h-full object-cover"
                          poster="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&auto=format&fit=crop&q=80"
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* PDF Worksheet Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-extrabold text-[#0176d3] uppercase tracking-wider">📄 Downloadable Homework</span>
                    {selectedLessonDetail.locked && (
                      <span className="bg-orange-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Lock className="h-2 w-2" /> Locked
                      </span>
                    )}
                  </div>
                  
                  {selectedLessonDetail.locked ? (
                    <div className="h-44 bg-slate-900/10 rounded-lg flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-300">
                      <FileText className="h-8 w-8 text-gray-400 mb-2" />
                      <h5 className="font-bold text-xs text-gray-700">PDF Worksheet Gated</h5>
                      <p className="text-[9px] text-gray-500 max-w-[200px] mt-1 leading-tight">Premium accounts get printable PDF worksheet downloads for this chapter.</p>
                    </div>
                  ) : (
                    <div className="h-44 bg-white rounded-lg flex flex-col items-center justify-center text-center p-4 border border-slate-300 shadow-sm">
                      <FileText className="h-10 w-10 text-rose-600 mb-2" />
                      <h5 className="font-bold text-xs text-[#080707]">Class Worksheet.pdf</h5>
                      <p className="text-[9px] text-gray-500 mb-3">Print and complete this practice page at home.</p>
                      <a 
                        href={selectedLessonDetail.pdf_url || "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"} 
                        target="_blank" 
                        rel="noreferrer"
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] py-1.5 px-4 rounded-lg shadow-sm transition"
                      >
                        Download PDF Worksheet
                      </a>
                    </div>
                  )}
                </div>

              </div>

              {/* Paywall Quick-Action Banner inside Lesson view for Unpaid Students */}
              {selectedLessonDetail.locked && (
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-5 mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                      <Sparkles className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-extrabold text-orange-950 text-xs">Unlock All Grade {classNum} Premium Classes</h4>
                      <p className="text-[10px] text-orange-900 leading-tight">Get immediate access to all video streams, worksheets, and online exams for just $29.99/year!</p>
                    </div>
                  </div>
                  <button
                    onClick={handleCheckout}
                    disabled={paymentLoading}
                    className="bg-[#0176d3] hover:bg-[#014b87] text-white font-extrabold text-[10px] px-4 py-2.5 rounded-lg shadow transition whitespace-nowrap cursor-pointer"
                  >
                    Upgrade Account Now
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-xs italic">
              Select a lesson topic from the sidebar syllabus.
            </div>
          )}

          {/* Bottom navigation footer */}
          {selectedLessonDetail && (
            <div className="border-t border-[#dddbda] pt-4 mt-6 flex justify-between items-center shrink-0">
              <div>
                {selectedLessonDetail.isCompleted ? (
                  <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" /> Lesson syllabus completed!
                  </span>
                ) : (
                  <span className="text-xs text-gray-500 font-medium">Review the lesson content above.</span>
                )}
              </div>
              
              {selectedLessonDetail.nextLessonId ? (
                <button
                  onClick={handleNextLesson}
                  className="slds-button-neutral flex items-center gap-1 text-xs cursor-pointer py-1.5 px-3.5"
                >
                  <span>Next Lesson</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                exams.length > 0 && (
                  <button
                    onClick={() => router.push(`/exam/${exams[0].id}`)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2 rounded shadow transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Award className="h-4 w-4" />
                    <span>Take End-of-Chapter Assessment</span>
                  </button>
                )
              )}
            </div>
          )}
        </main>
      </div>


    </div>
  );
}
