import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('mlm_user') || 'null');
    } catch {
      return null;
    }
  });
  const [blockedPages, setBlockedPages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('mlm_blocked') || '[]');
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);

  const applyMe = (data) => {
    setUser(data.user);
    localStorage.setItem('mlm_user', JSON.stringify(data.user));
    const blocked = data.blocked_pages || [];
    setBlockedPages(blocked);
    localStorage.setItem('mlm_blocked', JSON.stringify(blocked));
  };

  useEffect(() => {
    const token = localStorage.getItem('mlm_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then(({ data }) => applyMe(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = async (member_id, password) => {
    const { data } = await api.post('/auth/login', { member_id, password });
    localStorage.setItem('mlm_token', data.token);
    applyMe(data);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('mlm_token');
    localStorage.removeItem('mlm_user');
    localStorage.removeItem('mlm_blocked');
    setUser(null);
    setBlockedPages([]);
    window.location.href = '/login';
  };

  const value = useMemo(
    () => ({ user, loading, login, logout, setUser, blockedPages }),
    [user, loading, blockedPages],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export const isAdmin = (role) => role === 'admin_pusat' || role === 'admin_provinsi';
export const canInput = (role) => isAdmin(role) || role === 'stokis';
