'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Crown, LogOut, LayoutDashboard, Sparkles, GraduationCap } from 'lucide-react';

export default function Nav() {
  const { user, logout, isTeacher, isPremium, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: '/', label: 'Home' },
    { href: '/courses', label: 'Courses' },
    { href: '/premium', label: 'Premium' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgba(6,9,19,0.75)] backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--violet)] to-[var(--cyan)] flex items-center justify-center animate-glow">
            <GraduationCap size={20} className="text-white" />
          </span>
          <span className="text-xl font-extrabold tracking-tight grad-text">Eduspark</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`px-3.5 py-2 rounded-lg font-semibold transition-colors ${pathname === l.href ? 'text-white bg-[rgba(124,92,255,0.18)]' : 'text-[var(--ink-soft)] hover:text-white hover:bg-[rgba(255,255,255,0.05)]'}`}>
              {l.label}
            </Link>
          ))}
          {user && (
            <Link href={isTeacher ? '/teacher' : '/dashboard'}
              className={`px-3.5 py-2 rounded-lg font-semibold transition-colors ${pathname.startsWith(isTeacher ? '/teacher' : '/dashboard') ? 'text-white bg-[rgba(124,92,255,0.18)]' : 'text-[var(--ink-soft)] hover:text-white hover:bg-[rgba(255,255,255,0.05)]'}`}>
              {isTeacher ? 'Teacher Studio' : 'My Dashboard'}
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          {loading ? null : user ? (
            <>
              {isPremium ? (
                <span className="badge badge-gold hidden sm:inline-flex"><Crown size={12} /> Premium</span>
              ) : user.role === 'STUDENT' ? (
                <Link href="/premium" className="btn btn-gold btn-sm hidden sm:inline-flex"><Sparkles size={14} /> Upgrade</Link>
              ) : null}
              <Link href={isTeacher ? '/teacher' : '/dashboard'} className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.04)] hover:border-[var(--line-strong)] transition-colors">
                {user.avatar_url
                  ? <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
                  : <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--violet)] to-[var(--pink)] flex items-center justify-center text-xs font-extrabold text-white">{user.name?.[0]?.toUpperCase()}</span>}
                <span className="text-sm font-semibold hidden sm:block max-w-28 truncate">{user.name?.split(' ')[0]}</span>
                {user.role === 'STUDENT' && user.class_level ? <span className="badge badge-violet">C{user.class_level}</span> : null}
              </Link>
              <button onClick={() => { logout(); router.push('/'); }} className="btn btn-ghost btn-sm" title="Sign out"><LogOut size={15} /></button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">Sign in</Link>
              <Link href="/register" className="btn btn-primary btn-sm">Get started free</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
