import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, Boxes, CalendarClock, Coins, FileText, Gauge, LayoutDashboard, LogOut,
  Megaphone, Menu, Network, Percent, Receipt, Settings, ShieldCheck, Users, X, BookOpen, Warehouse,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ROLE_LABEL, periodLabel } from '../lib/format';
import { api } from '../lib/api';
import { useCompany } from '../lib/company';

const ALL = ['admin_pusat', 'admin_provinsi', 'stokis', 'member'];
const OPS = ['admin_pusat', 'admin_provinsi', 'stokis'];

const GROUPS = [
  {
    label: 'Ringkasan',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ALL },
      { to: '/announcements', label: 'Pengumuman', icon: Megaphone, roles: ALL, page: 'announcements' },
    ],
  },
  {
    label: 'Jaringan & Pengguna',
    items: [
      { to: '/members', label: 'Member', icon: Users, roles: OPS, page: 'members' },
      { to: '/users', label: 'Admin & Stokis', icon: ShieldCheck, roles: ['admin_pusat'] },
      { to: '/network', label: 'Jaringan', icon: Network, roles: ALL, page: 'network' },
    ],
  },
  {
    label: 'Omset & Bonus',
    items: [
      { to: '/transactions', label: 'Omset', icon: Receipt, roles: OPS, page: 'transactions' },
      { to: '/periods', label: 'Tutup Buku', icon: CalendarClock, roles: ['admin_pusat', 'admin_provinsi'], page: 'periods' },
      { to: '/bonus', label: 'Laporan Bonus', icon: BarChart3, roles: OPS, page: 'bonus' },
      { to: '/payout', label: 'Payout & Omset', icon: Percent, roles: OPS, page: 'payout' },
      { to: '/statement', label: 'Slip Bonus', icon: FileText, roles: ALL, page: 'statement' },
    ],
  },
  {
    label: 'Produk',
    items: [
      { to: '/products', label: 'Katalog Produk', icon: Boxes, roles: ALL, page: 'products' },
      { to: '/stock', label: 'Stok', icon: Warehouse, roles: OPS, page: 'stock' },
    ],
  },
  {
    label: 'Alat Bantu',
    items: [
      { to: '/simulator', label: 'Simulator Bonus', icon: Gauge, roles: ALL, page: 'simulator' },
      { to: '/plan', label: 'Marketing Plan', icon: BookOpen, roles: ALL, page: 'plan' },
      { to: '/settings', label: 'Pengaturan', icon: Settings, roles: ['admin_pusat'] },
    ],
  },
];

export default function AppShell({ children, title, subtitle, actions }) {
  const { user, logout, blockedPages } = useAuth();
  const company = useCompany();
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState(null);

  useEffect(() => {
    api.get('/periods').then(({ data }) => setPeriod(data.find((p) => p.is_current) || data[0])).catch(() => {});
  }, []);

  const active = (to) => (to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to));
  const blocked = blockedPages || [];
  const groups = GROUPS
    .map((g) => ({
      ...g,
      items: g.items.filter((n) => n.roles.includes(user?.role) && !(n.page && blocked.includes(n.page))),
    }))
    .filter((g) => g.items.length);

  const SideContent = (
    <div className="flex h-full flex-col bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">
      <div className="flex items-center gap-2 border-b border-[hsl(var(--sidebar-border))] px-3 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--sidebar-active))] text-white">
          <Coins className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-[13px] font-semibold leading-tight" data-testid="sidebar-company-name">
            {company.company_name}
          </p>
          <p className="truncate text-[10.5px] text-[hsl(var(--sidebar-foreground)/0.55)]">Backoffice</p>
        </div>
      </div>

      <div className="border-b border-[hsl(var(--sidebar-border))] px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-[hsl(var(--sidebar-foreground)/0.5)]">Masuk sebagai</p>
        <p className="mt-0.5 truncate text-[13px] font-medium">{user?.name}</p>
        <p className="truncate font-mono text-[10.5px] text-[hsl(var(--sidebar-foreground)/0.6)]">
          {user?.member_id} · {ROLE_LABEL[user?.role]}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {groups.map((g) => (
          <div key={g.label} className="mb-1.5">
            <p className="px-2 pb-1 pt-1.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--sidebar-foreground)/0.45)]">
              {g.label}
            </p>
            <div className="space-y-0.5">
              {g.items.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  data-testid={`nav-${n.to === '/' ? 'dashboard' : n.to.slice(1)}`}
                  className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                    active(n.to)
                      ? 'bg-[hsl(var(--sidebar-active))] font-semibold text-[hsl(var(--sidebar-active-foreground))]'
                      : 'text-[hsl(var(--sidebar-foreground)/0.82)] hover:bg-[hsl(var(--sidebar-muted))] hover:text-white'
                  }`}
                >
                  <n.icon className="h-3.5 w-3.5 shrink-0 opacity-90" />
                  <span className="truncate">{n.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[hsl(var(--sidebar-border))] p-2">
        <button
          onClick={logout}
          data-testid="logout-button"
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-[hsl(var(--sidebar-foreground)/0.75)] hover:bg-[hsl(var(--sidebar-muted))] hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" /> Keluar
        </button>
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-[232px] lg:flex-col">{SideContent}</aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[80%] max-w-[280px] shadow-xl">
            <button className="absolute right-2 top-2.5 z-10 rounded p-1.5 text-white/80 hover:bg-white/10" onClick={() => setOpen(false)} data-testid="close-menu">
              <X className="h-4 w-4" />
            </button>
            {SideContent}
          </div>
        </div>
      ) : null}

      <div className="lg:pl-[232px]">
        <header className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b bg-card/95 px-3 backdrop-blur md:px-4">
          <button className="rounded-md p-1.5 hover:bg-muted lg:hidden" onClick={() => setOpen(true)} data-testid="open-menu">
            <Menu className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[15px] font-semibold leading-tight md:text-base">{title}</h1>
            {subtitle ? <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p> : null}
          </div>
          {period ? (
            <button
              onClick={() => nav('/periods')}
              data-testid="topbar-period"
              className="hidden items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-[11px] hover:bg-muted sm:flex"
            >
              <CalendarClock className="h-3 w-3 text-primary" />
              <span className="font-mono">{periodLabel(period.key)}</span>
              <span className={period.status === 'open' ? 'font-semibold text-[hsl(var(--success))]' : 'text-muted-foreground'}>
                {period.status === 'open' ? 'Buka' : 'Ditutup'}
              </span>
            </button>
          ) : null}
          {actions}
        </header>
        <main className="px-3 py-3 md:px-4 md:py-4">{children}</main>
      </div>
    </div>
  );
}
