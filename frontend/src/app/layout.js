'use client';

import React from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import Nav from '@/components/Nav';
import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <title>Fraser Valley Chess Academy — Chess, Maths, English & More</title>
        <meta name="description" content="Group and private classes across BC: Chess, Maths, English, Finance and Fine Arts. Tournaments, camps and free trials." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased min-h-screen">
        <AuthProvider>
          <CartProvider>
            <Nav />
            <main className="min-h-[calc(100vh-64px)]">{children}</main>
            <footer className="border-t border-[var(--line)] mt-16 py-8 text-center text-sm text-[var(--ink-soft)]">
              <div className="board-strip max-w-40 mx-auto mb-4" />
              Fraser Valley Chess Academy · Chess · Maths · English · Finance · Fine Arts
            </footer>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
