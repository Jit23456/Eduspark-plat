'use client';

import React from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from '@/context/AuthContext';
import AIAssistant from '@/components/AIAssistant';
import './globals.css';

export default function RootLayout({ children }) {
  // Use a default client ID for sandbox testing if none provided
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "1056586029053-mockid12345example.apps.googleusercontent.com";

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <title>Eduspark Platform - Modern Class 1-10 Learning Portal</title>
        <meta name="description" content="Next-Generation Educational Learning Platform for Students, Parents & Teachers" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased min-h-screen bg-[#f8fafc] text-[#0f172a] selection:bg-blue-500 selection:text-white">
        <GoogleOAuthProvider clientId={googleClientId}>
          <AuthProvider>
            {children}
            <AIAssistant />
          </AuthProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
