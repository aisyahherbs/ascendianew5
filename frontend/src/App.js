import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth } from './lib/auth';
import './App.css';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import MemberDetail from './pages/MemberDetail';
import Users from './pages/Users';
import NetworkPage from './pages/NetworkPage';
import Transactions from './pages/Transactions';
import Periods from './pages/Periods';
import BonusReport from './pages/BonusReport';
import Statement from './pages/Statement';
import Products from './pages/Products';
import Stock from './pages/Stock';
import Simulator from './pages/Simulator';
import PlanPage from './pages/PlanPage';
import SettingsPage from './pages/SettingsPage';
import Payout from './pages/Payout';
import Announcements from './pages/Announcements';

function Protected({ children, roles, page }) {
  const { user, loading, blockedPages } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Memuat...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  // Halaman ditutup oleh Admin Pusat: diarahkan ke dashboard tanpa pesan apa pun.
  if (page && (blockedPages || []).includes(page)) return <Navigate to="/" replace />;
  return children;
}

function Shell() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={!loading && user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/members" element={<Protected roles={['admin_pusat', 'admin_provinsi', 'stokis']} page="members"><Members /></Protected>} />
      <Route path="/members/:id" element={<Protected page="members"><MemberDetail /></Protected>} />
      <Route path="/users" element={<Protected roles={['admin_pusat']}><Users /></Protected>} />
      <Route path="/network" element={<Protected page="network"><NetworkPage /></Protected>} />
      <Route path="/announcements" element={<Protected page="announcements"><Announcements /></Protected>} />
      <Route path="/periods" element={<Protected roles={['admin_pusat', 'admin_provinsi']} page="periods"><Periods /></Protected>} />
      <Route path="/bonus" element={<Protected roles={['admin_pusat', 'admin_provinsi', 'stokis']} page="bonus"><BonusReport /></Protected>} />
      <Route path="/payout" element={<Protected roles={['admin_pusat', 'admin_provinsi', 'stokis']} page="payout"><Payout /></Protected>} />
      <Route path="/transactions" element={<Protected roles={['admin_pusat', 'admin_provinsi', 'stokis']} page="transactions"><Transactions /></Protected>} />
      <Route path="/statement" element={<Protected page="statement"><Statement /></Protected>} />
      <Route path="/products" element={<Protected page="products"><Products /></Protected>} />
      <Route path="/stock" element={<Protected roles={['admin_pusat', 'admin_provinsi', 'stokis']} page="stock"><Stock /></Protected>} />
      <Route path="/simulator" element={<Protected page="simulator"><Simulator /></Protected>} />
      <Route path="/plan" element={<Protected page="plan"><PlanPage /></Protected>} />
      <Route path="/settings" element={<Protected roles={['admin_pusat']}><SettingsPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell />
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}
