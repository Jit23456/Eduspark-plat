'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

const API_URL = process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '/api' : 'http://localhost:5000/api');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const api = useCallback(async (method, path, body, overrideToken) => {
    const t = overrideToken !== undefined ? overrideToken : (typeof window !== 'undefined' ? localStorage.getItem('eduspark_token') : null);
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status, data });
    return data;
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('eduspark_token');
    if (!stored) { setLoading(false); return; }
    setToken(stored);
    api('GET', '/auth/me', null, stored)
      .then(setUser)
      .catch(() => { localStorage.removeItem('eduspark_token'); setToken(null); })
      .finally(() => setLoading(false));
  }, [api]);

  const adoptSession = (data) => {
    localStorage.setItem('eduspark_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const login = async (email, password) => adoptSession(await api('POST', '/auth/login', { email, password }, null));
  const register = async (payload) => adoptSession(await api('POST', '/auth/register', payload, null));
  const googleLogin = async (credential, class_level) =>
    adoptSession(await api('POST', '/auth/google', { credential, class_level }, null));
  const updateProfile = async (payload) => adoptSession(await api('PATCH', '/auth/profile', payload));

  const logout = () => {
    localStorage.removeItem('eduspark_token');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try { setUser(await api('GET', '/auth/me')); } catch { /* keep current */ }
  };

  return (
    <AuthContext.Provider value={{
      user, token, loading, api,
      login, register, googleLogin, updateProfile, logout, refreshUser,
      isStudent: user?.role === 'STUDENT',
      isTeacher: user?.role === 'TEACHER' || user?.role === 'ADMIN',
      isPremium: !!user?.is_premium,
      apiUrl: API_URL,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export const rupees = (paise) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format((paise || 0) / 100);

export const CLASSES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
