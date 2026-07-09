'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Play, Pause, RotateCcw, Volume2, BadgeCheck } from 'lucide-react';

// Picks the most natural-sounding English voice available on this device.
function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  const score = (v) => {
    let s = 0;
    if (/natural|neural/i.test(v.name)) s += 6;
    if (/online/i.test(v.name)) s += 3;
    if (/aria|jenny|sonia|neerja|swara|libby|ana|emma/i.test(v.name)) s += 3;
    if (/google/i.test(v.name)) s += 2;
    if (/zira|susan|hazel|heera/i.test(v.name)) s += 1;
    if (/^en/i.test(v.lang)) s += 2;
    if (/female/i.test(v.name)) s += 1;
    return s;
  };
  return voices.filter(v => /^en/i.test(v.lang)).sort((a, b) => score(b) - score(a))[0] || voices[0] || null;
}

// A one-minute "teacher at the whiteboard" video lesson: an animated teacher
// avatar (hand gestures, nodding, talking mouth) narrates the course script
// with a humanised voice via the Web Speech API.
export default function AITeacher({ script, subjectName, classLevel, color = '#7c5cff', bcUrl }) {
  const [state, setState] = useState('idle'); // idle | playing | paused | done
  const [progress, setProgress] = useState(0);
  const [caption, setCaption] = useState('');
  const utterRef = useRef(null);

  const sentences = useMemo(() => (script || '').match(/[^.!?]+[.!?]+/g) || [script || ''], [script]);
  // Rough per-character offsets so boundary events can drive the captions.
  const offsets = useMemo(() => {
    let acc = 0;
    return sentences.map(s => { const start = acc; acc += s.length; return start; });
  }, [sentences]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const start = () => {
    const synth = window.speechSynthesis;
    if (!synth) { setCaption('Speech is not supported in this browser.'); return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(script);
    const assign = () => { const v = pickVoice(); if (v) u.voice = v; };
    assign();
    if (!synth.getVoices().length) synth.addEventListener('voiceschanged', assign, { once: true });
    u.rate = 0.97;
    u.pitch = 1.06;
    u.onboundary = (e) => {
      if (typeof e.charIndex === 'number' && script.length) {
        setProgress(Math.min(99, Math.round((e.charIndex / script.length) * 100)));
        const idx = offsets.findLastIndex(o => o <= e.charIndex);
        if (idx >= 0) setCaption(sentences[idx].trim());
      }
    };
    u.onend = () => { setState('done'); setProgress(100); };
    u.onerror = () => setState('idle');
    utterRef.current = u;
    setCaption(sentences[0]?.trim() || '');
    setProgress(0);
    setState('playing');
    synth.speak(u);
  };

  const toggle = () => {
    const synth = window.speechSynthesis;
    if (state === 'playing') { synth.pause(); setState('paused'); }
    else if (state === 'paused') { synth.resume(); setState('playing'); }
    else start();
  };

  const restart = () => { window.speechSynthesis.cancel(); start(); };
  const teaching = state === 'playing';

  return (
    <div className="glass overflow-hidden">
      {/* Stage */}
      <div className={`relative ${teaching ? 'teaching' : ''}`}
        style={{ background: `radial-gradient(50rem 20rem at 50% -30%, ${color}30, transparent 70%), linear-gradient(180deg, #0d1229, #090d1d)` }}>
        <svg viewBox="0 0 640 300" className="w-full max-h-72" role="img"
          aria-label={`AI teacher video for Class ${classLevel} ${subjectName}`}>
          {/* Whiteboard */}
          <rect x="40" y="34" width="330" height="196" rx="12" fill="#f4f6fb" stroke="#c7cfe6" strokeWidth="3" />
          <rect x="40" y="34" width="330" height="196" rx="12" fill="none" stroke={color} strokeOpacity="0.35" strokeWidth="1.5" />
          <text x="64" y="82" fontSize="26" fontWeight="800" fill="#1b2340" fontFamily="Outfit, sans-serif">{subjectName}</text>
          <text x="64" y="112" fontSize="16" fontWeight="700" fill={color} fontFamily="Outfit, sans-serif">Grade {classLevel} · BC Curriculum</text>
          <line x1="64" y1="136" x2="330" y2="136" stroke="#c7cfe6" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="64" y1="158" x2="300" y2="158" stroke="#dfe4f2" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="64" y1="180" x2="316" y2="180" stroke="#dfe4f2" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="64" y1="202" x2="270" y2="202" stroke="#dfe4f2" strokeWidth="2.5" strokeLinecap="round" />
          {/* Board stand */}
          <rect x="196" y="230" width="14" height="42" rx="4" fill="#39415f" />

          {/* Teacher */}
          <g>
            {/* left arm holding pointer toward board */}
            <g className="arm-left">
              <rect x="382" y="150" width="86" height="16" rx="8" fill="#e8b98e" transform="rotate(-30 468 158)" />
              <line x1="392" y1="128" x2="352" y2="106" stroke="#8e6bff" strokeWidth="5" strokeLinecap="round" />
              <circle cx="352" cy="106" r="5" fill={color} />
            </g>
            {/* body */}
            <path d="M436 168 Q470 148 504 168 L516 272 L424 272 Z" fill={color} />
            <path d="M436 168 Q470 148 504 168 L508 200 L432 200 Z" fill="#ffffff" fillOpacity="0.16" />
            {/* right arm gesturing */}
            <g className="arm-right">
              <rect x="492" y="160" width="80" height="16" rx="8" fill="#e8b98e" transform="rotate(18 492 168)" />
              <circle cx="572" cy="196" r="9" fill="#e8b98e" />
            </g>
            {/* head */}
            <g className="teacher-head">
              <circle cx="470" cy="118" r="40" fill="#f2c79b" />
              <path d="M430 108 Q436 66 470 66 Q504 66 510 108 Q504 92 470 88 Q436 92 430 108 Z" fill="#2d2440" />
              <path d="M430 108 Q428 140 438 148 L438 112 Z" fill="#2d2440" />
              <path d="M510 108 Q512 140 502 148 L502 112 Z" fill="#2d2440" />
              <circle cx="456" cy="116" r="4.5" fill="#1c1630" />
              <circle cx="486" cy="116" r="4.5" fill="#1c1630" />
              <path d="M450 104 Q456 100 462 104" stroke="#1c1630" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M480 104 Q486 100 492 104" stroke="#1c1630" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              {/* talking mouth */}
              <ellipse className="teacher-mouth" cx="471" cy="138" rx="10" ry="6" fill="#93384f" />
              <circle cx="440" cy="130" r="6" fill="#f29a9a" fillOpacity="0.55" />
              <circle cx="502" cy="130" r="6" fill="#f29a9a" fillOpacity="0.55" />
            </g>
          </g>

          {/* floating chalk sparkles while teaching */}
          {teaching && (
            <>
              <circle cx="120" cy="60" r="3" fill={color} opacity="0.7"><animate attributeName="cy" values="60;46;60" dur="2.4s" repeatCount="indefinite" /></circle>
              <circle cx="330" cy="70" r="2.5" fill="#22d3ee" opacity="0.7"><animate attributeName="cy" values="70;56;70" dur="1.9s" repeatCount="indefinite" /></circle>
            </>
          )}
        </svg>

        {/* caption bar */}
        <div className="absolute bottom-0 inset-x-0 px-5 py-3 bg-[rgba(4,7,16,0.72)] backdrop-blur-sm min-h-12 flex items-center gap-3">
          {teaching && (
            <span className="soundbar flex items-end h-5 shrink-0">
              <span style={{ height: 8 }} /><span style={{ height: 16 }} /><span style={{ height: 12 }} /><span style={{ height: 18 }} /><span style={{ height: 10 }} />
            </span>
          )}
          <p className="text-sm text-[var(--ink)] leading-snug">
            {state === 'idle' ? 'Press play — your teacher will walk you through this course in one minute.' :
             state === 'done' ? 'Class dismissed! Now dive into lesson one below. 🎓' : caption}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 flex flex-wrap items-center gap-3">
        <button onClick={toggle} className="btn btn-primary btn-sm !rounded-full !px-5">
          {state === 'playing' ? <><Pause size={15} /> Pause</> : state === 'paused' ? <><Play size={15} /> Resume</> : <><Play size={15} /> Play video lesson</>}
        </button>
        {(state === 'done' || state === 'paused') && (
          <button onClick={restart} className="btn btn-ghost btn-sm !rounded-full"><RotateCcw size={14} /> Replay</button>
        )}
        <div className="flex-1 min-w-32">
          <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
        </div>
        <span className="text-xs font-bold text-[var(--ink-soft)] flex items-center gap-1.5"><Volume2 size={13} /> ≈ 1 min</span>
        {bcUrl && (
          <a href={bcUrl} target="_blank" rel="noreferrer" className="badge badge-cyan hover:brightness-125">
            <BadgeCheck size={12} /> BC Curriculum reference
          </a>
        )}
      </div>
    </div>
  );
}
