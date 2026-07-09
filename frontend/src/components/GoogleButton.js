'use client';

import { useEffect, useRef, useState } from 'react';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Renders the official Google Identity Services button and hands the ID token
// credential to onCredential(credential). Hidden when no client id is set.
export default function GoogleButton({ onCredential, text = 'signin_with' }) {
  const slot = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID || !slot.current) return;
    let cancelled = false;

    const renderButton = () => {
      if (cancelled || !window.google?.accounts?.id || !slot.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (resp) => onCredential(resp.credential),
      });
      window.google.accounts.id.renderButton(slot.current, {
        theme: 'filled_black', size: 'large', shape: 'pill', width: 320, text,
      });
    };

    if (window.google?.accounts?.id) {
      renderButton();
    } else {
      let script = document.getElementById('gsi-script');
      if (!script) {
        script = document.createElement('script');
        script.id = 'gsi-script';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', renderButton);
      script.addEventListener('error', () => setFailed(true));
    }
    return () => { cancelled = true; };
  }, [onCredential, text]);

  if (!CLIENT_ID) {
    return (
      <p className="text-xs text-[var(--ink-soft)] text-center">
        Google sign-in is not configured — set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in frontend/.env.local
        and <code>GOOGLE_CLIENT_ID</code> in backend/.env.
      </p>
    );
  }
  if (failed) return <p className="text-xs text-[var(--red)] text-center">Could not load Google sign-in. Check your connection.</p>;
  return <div ref={slot} className="flex justify-center" />;
}
