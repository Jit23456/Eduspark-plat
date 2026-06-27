'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  GraduationCap, 
  ArrowLeft, 
  Award, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight,
  Sparkles,
  Lock
} from 'lucide-react';

export default function ExamPage({ params }) {
  // Unwrap dynamic route parameters using React.use()
  const resolvedParams = use(params);
  const examId = resolvedParams.examId;

  const { token, user, mockCheckout, apiUrl } = useAuth();
  const router = useRouter();

  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionId]: optionIdx }
  
  const [scoreResult, setScoreResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [paywallActive, setPaywallActive] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchExamQuestions();
  }, [token, examId]);

  const fetchExamQuestions = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/exams/${examId}/questions`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 403) {
        const data = await res.json();
        if (data.paywall) {
          setPaywallActive(true);
          setLoading(false);
          return;
        }
      }

      if (!res.ok) throw new Error('Failed to load exam questions.');
      
      const data = await res.json();
      setExam(data.exam);
      setQuestions(data.questions);
      setPaywallActive(false);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Server connection error.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (qId, optionIdx) => {
    setAnswers({
      ...answers,
      [qId]: optionIdx
    });
  };

  const handleSubmitExam = async () => {
    // Verify all questions answered
    const unansweredCount = questions.length - Object.keys(answers).length;
    if (unansweredCount > 0) {
      setError(`Please answer all questions before submitting. (${unansweredCount} remaining)`);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/exams/${examId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ answers })
      });

      if (!res.ok) throw new Error('Failed to submit exam.');
      const result = await res.json();
      setScoreResult(result);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error submitting answers.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckout = async () => {
    setLoading(true);
    const result = await mockCheckout();
    if (result.success) {
      fetchExamQuestions();
    } else {
      setError(result.error || 'Simulated checkout failed.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f3f3f3]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-[#0176d3]"></div>
        <p className="mt-4 text-[#514f4d] font-semibold">Loading Exam Assessment...</p>
      </div>
    );
  }

  // Salesforce-styled Paywall Overlay for Exams
  if (paywallActive) {
    return (
      <div className="min-h-screen bg-[#f3f3f3] flex flex-col">
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
              <h3 className="text-2xl font-bold text-[#080707] tracking-tight">Exam Blocked</h3>
              <p className="text-sm text-[#514f4d] max-w-md mx-auto">
                Subject assessments and exam evaluations require a Premium student account level.
              </p>
            </div>

            <div className="bg-orange-50/50 border border-orange-200 rounded p-6 text-left space-y-3">
              <h4 className="font-bold text-xs text-orange-950 uppercase tracking-wider">Premium Access Features:</h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs text-orange-900 font-semibold">
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-orange-600 shrink-0" /> Open all core subjects
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-orange-600 shrink-0" /> Unlock chapter exams
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-orange-600 shrink-0" /> Real-time answer grading
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-orange-600 shrink-0" /> Save results to report card
                </li>
              </ul>
            </div>

            <div className="pt-2 space-y-4">
              <button
                onClick={handleCheckout}
                className="w-full bg-[#0176d3] hover:bg-[#014b87] text-white font-bold text-sm py-3 rounded-md shadow-md flex items-center justify-center gap-2 transition"
              >
                <Sparkles className="h-5 w-5 text-yellow-300" />
                <span>Process Sandbox Upgrade ($29.99/yr)</span>
              </button>
              <p className="text-[10px] text-gray-500">
                Sandbox Simulator: Upgrading will immediately initialize the exam session.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error && !questions.length) {
    return (
      <div className="min-h-screen bg-[#f3f3f3] flex flex-col justify-between">
        <header className="h-14 bg-white border-b border-[#dddbda] px-6 flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="font-bold text-sm">Dashboard</span>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <h3 className="text-xl font-bold">Failed to load Assessment</h3>
          <p className="text-sm text-gray-500">{error}</p>
        </main>
      </div>
    );
  }

  const activeQuestion = questions[currentIdx];

  return (
    <div className="min-h-screen bg-[#f3f3f3] flex flex-col">
      {/* Salesforce-Style Exam Header */}
      <header className="bg-white border-b border-[#dddbda] px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Subject Assessment
            </div>
            <h1 className="text-lg font-bold text-[#080707] leading-tight">
              {exam?.title}
            </h1>
          </div>
        </div>
        
        {!scoreResult && (
          <div className="text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
            Question {currentIdx + 1} of {questions.length}
          </div>
        )}
      </header>

      {/* Main content body */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-6 flex flex-col justify-center">
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded mb-6 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <span className="text-xs text-red-800 font-semibold">{error}</span>
          </div>
        )}

        {/* Display Score results after submission */}
        {scoreResult ? (
          <div className="slds-card p-8 text-center space-y-8 animate-fadeIn">
            <div className="mx-auto h-24 w-24 rounded-full bg-emerald-50 border-4 border-emerald-500 flex items-center justify-center text-emerald-600">
              <Award className="h-12 w-12" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-[#080707]">Assessment Results Submitted</h2>
              <p className="text-sm text-[#514f4d]">
                Your answers have been processed and graded. Below is your performance dashboard card.
              </p>
            </div>

            <div className="max-w-xs mx-auto grid grid-cols-2 gap-4 border border-[#dddbda] rounded p-6 bg-gray-50 text-left">
              <div>
                <div className="text-xs text-[#514f4d] font-bold uppercase">Average Score</div>
                <div className="text-3xl font-extrabold text-[#0176d3]">{scoreResult.percentage}%</div>
              </div>
              <div>
                <div className="text-xs text-[#514f4d] font-bold uppercase">Correct Answers</div>
                <div className="text-lg font-bold text-[#080707] mt-1">
                  {scoreResult.score} / {scoreResult.total}
                </div>
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full slds-button-brand py-2.5 font-bold text-xs"
              >
                Return to Home Workspace
              </button>
            </div>
          </div>
        ) : (
          /* Assessment Quiz view */
          <div className="slds-card p-8 space-y-8 animate-fadeIn shadow-lg">
            
            {/* Question title */}
            <div className="space-y-4">
              <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="bg-[#0176d3] h-full transition-all duration-300"
                  style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                ></div>
              </div>
              <h3 className="text-xl font-bold text-[#080707]">
                {activeQuestion.question_text}
              </h3>
            </div>

            {/* Vertical Choices stack */}
            <div className="grid grid-cols-1 gap-3">
              {activeQuestion.options.map((opt, oIdx) => {
                const isSelected = answers[activeQuestion.id] === oIdx;
                return (
                  <button
                    key={oIdx}
                    onClick={() => handleSelectOption(activeQuestion.id, oIdx)}
                    className={`w-full text-left p-4 rounded border font-semibold text-sm flex items-center gap-3.5 transition-all ${
                      isSelected
                        ? 'border-[#0176d3] bg-blue-50 text-[#0176d3]'
                        : 'border-[#dddbda] bg-white hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-xs border transition ${
                      isSelected 
                        ? 'bg-[#0176d3] text-white border-[#0176d3]' 
                        : 'bg-gray-100 text-gray-500 border-gray-300'
                    }`}>
                      {String.fromCharCode(65 + oIdx)}
                    </span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>

            {/* Wizard Navigation Footer */}
            <div className="border-t border-[#dddbda] pt-6 flex justify-between items-center">
              <button
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx(currentIdx - 1)}
                className="slds-button-neutral text-xs py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous Question
              </button>

              {currentIdx < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIdx(currentIdx + 1)}
                  className="slds-button-neutral flex items-center gap-1 text-xs py-2 px-4"
                >
                  <span>Next Question</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  disabled={submitting}
                  onClick={handleSubmitExam}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs py-2 px-6 rounded shadow flex items-center gap-1.5 transition"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-white"></div>
                      <span>Submitting Assessment...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span>Submit and Grade Exam</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
