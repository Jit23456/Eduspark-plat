'use client';

import React from 'react';
import { AuthProvider } from '@/context/AuthContext';
import Nav from '@/components/Nav';
import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <title>Eduspark — Learn Everything, Class 1 to 10</title>
        <meta name="description" content="Premium learning platform for Class 1-10: Math, Physics, Chemistry, Biology, Geography, History, Computer Science & English. AI teacher videos, exams and progress tracking aligned with the BC curriculum." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased min-h-screen">
        <div className="aurora" aria-hidden="true" />
        <AuthProvider>
          <Nav />
          <main className="min-h-[calc(100vh-64px)]">{children}</main>
          <footer className="border-t border-[var(--line)] mt-20 py-10 text-center text-sm text-[var(--ink-soft)]">
            <div className="text-xl font-extrabold grad-text mb-2">Eduspark</div>
            Math · Physics · Chemistry · Biology · Geography · History · Computer Science · English
            <div className="mt-2 text-xs">Classes 1–10 · Aligned with the <a className="underline hover:text-[var(--cyan)]" href="https://curriculum.gov.bc.ca/" target="_blank" rel="noreferrer">BC Curriculum</a></div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
