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
    const t = overrideToken !== undefined ? overrideToken : (typeof window !== 'undefined' ? localStorage.getItem('fvca_token') : null);
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
    const stored = localStorage.getItem('fvca_token');
    if (!stored) { setLoading(false); return; }
    setToken(stored);
    api('GET', '/auth/me', null, stored)
      .then(setUser)
      .catch(() => { localStorage.removeItem('fvca_token'); setToken(null); })
      .finally(() => setLoading(false));
  }, [api]);

  const adoptSession = (data) => {
    localStorage.setItem('fvca_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const login = async (email, password) => adoptSession(await api('POST', '/auth/login', { email, password }, null));
  const register = async (payload) => adoptSession(await api('POST', '/auth/register', payload, null));
  const setPassword = async (new_password) => adoptSession(await api('POST', '/auth/set-password', { new_password }));

  const logout = () => {
    localStorage.removeItem('fvca_token');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try { setUser(await api('GET', '/auth/me')); } catch { /* keep current */ }
  };

  const isStaff = user && ['FRANCHISOR_MANAGEMENT', 'FRANCHISOR_ADMIN', 'FRANCHISEE_MANAGEMENT', 'FRANCHISEE_ADMIN', 'EVENT_MANAGER'].includes(user.role);
  const isFranchisor = user && ['FRANCHISOR_MANAGEMENT', 'FRANCHISOR_ADMIN'].includes(user.role);
  const isManagement = user && ['FRANCHISOR_MANAGEMENT', 'FRANCHISEE_MANAGEMENT'].includes(user.role);

  return (
    <AuthContext.Provider value={{
      user, token, loading, api, login, register, setPassword, logout, refreshUser,
      isStaff, isFranchisor, isManagement,
      isCoach: user?.role === 'COACH',
      isCustomer: user?.role === 'CUSTOMER',
      apiUrl: API_URL,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export const money = (cents, currency = 'CAD') =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format((cents || 0) / 100);

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
