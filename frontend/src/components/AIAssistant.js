'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  X, 
  Sparkles, 
  BookOpen, 
  ArrowRight,
  TrendingUp,
  Brain,
  Shield,
  CreditCard,
  Atom
} from 'lucide-react';

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'sparky',
      text: 'Hi there! 🤖 I am Sparky, your Eduspark AI Learning Assistant. I can help you explore our syllabus (including our new Chemistry module!), explain concepts, or assist with secure payments. What would you like to do?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  const quickChips = [
    { label: 'Explain Chemistry 🧪', query: 'tell me about the chemistry course' },
    { label: 'Newton\'s 3rd Law 🚀', query: 'explain newton\'s third law of motion' },
    { label: 'Pythagorean Theorem 📐', query: 'explain pythagoras theorem math' },
    { label: 'Unlock Premium 💎', query: 'how do i upgrade to premium' }
  ];

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = (textToSend) => {
    const text = textToSend || inputValue.trim();
    if (!text) return;

    // Add user message
    const userMsg = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputValue('');

    // Simulate AI typing
    setIsTyping(true);

    setTimeout(() => {
      const responseText = getSparkyResponse(text);
      const sparkyMsg = {
        id: 'msg_' + (Date.now() + 1),
        sender: 'sparky',
        text: responseText.text,
        timestamp: new Date(),
        visualType: responseText.visualType
      };
      setMessages(prev => [...prev, sparkyMsg]);
      setIsTyping(false);
    }, 1200);
  };

  const getSparkyResponse = (query) => {
    const q = query.toLowerCase();

    // 1. Chemistry matching
    if (q.includes('chemistry') || q.includes('chemical') || q.includes('atom') || q.includes('reaction') || q.includes('water') || q.includes('h2o')) {
      return {
        text: `In Chemistry, we explore substances, atomic structures, and chemical reactions! For example, a water molecule is formed when 1 Oxygen atom shares electrons with 2 Hydrogen atoms via covalent bonds, creating H₂O. Check out this atomic orbital diagram of Water:`,
        visualType: 'chemistry'
      };
    }

    // 2. Physics matching
    if (q.includes('physics') || q.includes('motion') || q.includes('newton') || q.includes('law') || q.includes('force') || q.includes('rocket')) {
      return {
        text: `Physics covers the laws of nature! A key concept is Newton's Third Law of Motion: "For every action, there is an equal and opposite reaction." For example, when a rocket fires its engines, high-speed gas shoots downwards (Action), pushing the rocket upwards into space (Reaction). Here is a force diagram:`,
        visualType: 'physics'
      };
    }

    // 3. Math matching
    if (q.includes('math') || q.includes('pythagoras') || q.includes('theorem') || q.includes('geometry') || q.includes('triangle')) {
      return {
        text: `Mathematics is the language of logic! The Pythagorean Theorem states that in a right-angled triangle, the square of the hypotenuse (c) is equal to the sum of the squares of the other two sides (a and b): a² + b² = c². Check out this right triangle dimension diagram:`,
        visualType: 'math'
      };
    }

    // 4. Payment / Premium matching
    if (q.includes('pay') || q.includes('payment') || q.includes('razorpay') || q.includes('price') || q.includes('premium') || q.includes('upgrade') || q.includes('billing')) {
      return {
        text: `Upgrading to Premium is 100% secure and processed directly via the official Razorpay Checkout widget. For just $29.99/year, you unlock Day 1-7 Syllabus lessons, video lectures, homework PDFs, and graded exams. Click the checkout button on the portal, choose UPI, Credit/Debit Card, or Netbanking on the Razorpay widget, and complete your purchase securely.`,
        visualType: 'payment'
      };
    }

    // 5. General greeting matching
    if (q.includes('hi') || q.includes('hello') || q.includes('hey') || q.includes('help') || q.includes('sparky')) {
      return {
        text: `Hello! I am Sparky, your personal tutor on the Eduspark learning portal. I can explain complex subject topics (Math, Physics, Chemistry, Biology) or help you navigate your dashboard, check your progress reports, and unlock your premium license. Try clicking one of the quick topics below!`,
        visualType: null
      };
    }

    // Default
    return {
      text: `That's a great question! On Eduspark, we have structured courses in Chemistry, Physics, Biology, History, Geography, and Math for Classes 1 to 10. You can unlock video lectures, PDF notes, and assessment exams. Ask me to explain a scientific concept or guide you through upgrading your account!`,
      visualType: null
    };
  };

  const renderVisual = (type) => {
    switch (type) {
      case 'chemistry':
        return (
          <div className="bg-slate-900 border border-teal-500/30 rounded p-4 my-2 text-center text-white space-y-3 shadow-inner">
            <div className="flex justify-center gap-1.5 items-center text-[10px] font-bold text-teal-400">
              <Atom className="h-4 w-4 animate-spin-slow" /> H₂O COVALENT BOND MODEL
            </div>
            {/* SVG chemical bonds */}
            <svg viewBox="0 0 200 120" className="w-full max-w-[160px] mx-auto">
              {/* Oxygen Atom Center */}
              <circle cx="100" cy="50" r="18" fill="#ef4444" className="filter drop-shadow-md" />
              <text x="100" y="54" fill="white" fontSize="12" fontWeight="bold" textAnchor="middle">O</text>
              <text x="100" y="76" fill="#ef4444" fontSize="8" fontWeight="bold" textAnchor="middle">Oxygen</text>

              {/* Hydrogen Atom Left */}
              <circle cx="45" cy="85" r="12" fill="#3b82f6" />
              <text x="45" y="88" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle">H</text>
              <text x="45" y="105" fill="#3b82f6" fontSize="7" fontWeight="bold" textAnchor="middle">Hydrogen</text>

              {/* Hydrogen Atom Right */}
              <circle cx="155" cy="85" r="12" fill="#3b82f6" />
              <text x="155" y="88" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle">H</text>
              <text x="155" y="105" fill="#3b82f6" fontSize="7" fontWeight="bold" textAnchor="middle">Hydrogen</text>

              {/* Covalent bonds */}
              <line x1="88" y1="58" x2="57" y2="77" stroke="#00f2fe" strokeWidth="3" strokeDasharray="3,1" />
              <line x1="112" y1="58" x2="143" y2="77" stroke="#00f2fe" strokeWidth="3" strokeDasharray="3,1" />
              <text x="100" y="24" fill="#a7f3d0" fontSize="7" textAnchor="middle">Shared Electrons (Covalent)</text>
            </svg>
          </div>
        );
      case 'physics':
        return (
          <div className="bg-slate-900 border border-purple-500/30 rounded p-4 my-2 text-center text-white space-y-3 shadow-inner">
            <div className="flex justify-center gap-1.5 items-center text-[10px] font-bold text-purple-400">
              <Sparkles className="h-4 w-4" /> NEWTON'S 3RD LAW: ACTION-REACTION
            </div>
            {/* Rocket Action Reaction */}
            <svg viewBox="0 0 200 130" className="w-full max-w-[150px] mx-auto">
              {/* Rocket Body */}
              <rect x="90" y="25" width="20" height="45" rx="5" fill="#e2e8f0" />
              <polygon points="90,25 100,5 110,25" fill="#ef4444" />
              {/* Wings */}
              <polygon points="90,55 75,70 90,70" fill="#3b82f6" />
              <polygon points="110,55 125,70 110,70" fill="#3b82f6" />
              
              {/* Thrust Flame - Action */}
              <polygon points="92,70 100,105 108,70" fill="#f59e0b" className="animate-pulse" />
              <polygon points="95,70 100,95 105,70" fill="#ef4444" />

              {/* Action Arrow Down */}
              <line x1="60" y1="65" x2="60" y2="95" stroke="#ef4444" strokeWidth="2.5" markerEnd="url(#arrow)" />
              <path d="M 55,85 L 60,95 L 65,85" stroke="#ef4444" strokeWidth="2" fill="none" />
              <text x="50" y="80" fill="#ef4444" fontSize="7" textAnchor="end" fontWeight="bold">ACTION (Gas Down)</text>

              {/* Reaction Arrow Up */}
              <line x1="140" y1="55" x2="140" y2="25" stroke="#22c55e" strokeWidth="2.5" />
              <path d="M 135,35 L 140,25 L 145,35" stroke="#22c55e" strokeWidth="2" fill="none" />
              <text x="150" y="42" fill="#22c55e" fontSize="7" textAnchor="start" fontWeight="bold">REACTION (Rocket Up)</text>
            </svg>
          </div>
        );
      case 'math':
        return (
          <div className="bg-slate-900 border border-blue-500/30 rounded p-4 my-2 text-center text-white space-y-3 shadow-inner">
            <div className="flex justify-center gap-1.5 items-center text-[10px] font-bold text-blue-400">
              <BookOpen className="h-4 w-4" /> PYTHAGOREAN TRIANGLE FORMULA
            </div>
            {/* SVG Triangle */}
            <svg viewBox="0 0 200 120" className="w-full max-w-[150px] mx-auto">
              <polygon points="50,90 150,90 50,20" fill="none" stroke="#60a5fa" strokeWidth="3" />
              {/* Right angle indicator */}
              <rect x="50" y="82" width="8" height="8" fill="none" stroke="#22c55e" strokeWidth="1" />
              
              {/* Labels */}
              <text x="40" y="60" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="end">a</text>
              <text x="100" y="102" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">b</text>
              <text x="110" y="50" fill="#60a5fa" fontSize="10" fontWeight="bold" textAnchor="start">c (Hypotenuse)</text>

              <text x="100" y="20" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle">a² + b² = c²</text>
            </svg>
          </div>
        );
      case 'payment':
        return (
          <div className="bg-slate-900 border border-amber-500/30 rounded p-4 my-2 text-center text-white space-y-3 shadow-inner">
            <div className="flex justify-center gap-1.5 items-center text-[10px] font-bold text-amber-400">
              <Shield className="h-4 w-4 text-emerald-400 animate-pulse" /> 256-BIT SSL SECURE CHECKOUT
            </div>
            {/* Visa / UPI graphics card layout */}
            <div className="w-full max-w-[180px] mx-auto bg-gradient-to-r from-[#0176d3] to-[#103a6c] rounded-md p-3 text-left relative overflow-hidden shadow-md">
              <div className="absolute right-2 top-2 opacity-10">
                <CreditCard className="h-10 w-10 text-white" />
              </div>
              <div className="text-[7px] text-blue-200 font-bold uppercase tracking-wider">Eduspark Premium Plan</div>
              <div className="text-sm font-bold text-white mt-1">₹2,999.00 / yr</div>
              <div className="flex items-center gap-1 text-[8px] text-emerald-300 font-semibold mt-3">
                <Shield className="h-2.5 w-2.5 text-emerald-400" /> Razorpay Integrations Loaded
              </div>
              <div className="text-[6px] text-gray-300 mt-2 font-mono">**** **** **** 1032</div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-[#0176d3] hover:bg-[#014b87] text-white flex items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-white hover:shadow-blue-500/30 cursor-pointer"
        aria-label="Ask AI Assistant"
      >
        {isOpen ? (
          <X className="h-6 w-6 animate-scaleIn" />
        ) : (
          <div className="relative">
            <MessageSquare className="h-6 w-6" />
            <span className="absolute -top-2 -right-2 h-3.5 w-3.5 bg-rose-500 border border-white rounded-full flex items-center justify-center animate-bounce">
              <span className="h-1.5 w-1.5 bg-white rounded-full"></span>
            </span>
          </div>
        )}
      </button>

      {/* Slide-In Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 md:w-96 h-[480px] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-fadeIn backdrop-blur-md">
          {/* Header */}
          <div className="bg-[#0a2240] text-white px-4 py-3 flex items-center justify-between border-b-4 border-[#0176d3] shadow-sm">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="h-8 w-8 bg-[#0176d3] rounded-full flex items-center justify-center border border-white">
                  <Sparkles className="h-4.5 w-4.5 text-yellow-300 animate-pulse" />
                </div>
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-500 rounded-full border border-white"></span>
              </div>
              <div>
                <h4 className="font-extrabold text-xs tracking-wider">SPARKY</h4>
                <p className="text-[9px] text-blue-200 uppercase font-bold tracking-tight">AI Study Guide</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-gray-300 hover:text-white p-1 hover:bg-white/10 rounded-full transition cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Messages Board */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8f9fa] scrollbar-thin">
            {messages.map((msg) => (
              <div 
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${
                  msg.sender === 'user' ? 'ml-auto items-end' : 'items-start'
                }`}
              >
                <div 
                  className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
                    msg.sender === 'user' 
                      ? 'bg-[#0176d3] text-white rounded-tr-none' 
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-xs'
                  }`}
                >
                  {msg.text}
                  {msg.visualType && renderVisual(msg.visualType)}
                </div>
                <span className="text-[8px] text-gray-400 mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}

            {/* Sparky is typing bubble */}
            {isTyping && (
              <div className="flex flex-col items-start max-w-[80%]">
                <div className="bg-white border border-slate-200 text-slate-500 rounded-lg rounded-tl-none px-3.5 py-2.5 text-xs shadow-xs">
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="h-1.5 w-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Suggestions Chips */}
          <div className="bg-white border-t border-slate-100 p-2 overflow-x-auto flex gap-1.5 scrollbar-none shrink-0">
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(chip.query)}
                className="shrink-0 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-[#0176d3] border border-slate-200 hover:border-blue-200 text-[10px] font-bold px-2.5 py-1 rounded-full transition cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Chat input box */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              placeholder="Ask Sparky about Chemistry, Math, Billing..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 p-2 border border-slate-200 rounded text-xs focus:outline-none focus:border-[#0176d3] bg-[#f8f9fa]"
            />
            <button
              type="submit"
              className="h-8 w-8 bg-[#0176d3] hover:bg-[#014b87] text-white rounded flex items-center justify-center transition shadow-md cursor-pointer shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
