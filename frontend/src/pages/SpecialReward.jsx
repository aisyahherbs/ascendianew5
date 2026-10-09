import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Building2, Gift, Lock, Percent, Users } from 'lucide-react';
import AppShell from '../components/AppShell';
import PeriodFilter from '../components/PeriodFilter';
import StatCard from '../components/StatCard';
import { RankBadge } from '../components/Badges';
import { api, errMsg } from '../lib/api';
import { num, rp, tanggal } from '../lib/format';

export default function SpecialReward() {
  const [range, setRange] = useState({ mode: 'period', key: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!range.key) return;
    setLoading(true);
    try {
      const { data: d } = await api.get('/special-reward', { params: { mode: range.mode, key: range.key } });
      setData(d);
    } catch (e) { toast.error(errMsg(e)); setData(null); } finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  return (
    <AppShell
      title="Special Reward"
      subtitle="Dana reward yang dikelola penuh oleh Admin Pusat — tidak terlihat oleh peran lain"
    >
      <div className="grid gap-4">
        <div className="rounded-xl border bg-card p-3">
          <PeriodFilter value={range} onChange={setRange} testid="reward-filter" />
        </div>

        <p className="flex items-start gap-2 rounded-xl border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.1)] px-3 py-2 text-[12.5px] leading-relaxed"
          data-testid="reward-privacy-note">
          <Lock className="mt-[2px] h-4 w-4 shrink-0" />
          <span>
            Halaman ini <b>hanya untuk Admin Pusat</b>. Angka, rumus, dan daftar kualifikasi
            Special Reward tidak pernah ditampilkan ke Admin Provinsi, Stokis, maupun Member,
            dan tidak masuk total bonus / slip bonus siapa pun.
          </span>
        </p>

        {loading ? (
          <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Menghitung dana reward...</p>
        ) : !data ? (
          <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Belum ada data pada rentang ini</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border bg-accent px-4 py-3 text-[12.5px]"
              data-testid="reward-range-info">
              <span><span className="text-muted-foreground">Rentang </span><b>{data.label}</b></span>
              <span className="font-mono">{tanggal(data.date_from)} &ndash; {tanggal(data.date_to)}</span>
              <span className="text-muted-foreground">Kualifikasi minimal peringkat <b className="text-foreground">{data.qualify_rank || '-'}</b></span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard testid="reward-pool" tone="warning" icon={Gift} label={`Dana Special Reward (${num(data.pool_percent, 2)}% omset)`}
                value={`${num(data.pool_bv)} BV`} sub={rp(data.pool_rp)} />
              <StatCard testid="reward-omset" tone="primary" icon={Percent} label="Omset Rentang Ini"
                value={`${num(data.omset_total_pv)} PV`} sub={`Payout terpakai ${num(data.payout_percent, 2)}%`} />
              <StatCard testid="reward-company" tone="info" icon={Building2} label="Sisa Perusahaan"
                value={`${num(data.company_bv)} BV`} sub={`${num(data.company_percent, 2)}% dari omset`} />
              <StatCard testid="reward-headroom" tone="success" icon={Building2} label="Sisa Setelah Reward Dibagikan"
                value={`${num(data.sisa_setelah_reward_bv)} BV`} sub="batas aman agar payout tidak terlampaui" />
            </div>

            <p className="rounded-xl border bg-card px-3 py-2 text-[12px] leading-relaxed text-muted-foreground"
              data-testid="reward-catatan">{data.catatan}</p>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border bg-card">
                <div className="border-b px-4 py-3">
                  <h3 className="font-display text-base font-semibold">Dana per Periode</h3>
                </div>
                <div className="table-wrap">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Periode</th>
                        <th className="px-3 py-2 text-right">Omset</th>
                        <th className="px-3 py-2 text-right">Dana Reward</th>
                        <th className="px-3 py-2 text-right">Kualifikasi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.periods || []).length === 0 ? (
                        <tr><td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">Belum ada periode</td></tr>
                      ) : data.periods.map((p) => (
                        <tr key={p.period_key} className="border-b last:border-0" data-testid={`reward-period-${p.period_key}`}>
                          <td className="px-3 py-2">
                            <p className="font-medium">{p.label}</p>
                            <p className="text-[11px] text-muted-foreground">{p.status === 'closed' ? 'sudah tutup buku' : 'periode berjalan'}</p>
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{num(p.omset_pv)} PV</td>
                          <td className="px-3 py-2 text-right font-mono">{num(p.pool_bv)} BV</td>
                          <td className="px-3 py-2 text-right font-mono">{num(p.jumlah_kualifikasi)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border bg-card">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h3 className="font-display text-base font-semibold">Member Memenuhi Kualifikasi</h3>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> {num((data.qualifiers || []).length)} orang
                  </span>
                </div>
                <div className="table-wrap">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Member</th>
                        <th className="px-3 py-2 text-right">Periode</th>
                        <th className="px-3 py-2 text-right">Alokasi Rata (acuan)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.qualifiers || []).length === 0 ? (
                        <tr><td colSpan={3} className="p-6 text-center text-sm text-muted-foreground">Belum ada member yang memenuhi kualifikasi</td></tr>
                      ) : data.qualifiers.map((q) => (
                        <tr key={q.member_id} className="border-b last:border-0" data-testid={`reward-qualifier-${q.member_id}`}>
                          <td className="px-3 py-2">
                            <p className="font-mono text-[11px] text-muted-foreground">{q.member_id}</p>
                            <p className="font-medium">{q.name}</p>
                            <div className="mt-1"><RankBadge rank={q.rank} /></div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{num(q.periode)}</td>
                          <td className="px-3 py-2 text-right font-mono">{num(q.alokasi_rata_bv)} BV</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="border-t px-4 py-2 text-[11.5px] text-muted-foreground">
                  Kolom "Alokasi Rata" hanya acuan bila dana dibagi rata. Pusat bebas menentukan
                  bentuk & besaran pemberian (BV, barang, perjalanan, dll).
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
