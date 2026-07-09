'use client';

import { Calculator, Atom, FlaskConical, Dna, Globe2, Landmark, Cpu, BookOpen, GraduationCap } from 'lucide-react';

const ICONS = { Calculator, Atom, FlaskConical, Dna, Globe2, Landmark, Cpu, BookOpen };

// Renders the lucide icon named by the subject row (with its brand color).
export default function SubjectIcon({ icon, color, size = 22, className = '' }) {
  const Icon = ICONS[icon] || GraduationCap;
  return <Icon size={size} style={color ? { color } : undefined} className={className} />;
}
