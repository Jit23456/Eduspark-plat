'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { ShoppingCart, LogOut, LayoutDashboard } from 'lucide-react';

export default function Nav() {
  const { user, logout, isStaff, isCoach, isCustomer, loading } = useAuth();
  const { items } = useCart();
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: '/', label: 'Home' },
    { href: '/courses', label: 'Courses' },
    { href: '/events', label: 'Events & Tournaments' },
    { href: '/trial', label: 'Free Trial' },
  ];

  const dashHref = isStaff ? '/admin' : isCoach ? '/coach' : '/dashboard';

  return (
    <header className="sticky top-0 z-40 bg-[var(--navy)] text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl leading-none">♞</span>
          <div className="leading-tight">
            <div className="font-extrabold tracking-tight text-sm sm:text-base">Fraser Valley Chess Academy</div>
            <div className="text-[10px] text-white/60 hidden sm:block tracking-widest uppercase">Chess · Maths · English · Finance · Arts</div>
          </div>
        </Link>

        <nav className="ml-6 hidden md:flex items-center gap-1 text-sm">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`px-3 py-1.5 rounded-lg transition ${pathname === l.href ? 'bg-white/15 font-semibold' : 'text-white/80 hover:bg-white/10'}`}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {isCustomer && (
            <Link href="/checkout" className="relative p-2 rounded-lg hover:bg-white/10" title="Cart">
              <ShoppingCart size={18} />
              {items.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-[var(--gold)] text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{items.length}</span>
              )}
            </Link>
          )}
          {!loading && user ? (
            <>
              <Link href={dashHref} className="btn btn-sm bg-white/10 text-white hover:bg-white/20 border-0">
                <LayoutDashboard size={14} /> <span className="hidden sm:inline">{user.name.split(' ')[0]}</span>
              </Link>
              <button onClick={() => { logout(); router.push('/'); }} className="p-2 rounded-lg hover:bg-white/10" title="Sign out">
                <LogOut size={16} />
              </button>
            </>
          ) : !loading && (
            <>
              <Link href="/login" className="btn btn-sm bg-white/10 text-white hover:bg-white/20 border-0">Sign in</Link>
              <Link href="/register" className="btn btn-sm btn-gold">Join now</Link>
            </>
          )}
        </div>
      </div>
      <div className="md:hidden flex gap-1 px-4 pb-2 overflow-x-auto text-sm">
        {links.map(l => (
          <Link key={l.href} href={l.href}
            className={`px-3 py-1 rounded-lg whitespace-nowrap ${pathname === l.href ? 'bg-white/15 font-semibold' : 'text-white/80'}`}>
            {l.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
