import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Award, Coins, Megaphone, Receipt, TrendingUp, Users, Wallet } from 'lucide-react';
import AppShell from '../components/AppShell';
import StatCard from '../components/StatCard';
import { CategoryBadge, MembershipBadge, RankBadge, TupoBadge } from '../components/Badges';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BONUS_LIST, num, periodLabel, rp, tanggal } from '../lib/format';

/** Widget pengumuman terbaru dari pusat (semua peran). */
function AnnouncementWidget() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get('/announcements', { params: { limit: 5 } })
      .then(({ data }) => setRows(data.slice(0, 5))).catch(() => {});
  }, []);
  return (
    <div className="card-c overflow-hidden" data-testid="dashboard-announcements">
      <div className="card-head">
        <h3 className="card-title flex items-center gap-1.5">
          <Megaphone className="h-3.5 w-3.5 text-primary" /> Pengumuman Terbaru
        </h3>
        <Link to="/announcements" className="text-[11px] font-medium text-primary hover:underline" data-testid="link-announcements">
          Lihat semua
        </Link>
      </div>
      <div className="grid gap-1.5 p-2.5">
        {rows.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">Belum ada pengumuman dari pusat.</p>
        ) : rows.map((a) => (
          <Link key={a.id} to="/announcements"
            className="rounded-md border bg-background px-2.5 py-1.5 hover:bg-accent/50"
            data-testid={`dashboard-announcement-${a.id}`}>
            <div className="flex flex-wrap items-center gap-1.5">
              <CategoryBadge category={a.category} />
              <span className="text-[10.5px] text-muted-foreground">{tanggal(a.created_at)}</span>
            </div>
            <p className="mt-0.5 text-[12.5px] font-medium leading-snug">{a.title}</p>
            <p className="line-clamp-2 text-[11px] text-muted-foreground">{a.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(({ data }) => setD(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const period = d?.period;
  const sub = period ? `${periodLabel(period.key)} · ${period.status === 'open' ? 'periode berjalan' : 'sudah ditutup'} · tutup buku ${tanggal(period.close_date)}` : '';

  if (loading) {
    return <AppShell title="Dashboard"><p className="text-sm text-muted-foreground">Memuat data...</p></AppShell>;
  }

  const isAdmin = d?.role === 'admin_pusat' || d?.role === 'admin_provinsi';

  return (
    <AppShell title={`Selamat datang, ${user?.name || ''}`} subtitle={sub}>
      {isAdmin ? <AdminView d={d} /> : d?.role === 'stokis' ? <StokisView d={d} /> : <MemberView d={d} />}    </AppShell>
  );
}

function AdminView({ d }) {
  const comp = Object.entries(d.bonus_composition || {}).map(([k, v]) => ({ name: k.replace('Bonus ', ''), bv: v }));
  return (
    <div className="grid gap-4 md:gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard testid="kpi-omset-total" label="Omset Periode Ini" value={`${num(d.omset_total)} PV`} sub={rp(d.omset_total * 1000)} icon={TrendingUp} tone="primary" />
        <StatCard testid="kpi-omset-perkembangan" label="Omset Perkembangan" value={`${num(d.omset_perkembangan)} PV`} sub="Sponsor · Pasangan · Bimbingan" icon={Coins} tone="info" />
        <StatCard testid="kpi-omset-penjualan" label="Omset Penjualan" value={`${num(d.omset_penjualan)} PV`} sub="Prestasi · Kepemimpinan" icon={Receipt} tone="warning" />
        <StatCard testid="kpi-total-bonus" label="Total Bonus" value={`${num(d.total_bonus_bv)} BV`} sub={rp(d.total_bonus_bv * 1000)} icon={Wallet} tone="success" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard testid="kpi-members" label="Total Pengguna" value={num(d.total_members)} sub={`${num(d.active_members)} aktif`} icon={Users} tone="violet" />
        <StatCard testid="kpi-member-role" label="Member" value={num(d.by_role?.member || 0)} sub="distributor terdaftar" />
        <StatCard testid="kpi-stokis" label="Stokis" value={num(d.by_role?.stokis || 0)} sub="titik pendaftaran & omset" />
        <StatCard testid="kpi-admin-provinsi" label="Admin Provinsi" value={num(d.by_role?.admin_provinsi || 0)} sub="pengelola wilayah" />
        <StatCard testid="kpi-stokis-fee-total" label="Fee Perantara Stokis" value={`${num(d.stokis_fee_total || 0)} BV`} sub="masuk total payout" icon={Wallet} tone="warning" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 lg:col-span-2">
          <h3 className="font-display text-base font-semibold">Tren Omset & Bonus per Periode</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.trend || []}>
                <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => num(v)} />
                <Tooltip formatter={(v) => num(v)} />
                <Line type="monotone" dataKey="omset" name="Omset PV" stroke="hsl(var(--chart-1))" strokeWidth={2} dot />
                <Line type="monotone" dataKey="bonus" name="Bonus BV" stroke="hsl(var(--chart-3))" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h3 className="font-display text-base font-semibold">Komposisi 7 Bonus (BV)</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comp} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => num(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                <Tooltip formatter={(v) => `${num(v)} BV`} />
                <Bar dataKey="bv" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <AnnouncementWidget />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="font-display text-base font-semibold">Bonus Tertinggi Periode Ini</h3>
            <Link to="/bonus" className="text-xs text-primary hover:underline" data-testid="link-bonus-report">Lihat laporan</Link>
          </div>
          <div className="table-wrap">
            <table className="w-full text-sm">
              <tbody>
                {(d.top_earners || []).length === 0 ? (
                  <tr><td className="p-6 text-center text-sm text-muted-foreground">Belum ada bonus di periode ini</td></tr>
                ) : (
                  d.top_earners.map((t) => (
                    <tr key={t.member_id} className="border-b last:border-0 hover:bg-muted/60">
                      <td className="px-4 py-3 font-mono text-xs">{t.member_id}</td>
                      <td className="px-2 py-3">{t.name}</td>
                      <td className="px-2 py-3"><RankBadge rank={t.rank} /></td>
                      <td className="px-4 py-3 text-right font-mono">{num(t.total)} BV</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="font-display text-base font-semibold">Input Omset Terbaru</h3>
            <Link to="/transactions" className="text-xs text-primary hover:underline" data-testid="link-transactions">Kelola omset</Link>
          </div>
          <div className="table-wrap">
            <table className="w-full text-sm">
              <tbody>
                {(d.recent_transactions || []).length === 0 ? (
                  <tr><td className="p-6 text-center text-sm text-muted-foreground">Belum ada transaksi</td></tr>
                ) : (
                  d.recent_transactions.map((t) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/60">
                      <td className="px-4 py-3 font-mono text-xs">{t.member_id}</td>
                      <td className="px-2 py-3">{t.member_name}</td>
                      <td className="px-2 py-3 text-xs capitalize text-muted-foreground">{t.kind}</td>
                      <td className="px-4 py-3 text-right font-mono">{num(t.pv)} PV</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {(d.stokis_fees || []).length ? (
        <div className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3"><h3 className="font-display text-base font-semibold">Fee Perantara Stokis</h3></div>
          <div className="table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-2 text-left">Stokis</th><th className="px-4 py-2 text-right">Omset Member</th><th className="px-4 py-2 text-right">Fee</th></tr>
              </thead>
              <tbody>
                {d.stokis_fees.map((f) => (
                  <tr key={f.stokis_id} className="border-b last:border-0">
                    <td className="px-4 py-2"><span className="font-mono text-xs">{f.stokis_id}</span> {f.name}</td>
                    <td className="px-4 py-2 text-right font-mono">{num(f.omset_pv)} PV</td>
                    <td className="px-4 py-2 text-right font-mono">{num(f.fee_bv)} BV</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StokisView({ d }) {
  return (
    <div className="grid gap-4 md:gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard testid="kpi-stokis-members" label="Member Stokis Anda" value={num(d.member_count)} sub={`${num(d.active_count)} aktif`} icon={Users} tone="primary" />
        <StatCard testid="kpi-stokis-omset" label="Omset Periode Ini" value={`${num(d.omset_total)} PV`} sub={rp(d.omset_total * 1000)} icon={TrendingUp} />
        <StatCard testid="kpi-stokis-perkembangan" label="Omset Perkembangan" value={`${num(d.omset_perkembangan)} PV`} />
        <StatCard testid="kpi-stokis-fee" label={`Fee Perantara (${num(d.fee_percent, 2)}%)`} value={`${num(d.fee_bv)} BV`} sub={rp(d.fee_bv * 1000)} icon={Wallet} />
      </div>
      <AnnouncementWidget />
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-display text-base font-semibold">Member Terdaftar di Stokis Anda</h3>
          <Link to="/members" className="text-xs text-primary hover:underline" data-testid="link-members">Kelola member</Link>
        </div>
        <div className="table-wrap">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">ID</th><th className="px-2 py-2 text-left">Nama</th>
                <th className="px-2 py-2 text-left">Peringkat</th><th className="px-2 py-2 text-left">Membership</th>
                <th className="px-2 py-2 text-right">PPV</th><th className="px-4 py-2 text-right">Bonus</th>
              </tr>
            </thead>
            <tbody>
              {(d.members || []).length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">Belum ada member</td></tr>
              ) : d.members.map((m) => (
                <tr key={m.member_id} className="border-b last:border-0 hover:bg-muted/60">
                  <td className="px-4 py-2 font-mono text-xs">{m.member_id}</td>
                  <td className="px-2 py-2">{m.name}</td>
                  <td className="px-2 py-2"><RankBadge rank={m.rank} /></td>
                  <td className="px-2 py-2"><MembershipBadge membership={m.membership} /></td>
                  <td className="px-2 py-2 text-right font-mono">{num(m.ppv)}</td>
                  <td className="px-4 py-2 text-right font-mono">{num(m.total_bonus_bv)} BV</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MemberView({ d }) {
  const my = d.my || {};
  const carry = Object.entries(my.carry || {});
  return (
    <div className="grid gap-4 md:gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard testid="kpi-my-bonus" label="Estimasi Bonus Periode Ini" value={`${num(my.total_bonus_bv)} BV`} sub={rp((my.total_bonus_bv || 0) * 1000)} icon={Wallet} tone="primary" />
        <StatCard testid="kpi-my-ppv" label="PPV Periode Ini" value={`${num(my.ppv)} PV`} sub={`Perkembangan ${num(my.ppv_perkembangan)} · Penjualan ${num(my.ppv_penjualan)}`} icon={Receipt} />
        <StatCard testid="kpi-my-tnpv" label="TNPV / ATNPV" value={`${num(my.tnpv)} PV`} sub={`Akumulasi ${num(my.atnpv)} PV`} icon={TrendingUp} />
        <StatCard testid="kpi-my-appv" label="APPV" value={`${num(my.appv)} PV`} sub={`Perkembangan ${num(my.appv_perkembangan)} PV`} icon={Award} />
      </div>

      <AnnouncementWidget />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="font-display text-base font-semibold">Status Saya</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <RankBadge rank={my.rank} />
            <MembershipBadge membership={my.membership} />
            <TupoBadge ok={my.tupo_ok} required={my.tupo_required} />
          </div>
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Frontline sponsor</dt><dd className="font-mono">{num(d.frontline_sponsor)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Frontline placement</dt><dd className="font-mono">{num(d.frontline_placement)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Tupo wajib</dt><dd className="font-mono">{num(my.tupo_required)} PV penjualan</dd></div>
          </dl>
          <Link to="/statement" className="mt-4 inline-block text-xs text-primary hover:underline" data-testid="link-statement">Lihat slip bonus lengkap</Link>
        </div>

        <div className="rounded-xl border bg-card p-4 lg:col-span-2">
          <h3 className="font-display text-base font-semibold">Rincian 7 Bonus Periode Ini</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {BONUS_LIST.map((b) => (
              <div key={b.key} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2" data-testid={`my-${b.key}`}>
                <div>
                  <p className="text-sm font-medium">{b.label}</p>
                  <p className="text-[11px] text-muted-foreground">{b.group}</p>
                </div>
                <p className="font-mono text-sm">{num(my[b.key])} BV</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="font-display text-base font-semibold">Sisa Omset Pasangan per Jalur</h3>
          <p className="mt-1 text-xs text-muted-foreground">Omset perkembangan yang tersimpan untuk perhitungan bonus pasangan periode berikutnya.</p>
          <div className="mt-3 grid gap-2">
            {carry.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada sisa omset.</p> : carry.map(([leg, v]) => (
              <div key={leg} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
                <span className="font-mono text-xs">Jalur {leg}</span>
                <span className="font-mono text-sm">{num(v)} PV</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h3 className="font-display text-base font-semibold">Riwayat Bonus</h3>
          <div className="mt-3 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.history || []}>
                <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="period_key" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => num(v)} />
                <Tooltip formatter={(v) => `${num(v)} BV`} />
                <Bar dataKey="total_bonus_bv" name="Total Bonus" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
