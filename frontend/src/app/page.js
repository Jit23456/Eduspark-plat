'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '@/context/AuthContext';
import { 
  GraduationCap, 
  ShieldAlert, 
  Award, 
  Lock, 
  Sparkles, 
  BookOpen, 
  CheckCircle,
  X,
  ArrowRight,
  TrendingUp,
  BrainCircuit,
  MessageSquare,
  Globe,
  Plus,
  ChevronRight,
  Atom,
  Zap,
  Dna,
  Laptop,
  History as HistoryIcon,
  Star,
  ShieldCheck,
  Cpu,
  Layers,
  Video,
  FileSpreadsheet,
  Bot,
  PlayCircle,
  CheckCircle2,
  Users,
  BarChart2,
  LockKeyhole
} from 'lucide-react';

const SUBJECTS_DETAIL = [
  { id: 'geography', name: 'Geography & Earth Science', desc: 'Explore physical geography, global climate systems, spatial mapping, and human demographics.', icon: Globe, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', img: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=500&auto=format&fit=crop&q=80', tag: 'Class 1 - 10' },
  { id: 'history', name: 'History & World Civilizations', desc: 'Journey through ancient empires, historical milestones, global revolutions, and world heritage.', icon: HistoryIcon, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', img: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=500&auto=format&fit=crop&q=80', tag: 'Class 1 - 10' },
  { id: 'math', name: 'Mathematics & Logic', desc: 'Foundations of numbers, geometric proofs, algebraic equations, trigonometry, and analytical logic.', icon: BrainCircuit, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20', img: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=500&auto=format&fit=crop&q=80', tag: 'Class 1 - 10' },
  { id: 'physics', name: 'Physics & Laws of Motion', desc: 'Study of forces, mechanics, light optics, thermodynamics, electromagnetic waves, and energy.', icon: Zap, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20', img: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=500&auto=format&fit=crop&q=80', tag: 'Class 1 - 10' },
  { id: 'chemistry', name: 'Chemistry & Molecular Science', desc: 'Discover chemical reactions, atomic orbital models, covalent bonds, acids, bases, and compounds.', icon: Atom, color: 'text-teal-500 bg-teal-500/10 border-teal-500/20', img: '/images/chemistry.png', tag: 'Class 1 - 10' },
  { id: 'biology', name: 'Biological Sciences & Anatomy', desc: 'Study cell biology, ecosystems, human anatomy, genetics, and environmental biology.', icon: Dna, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20', img: 'https://images.unsplash.com/photo-1532187643603-ba119ca4109e?w=500&auto=format&fit=crop&q=80', tag: 'Class 1 - 10' },
  { id: 'computer_science', name: 'Computer Science & Coding', desc: 'Introduction to computational logic, algorithms, digital literacy, and modern web software.', icon: Laptop, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20', img: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=500&auto=format&fit=crop&q=80', tag: 'Class 1 - 10' },
  { id: 'english', name: 'English Literature & Grammar', desc: 'Grammar mastery, literature analysis, essay composition, and vocabulary development exercises.', icon: BookOpen, color: 'text-sky-500 bg-sky-500/10 border-sky-500/20', img: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=500&auto=format&fit=crop&q=80', tag: 'Class 1 - 10' }
];

const PLATFORM_FEATURES = [
  {
    icon: Bot,
    title: 'AI Sparky Assistant',
    desc: 'Instant 24/7 AI tutor offering step-by-step guidance, scientific molecular models, and math formulas inline.',
    color: 'from-blue-500 to-indigo-600',
    badge: 'Interactive AI'
  },
  {
    icon: Layers,
    title: '7-Day Curriculum Paths',
    desc: 'Structured day-by-day learning timelines designed for student engagement and retention.',
    color: 'from-emerald-500 to-teal-600',
    badge: 'Class 1-10'
  },
  {
    icon: Video,
    title: 'HD Video & PDF Notes',
    desc: 'Gated video lectures and downloadable PDF worksheets attached to every single lesson module.',
    color: 'from-purple-500 to-pink-600',
    badge: 'Rich Media'
  },
  {
    icon: ShieldCheck,
    title: 'Razorpay Secure Checkout',
    desc: 'Instant enrollment via official Razorpay test/live gateway supporting UPI, Cards, and Netbanking.',
    color: 'from-amber-500 to-orange-600',
    badge: '100% Verified'
  }
];

export default function Home() {
  const { user, loginWithGoogle, loginMock, loginEmailOrPhone, signupEmailOrPhone, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Email/Phone authentication states
  const [authMode, setAuthMode] = useState('signin'); // 'signin' or 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleGoogleSuccess = async (response) => {
    try {
      setError('');
      await loginWithGoogle(response.credential);
    } catch (err) {
      setError(err.message || 'Google Sign-in failed. Please try again.');
    }
  };

  const handleGoogleError = () => {
    setError('Google authentication failed. Please try the Developer Mock Login below.');
  };

  const handleMockLogin = async (role, hasPaid) => {
    try {
      setError('');
      await loginMock(role, hasPaid);
    } catch (err) {
      setError('Mock login failed.');
    }
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please fill in both fields.');
      return;
    }

    setSubmitLoading(true);
    setError('');
    try {
      await loginEmailOrPhone(email.trim(), password);
      setIsLoginOpen(false);
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError('Please enter either your email address or phone number.');
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setSubmitLoading(true);
    setError('');
    try {
      await signupEmailOrPhone({
        name: name.trim(),
        email: email.trim() || null,
        phone_number: phone.trim() || null,
        password,
        role
      });
      setIsLoginOpen(false);
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] text-white">
        <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-[#0176d3]"></div>
        <p className="mt-4 text-slate-400 font-semibold tracking-wide animate-pulse">Initializing Eduspark Platform...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col justify-between selection:bg-[#0176d3] selection:text-white">
      {/* Salesforce Brand Navigation Header */}
      <header className="sticky top-0 z-40 h-20 bg-[#0f172a]/90 backdrop-blur-md border-b border-slate-800/80 px-6 lg:px-12 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#0176d3] to-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/30 animate-pulseGlow">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-2xl tracking-wider font-sans text-white leading-none">
              EDU<span className="text-[#0176d3]">SPARK</span>
            </span>
            <span className="text-[9px] font-bold text-blue-400 tracking-widest uppercase mt-0.5">NEXT-GEN LEARNING</span>
          </div>
        </div>

        {/* Desktop Nav links */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-bold text-slate-300">
          <button onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="hover:text-white hover:text-[#0176d3] transition-colors cursor-pointer">Home</button>
          <button onClick={() => scrollToSection('features')} className="hover:text-white hover:text-[#0176d3] transition-colors cursor-pointer">Features</button>
          <button onClick={() => scrollToSection('subjects')} className="hover:text-white hover:text-[#0176d3] transition-colors cursor-pointer">Core Subjects</button>
          <button onClick={() => scrollToSection('classes')} className="hover:text-white hover:text-[#0176d3] transition-colors cursor-pointer">Class 1-10</button>
          <button onClick={() => scrollToSection('pricing')} className="hover:text-white hover:text-[#0176d3] transition-colors cursor-pointer">Pricing & Razorpay</button>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLoginOpen(true)}
            className="bg-gradient-to-r from-[#0176d3] to-blue-600 hover:from-blue-600 hover:to-[#0176d3] text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/25 transform hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <span>Portal Sign In</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Hero Welcome Banner with Animated Particles & Visual Graphics */}
      <section className="relative pt-32 sm:pt-36 pb-20 sm:pb-24 px-6 lg:px-12 overflow-hidden bg-gradient-to-b from-[#0f172a] via-[#1e293b] to-[#0f172a]">
        {/* Decorative Background Glowing Lights */}
        <div className="absolute top-1/4 left-10 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulseGlow pointer-events-none"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulseGlow pointer-events-none" style={{ animationDelay: '2s' }}></div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          <div className="lg:col-span-7 space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-full px-4 py-2 text-xs text-blue-300 font-extrabold shadow-inner backdrop-blur-md mt-2 sm:mt-0">
              <Sparkles className="h-4 w-4 text-yellow-400 animate-spinSlow" />
              <span>Next-Gen Academic Platform for Class 1 to 10</span>
            </div>
            
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight sm:leading-none text-white">
              Unlock Academic Excellence with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-teal-300 to-purple-400">Smart AI Guidance</span> & Visual Mastery
            </h1>
            
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed font-normal">
              Empowering Class 1 to 10 students with 80 comprehensive subject tracks, interactive video lessons, printable PDF worksheets, instant chapter exams, and 24/7 AI Sparky assistance.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-2">
              <button
                onClick={() => setIsLoginOpen(true)}
                className="bg-gradient-to-r from-[#0176d3] via-blue-600 to-indigo-600 hover:opacity-95 text-white font-extrabold text-sm py-4 px-8 rounded-2xl shadow-xl shadow-blue-500/30 transition-all duration-300 transform hover:-translate-y-1 flex items-center justify-center gap-3 cursor-pointer"
              >
                <span>Explore Platform Now</span>
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                onClick={() => scrollToSection('subjects')}
                className="bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 font-extrabold text-sm py-4 px-8 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer backdrop-blur-md"
              >
                <BookOpen className="h-5 w-5 text-blue-400" />
                <span>Browse All Subjects</span>
              </button>
            </div>

            {/* Platform Trust Stats */}
            <div className="pt-6 border-t border-slate-800/80 grid grid-cols-3 gap-4 text-center lg:text-left max-w-md">
              <div>
                <div className="text-2xl font-black text-blue-400">10</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Class Modules</div>
              </div>
              <div>
                <div className="text-2xl font-black text-teal-400">8</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Core Subjects</div>
              </div>
              <div>
                <div className="text-2xl font-black text-purple-400">100%</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Razorpay Secure</div>
              </div>
            </div>
          </div>
          
          {/* Interactive Hero Graphic Widget Card */}
          <div className="lg:col-span-5 flex justify-center relative">
            <div className="w-full max-w-md glass-card-dark rounded-3xl p-6 shadow-2xl border border-slate-700/60 space-y-6 relative animate-float">
              {/* Header inside graphic */}
              <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500"></div>
                  <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                </div>
                <div className="text-[10px] font-mono text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                  LIVE LEARNING HUB
                </div>
              </div>

              {/* Chemistry Orbital Graphic Showcase */}
              <div className="bg-slate-900/90 rounded-2xl p-4 border border-teal-500/30 text-center space-y-2 relative overflow-hidden">
                <div className="flex justify-between items-center text-[10px] font-bold text-teal-400">
                  <span className="flex items-center gap-1"><Atom className="h-4 w-4 animate-spinSlow" /> CHEMISTRY MODULE</span>
                  <span className="bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded text-[9px]">Class 1 - 10</span>
                </div>
                <svg viewBox="0 0 200 90" className="w-full max-w-[170px] mx-auto">
                  <circle cx="100" cy="45" r="16" fill="#ef4444" className="filter drop-shadow-lg" />
                  <text x="100" y="49" fill="white" fontSize="11" fontWeight="bold" textAnchor="middle">O</text>
                  <circle cx="50" cy="70" r="10" fill="#3b82f6" />
                  <text x="50" y="73" fill="white" fontSize="8" fontWeight="bold" textAnchor="middle">H</text>
                  <circle cx="150" cy="70" r="10" fill="#3b82f6" />
                  <text x="150" y="73" fill="white" fontSize="8" fontWeight="bold" textAnchor="middle">H</text>
                  <line x1="88" y1="52" x2="60" y2="65" stroke="#14b8a6" strokeWidth="2.5" strokeDasharray="3,1" />
                  <line x1="112" y1="52" x2="140" y2="65" stroke="#14b8a6" strokeWidth="2.5" strokeDasharray="3,1" />
                </svg>
                <div className="text-[10px] text-slate-300 font-semibold">Water ($H_2O$) Covalent Molecular Model</div>
              </div>

              {/* Floating Performance Indicator */}
              <div className="bg-slate-900/90 rounded-2xl p-4 border border-blue-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                    <BarChart2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Automated Grading</div>
                    <div className="text-[10px] text-slate-400">98.4% Quiz Success Rate</div>
                  </div>
                </div>
                <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">+12.5%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dynamic Platform Features Section */}
      <section id="features" className="py-24 px-6 lg:px-12 max-w-7xl mx-auto w-full space-y-16">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-extrabold px-3.5 py-1 rounded-full uppercase tracking-wider">
            Why Choose Eduspark
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            Engineered for Every Learner
          </h2>
          <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
            Combining interactive AI visual assistance, structured daily paths, rich multimedia notes, and instant billing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {PLATFORM_FEATURES.map((feat, idx) => {
            const IconComp = feat.icon;
            return (
              <div 
                key={idx}
                className="glass-card-dark p-8 rounded-3xl border border-slate-800 hover-lift group relative overflow-hidden flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${feat.color} text-white flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform duration-300`}>
                      <IconComp className="h-7 w-7" />
                    </div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700">
                      {feat.badge}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">{feat.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
                </div>
                <div className="pt-6 mt-6 border-t border-slate-800/80 flex items-center text-xs font-bold text-blue-400 group-hover:text-blue-300 transition-colors">
                  <span>Explore Capability</span>
                  <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Core Curriculum Subjects Grid */}
      <section id="subjects" className="py-24 px-6 lg:px-12 bg-slate-900/60 border-y border-slate-800/80 w-full relative">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-1.5 bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-extrabold px-3.5 py-1 rounded-full uppercase tracking-wider">
              8 Core Disciplines
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Explore Our Comprehensive Subjects
            </h2>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
              Master fundamentals from Class 1 up to Class 10 Board exam standards.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {SUBJECTS_DETAIL.map((sub) => {
              const Icon = sub.icon;
              return (
                <div 
                  key={sub.id} 
                  className="glass-card-dark rounded-3xl overflow-hidden border border-slate-800 hover-lift group flex flex-col justify-between"
                >
                  {/* Subject Image with Overlay Icon */}
                  <div className="relative h-44 w-full overflow-hidden">
                    <img 
                      src={sub.img} 
                      alt={sub.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
                    <div className="absolute top-3 right-3 z-10">
                      <span className="bg-slate-900/80 text-white backdrop-blur-md text-[10px] font-extrabold px-3 py-1 rounded-full border border-white/20">
                        {sub.tag}
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-4 z-10 flex items-center gap-2">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center border shadow-lg backdrop-blur-md ${sub.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                  </div>

                  <div className="p-6 flex-grow space-y-2">
                    <h3 className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">{sub.name}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{sub.desc}</p>
                  </div>

                  <div className="p-6 pt-0">
                    <button 
                      onClick={() => setIsLoginOpen(true)}
                      className="w-full bg-slate-800/80 hover:bg-[#0176d3] text-slate-200 hover:text-white py-3 px-4 rounded-xl text-xs font-extrabold flex justify-between items-center transition-all duration-300 border border-slate-700/60 cursor-pointer group-hover:border-blue-500/50"
                    >
                      <span>View Course Modules</span>
                      <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Class Level Selector Matrix Showcase */}
      <section id="classes" className="py-24 px-6 lg:px-12 max-w-7xl mx-auto w-full space-y-16">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-extrabold px-3.5 py-1 rounded-full uppercase tracking-wider">
            Grade Level Progression
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            Tailored for Class 1 to 10
          </h2>
          <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
            Select your academic grade to instantly view specialized curriculum tracks and quizzes.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((cls) => (
            <button
              key={cls}
              onClick={() => setIsLoginOpen(true)}
              className="glass-card-dark p-6 rounded-3xl border border-slate-800 hover:border-[#0176d3] text-center hover-lift transition-all duration-300 group cursor-pointer flex flex-col items-center justify-between space-y-3"
            >
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-black text-xl group-hover:scale-110 group-hover:bg-[#0176d3] group-hover:text-white transition-all">
                {cls}
              </div>
              <div>
                <div className="text-base font-extrabold text-white">Class {cls}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider group-hover:text-blue-400 transition-colors mt-0.5">
                  Enter Syllabus &rarr;
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Pricing & Razorpay Verification Grid */}
      <section id="pricing" className="py-24 px-6 lg:px-12 max-w-4xl mx-auto w-full space-y-16">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-extrabold px-3.5 py-1 rounded-full uppercase tracking-wider">
            Transparent Membership
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            Simple Annual License
          </h2>
          <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto">
            One annual payment unlocks all 70 curriculum courses, video lectures, PDF notes, and assessment exams.
          </p>
        </div>

        <div className="glass-card-dark border-2 border-blue-500/40 rounded-3xl p-8 sm:p-12 text-center space-y-8 shadow-2xl relative overflow-hidden neon-glow-blue">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
          
          <div className="space-y-2 relative z-10">
            <span className="text-xs font-extrabold text-blue-300 uppercase tracking-widest bg-blue-500/20 border border-blue-500/30 px-4 py-1.5 rounded-full inline-block">
              Full Platform Access Plan
            </span>
            <h3 className="text-3xl sm:text-4xl font-black text-white pt-4">Eduspark Premium Membership</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
              Complete gatekeeper bypass for Class 1 to 10 Geography, Math, History, Physics, Chemistry, Biology, Computer Science, and English.
            </p>
          </div>

          <div className="py-6 border-y border-slate-800/80 max-w-md mx-auto flex justify-between items-center px-6 bg-slate-900/80 rounded-2xl border">
            <div className="text-left">
              <span className="text-4xl font-black text-white">₹2,999</span>
              <span className="text-xs text-slate-400 font-semibold"> / year</span>
            </div>
            <div className="text-right text-xs font-extrabold text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
              <ShieldCheck className="h-4 w-4" /> Razorpay Secured
            </div>
          </div>

          <ul className="max-w-md mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-left text-slate-300 font-semibold">
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" /> Access to all 70 courses
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" /> Unlimited Chapter Exams
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" /> HD Video & PDF Worksheets
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" /> AI Tutor Sparky Assistance
            </li>
          </ul>

          <button
            onClick={() => setIsLoginOpen(true)}
            className="w-full max-w-md bg-gradient-to-r from-[#0176d3] via-blue-600 to-indigo-600 hover:opacity-95 text-white font-extrabold text-sm py-4 rounded-2xl shadow-xl shadow-blue-500/25 transition-all duration-300 tracking-wide flex items-center justify-center gap-3 cursor-pointer mx-auto transform hover:scale-105 active:scale-95"
          >
            <span>Register & Start Learning</span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-white py-14 px-6 lg:px-12 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-center gap-8 text-sm text-slate-400">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[#0176d3] flex items-center justify-center text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-extrabold text-lg tracking-wider font-sans text-white">
              EDU<span className="text-[#0176d3]">SPARK</span>
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-xs font-bold text-slate-300">
            <span>Geography</span>
            <span>History</span>
            <span>Math</span>
            <span>Physics</span>
            <span>Chemistry</span>
            <span>Biology</span>
            <span>Computer Science</span>
            <span>English</span>
          </div>
          <div className="text-xs text-slate-500 text-center lg:text-right">
            &copy; 2026 Eduspark Platform. Built with Next.js, Node.js, SQLite, and Razorpay.
          </div>
        </div>
      </footer>

      {/* Salesforce-Style Login Modal Overlay */}
      {isLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="relative max-w-md w-full glass-card-dark rounded-3xl shadow-2xl border border-slate-700/80 overflow-hidden animate-slideUp">
            {/* Modal Header */}
            <div className="bg-[#0a2240] text-white px-6 py-5 flex items-center justify-between border-b-2 border-[#0176d3]">
              <div className="flex items-center gap-2.5">
                <GraduationCap className="h-6 w-6 text-[#0176d3]" />
                <span className="font-extrabold text-base">
                  {authMode === 'signin' ? 'Sign In to Eduspark' : 'Create Eduspark Account'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsLoginOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              
              {/* Tab Switcher */}
              <div className="flex border-b border-slate-700/80 mb-2">
                <button
                  type="button"
                  onClick={() => { setAuthMode('signin'); setError(''); }}
                  className={`flex-1 pb-3 text-center font-extrabold text-xs border-b-2 transition cursor-pointer ${
                    authMode === 'signin' 
                      ? 'border-[#0176d3] text-[#0176d3]' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode('signup'); setError(''); }}
                  className={`flex-1 pb-3 text-center font-extrabold text-xs border-b-2 transition cursor-pointer ${
                    authMode === 'signup' 
                      ? 'border-[#0176d3] text-[#0176d3]' 
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 p-3.5 rounded-xl flex gap-2.5 animate-fadeIn">
                  <ShieldAlert className="h-5 w-5 text-red-400 shrink-0" />
                  <div className="text-xs text-red-300 font-semibold">{error}</div>
                </div>
              )}

              {/* standard authentication forms */}
              {authMode === 'signin' ? (
                <form onSubmit={handleEmailSignIn} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1.5">Email or Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. name@domain.com or 9876543210"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full p-3 border border-slate-700 rounded-xl text-xs focus:border-[#0176d3] focus:ring-1 focus:ring-[#0176d3] outline-none transition bg-slate-900 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1.5">Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full p-3 border border-slate-700 rounded-xl text-xs focus:border-[#0176d3] focus:ring-1 focus:ring-[#0176d3] outline-none transition bg-slate-900 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="w-full bg-gradient-to-r from-[#0176d3] to-blue-600 hover:opacity-95 text-white font-extrabold py-3 rounded-xl text-xs shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    {submitLoading ? 'Signing In...' : 'Sign In to Portal'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleEmailSignUp} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1.5">Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full p-3 border border-slate-700 rounded-xl text-xs focus:border-[#0176d3] focus:ring-1 focus:ring-[#0176d3] outline-none transition bg-slate-900 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1.5">Email Address</label>
                      <input
                        type="email"
                        placeholder="john@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full p-3 border border-slate-700 rounded-xl text-xs focus:border-[#0176d3] focus:ring-1 focus:ring-[#0176d3] outline-none transition bg-slate-900 text-white placeholder:text-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1.5">Phone Number</label>
                      <input
                        type="text"
                        placeholder="9876543210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full p-3 border border-slate-700 rounded-xl text-xs focus:border-[#0176d3] focus:ring-1 focus:ring-[#0176d3] outline-none transition bg-slate-900 text-white placeholder:text-slate-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1.5">Password</label>
                      <input
                        type="password"
                        placeholder="Min 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-3 border border-slate-700 rounded-xl text-xs focus:border-[#0176d3] focus:ring-1 focus:ring-[#0176d3] outline-none transition bg-slate-900 text-white placeholder:text-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase mb-1.5">Role Type</label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full p-3 border border-slate-700 rounded-xl text-xs focus:border-[#0176d3] outline-none transition bg-slate-900 text-white"
                      >
                        <option value="student">Student Account</option>
                        <option value="teacher">Teacher Account</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="w-full bg-gradient-to-r from-[#0176d3] to-blue-600 hover:opacity-95 text-white font-extrabold py-3 rounded-xl text-xs shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    {submitLoading ? 'Registering...' : 'Create Portal Account'}
                  </button>
                </form>
              )}

              {/* Or divider */}
              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800" />
                </div>
                <div className="relative flex justify-center text-[9px] uppercase">
                  <span className="px-3 bg-slate-900 text-slate-400 font-extrabold">
                    Or Sign In With
                  </span>
                </div>
              </div>

              {/* Google Sign-in */}
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  theme="filled_blue"
                  shape="rectangular"
                  width="100%"
                />
              </div>

              {/* Sandbox Divider */}
              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800" />
                </div>
                <div className="relative flex justify-center text-[9px] uppercase">
                  <span className="px-3 bg-slate-900 text-slate-400 font-extrabold">
                    Instant Demo Login Switcher
                  </span>
                </div>
              </div>

              {/* Sandbox bypass buttons */}
              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleMockLogin('student', true)}
                  className="w-full text-left p-3 rounded-xl border border-slate-800 hover:border-blue-500/50 bg-slate-900/60 hover:bg-slate-800/80 transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="font-extrabold text-xs text-slate-200 group-hover:text-blue-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    Student Profile (Paid Premium Access)
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={() => handleMockLogin('student', false)}
                  className="w-full text-left p-3 rounded-xl border border-slate-800 hover:border-blue-500/50 bg-slate-900/60 hover:bg-slate-800/80 transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="font-extrabold text-xs text-slate-200 group-hover:text-blue-400 flex items-center gap-2">
                    <LockKeyhole className="h-4 w-4 text-amber-400" />
                    Student Profile (Unpaid / Paywall Demo)
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={() => handleMockLogin('teacher', true)}
                  className="w-full text-left p-3 rounded-xl border border-slate-800 hover:border-blue-500/50 bg-slate-900/60 hover:bg-slate-800/80 transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="font-extrabold text-xs text-slate-200 group-hover:text-blue-400 flex items-center gap-2">
                    <Award className="h-4 w-4 text-blue-400" />
                    Teacher Profile (Curriculum Editor Mode)
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
            
            <div className="bg-slate-950/80 border-t border-slate-800/80 px-6 py-3.5 text-center text-[10px] text-slate-500 font-medium">
              Protected with 256-bit SSL encryption. &copy; Eduspark Platform 2026.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
