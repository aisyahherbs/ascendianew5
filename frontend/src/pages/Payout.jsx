import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip,
} from 'recharts';
import { Building2, CalendarDays, Coins, Download, Percent, Store, TrendingUp } from 'lucide-react';
import AppShell from '../components/AppShell';
import PeriodFilter from '../components/PeriodFilter';
import StatCard from '../components/StatCard';
import { RankBadge } from '../components/Badges';
import { Button } from '../components/ui/button';
import { api, downloadCsv, errMsg } from '../lib/api';
import { num, rp, tanggal } from '../lib/format';

const COLORS = ['#0F766E', '#E4A11B', '#2E6FA7', '#B4322F', '#6C5CE7', '#1F8A5B', '#8A5B00'];

export default function Payout() {
  const [range, setRange] = useState({ mode: 'period', key: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!range.key) return;
    setLoading(true);
    try {
      const { data: d } = await api.get('/payout', { params: { mode: range.mode, key: range.key } });
      setData(d);
    } catch (e) { toast.error(errMsg(e)); setData(null); } finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    try {
      await downloadCsv(`/bonus/export?mode=${range.mode}&key=${range.key}`, `payout-${range.mode}-${range.key}.csv`);
      toast.success('CSV diunduh');
    } catch (e) { toast.error('Gagal mengunduh CSV'); }
  };

  const omset = data?.omset?.total || 0;
  const bonus = data?.bonus?.total_bv || 0;
  const fee = data?.stokis_fee?.total_bv || 0;
  const company = data?.company_bv || 0;
  const payoutPct = data?.payout_percent || 0;
  const feePct = data?.stokis_fee?.percent || 0;
  const companyPct = data?.company_percent || 0;
  const totalPayout = data?.total_payout_bv ?? bonus + fee;
  const totalPayoutPct = data?.total_payout_percent ?? payoutPct + feePct;

  const pieData = [
    { name: 'Bonus ke member', value: Math.max(bonus, 0) },
    { name: 'Fee stokis', value: Math.max(fee, 0) },
    { name: 'Sisa perusahaan', value: Math.max(company, 0) },
  ].filter((d) => d.value > 0);

  const perType = Object.entries(data?.bonus?.per_type || {});

  return (
    <AppShell
      title="Payout & Detail Omset"
      subtitle="Omset masuk, bonus yang dikeluarkan, persentase payout, dan sisa yang dikelola perusahaan"
      actions={<Button variant="outline" onClick={exportCsv} data-testid="payout-export-csv"><Download className="mr-1 h-4 w-4" /> CSV</Button>}
    >
      <div className="grid gap-4">
        <div className="rounded-xl border bg-card p-3">
          <PeriodFilter value={range} onChange={setRange} testid="payout-filter" />
        </div>

        {loading ? (
          <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Menghitung payout...</p>
        ) : !data ? (
          <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Belum ada data untuk rentang ini.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-accent px-4 py-3" data-testid="payout-range-info">
              <span className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <span>
                  <span className="block text-[11px] uppercase text-muted-foreground">Rentang</span>
                  <span className="font-display text-sm font-semibold" data-testid="payout-range-label">{data.label}</span>
                </span>
              </span>
              <span>
                <span className="block text-[11px] uppercase text-muted-foreground">Tanggal</span>
                <span className="font-mono text-sm" data-testid="payout-range-dates">{tanggal(data.date_from)} &ndash; {tanggal(data.date_to)}</span>
              </span>
              <span>
                <span className="block text-[11px] uppercase text-muted-foreground">Bulan / Tahun</span>
                <span className="font-mono text-sm">{data.month ? `${String(data.month).padStart(2, '0')} / ` : ''}{data.year || '-'}</span>
              </span>
              <span>
                <span className="block text-[11px] uppercase text-muted-foreground">Periode tercakup</span>
                <span className="font-mono text-sm">{(data.periods || []).map((p) => `P${p.period_key.slice(-1)}`).join(', ') || '-'}</span>
              </span>
              <span>
                <span className="block text-[11px] uppercase text-muted-foreground">Transaksi</span>
                <span className="font-mono text-sm">{num(data.omset?.tx_count)} transaksi · {num(data.member_count)} member</span>
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard testid="payout-omset" tone="primary" icon={TrendingUp} label="Omset Masuk"
                value={`${num(omset)} PV`} sub={`${rp(data.omset.total_rp)} · Perk ${num(data.omset.perkembangan)} / Penj ${num(data.omset.penjualan)}`} />
              <StatCard testid="payout-bonus" tone="info" icon={Coins} label="Bonus ke Member"
                value={`${num(bonus)} BV`} sub={`${rp(data.bonus.total_rp)} · ${num(data.earner_count)} member menerima`} />
              <StatCard testid="payout-stokis-fee" tone="warning" icon={Store} label={`Fee Perantara Stokis (${num(feePct, 2)}%)`}
                value={`${num(fee)} BV`} sub={`${rp((data.stokis_fee?.total_rp) || fee * (data.pv_to_rp || 1000))} · ${(data.stokis_fee?.rows || []).length} stokis`} />
              <StatCard testid="payout-total" tone="success" icon={Percent} label="Total Dikeluarkan"
                value={`${num(totalPayoutPct, 2)}%`} sub={`${num(totalPayout)} BV · bonus + fee stokis`} />
              <StatCard testid="payout-company" icon={Building2} label="Sisa untuk Perusahaan"
                value={`${num(companyPct, 2)}%`} sub={`${num(company)} BV · ${rp(data.company_rp)}`} />
            </div>

            <div className="card-c flex flex-wrap items-center gap-x-5 gap-y-1.5 px-3 py-2 text-[12px]" data-testid="payout-formula">
              <span className="font-semibold">Rumus payout:</span>
              <span className="font-mono">Bonus {num(bonus)} + Fee stokis {num(fee)} = <b>Total dikeluarkan {num(totalPayout)} BV</b> ({num(totalPayoutPct, 2)}% dari omset {num(omset)} PV)</span>
              <span className="font-mono text-muted-foreground">Sisa perusahaan {num(company)} BV ({num(companyPct, 2)}%)</span>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border bg-card p-4">
                <h3 className="font-display text-base font-semibold">Pembagian Omset</h3>
                <p className="text-xs text-muted-foreground">Berapa bagian omset yang keluar sebagai bonus dan berapa yang tersisa.</p>
                <div className="mt-2 h-56" data-testid="payout-pie">
                  {pieData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={78} paddingAngle={2}>
                          {pieData.map((d, i) => <Cell key={d.name} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v) => `${num(v)} BV`} />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Belum ada omset pada rentang ini.</p>
                  )}
                </div>
                <div className="mt-2 grid gap-1 text-xs">
                  {[['Bonus ke member', bonus, payoutPct], ['Fee perantara stokis', fee, feePct], ['Total dikeluarkan', totalPayout, totalPayoutPct], ['Sisa perusahaan', company, companyPct]].map(([k, v, p]) => (
                    <div key={k} className="flex items-center justify-between rounded-md bg-muted/60 px-2 py-1.5">
                      <span>{k}</span>
                      <span className="font-mono">{num(v)} BV · {num(p, 2)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border bg-card lg:col-span-2">
                <div className="border-b px-4 py-3">
                  <h3 className="font-display text-base font-semibold">Bonus yang Dikeluarkan per Jenis</h3>
                  <p className="text-xs text-muted-foreground">Persentase dihitung terhadap total omset masuk pada rentang ini.</p>
                </div>
                <div className="table-wrap">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left">Jenis Bonus</th>
                        <th className="px-2 py-2 text-right">BV</th>
                        <th className="px-2 py-2 text-right">Rupiah</th>
                        <th className="px-4 py-2 text-right">% dari Omset</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perType.map(([label, val]) => (
                        <tr key={label} className="border-b last:border-0" data-testid={`payout-type-${label.replace(/\s+/g, '-')}`}>
                          <td className="px-4 py-2">{label}</td>
                          <td className="px-2 py-2 text-right font-mono">{num(val)}</td>
                          <td className="px-2 py-2 text-right font-mono text-muted-foreground">{rp(val * (data.pv_to_rp || 1000))}</td>
                          <td className="px-4 py-2 text-right font-mono">{omset ? num((val / omset) * 100, 2) : '0'}%</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/60 text-sm">
                      <tr>
                        <td className="px-4 py-2 font-medium">Total Bonus</td>
                        <td className="px-2 py-2 text-right font-mono font-semibold">{num(bonus)}</td>
                        <td className="px-2 py-2 text-right font-mono">{rp(data.bonus.total_rp)}</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold">{num(payoutPct, 2)}%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card">
              <div className="border-b px-4 py-3">
                <h3 className="font-display text-base font-semibold">Rincian per Periode</h3>
              </div>
              <div className="table-wrap">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left">Periode</th>
                      <th className="px-2 py-2 text-left">Status</th>
                      <th className="px-2 py-2 text-right">Omset Perkembangan</th>
                      <th className="px-2 py-2 text-right">Omset Penjualan</th>
                      <th className="px-2 py-2 text-right">Total Omset</th>
                      <th className="px-2 py-2 text-right">Bonus</th>
                      <th className="px-2 py-2 text-right">Fee Stokis</th>
                      <th className="px-2 py-2 text-right">Total Dikeluarkan</th>
                      <th className="px-4 py-2 text-right">% Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.periods || []).length === 0 ? (
                      <tr><td colSpan={9} className="p-6 text-center text-sm text-muted-foreground">Belum ada periode dengan data.</td></tr>
                    ) : data.periods.map((p) => (
                      <tr key={p.period_key} className="border-b last:border-0" data-testid={`payout-period-${p.period_key}`}>
                        <td className="px-4 py-2">
                          <p className="font-medium">{p.label}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">{p.period_key}</p>
                        </td>
                        <td className="px-2 py-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${p.status === 'closed' ? 'bg-muted text-muted-foreground' : 'border-[#C6EAD8] bg-[#E7F6EE] text-[#1F8A5B]'}`}>
                            {p.status === 'closed' ? 'Ditutup' : 'Berjalan'}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right font-mono">{num(p.omset_perkembangan)}</td>
                        <td className="px-2 py-2 text-right font-mono">{num(p.omset_penjualan)}</td>
                        <td className="px-2 py-2 text-right font-mono">{num(p.omset_pv)}</td>
                        <td className="px-2 py-2 text-right font-mono">{num(p.bonus_bv)}</td>
                        <td className="px-2 py-2 text-right font-mono">{num(p.stokis_fee_bv)}</td>
                        <td className="px-2 py-2 text-right font-mono font-semibold">{num(p.total_payout_bv)}</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold">{num(p.payout_percent, 2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border bg-card">
                <div className="border-b px-4 py-3"><h3 className="font-display text-base font-semibold">Omset per Produk</h3></div>
                <div className="table-wrap max-h-[360px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                      <tr><th className="px-4 py-2 text-left">Produk</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-right">Transaksi</th><th className="px-4 py-2 text-right">PV</th></tr>
                    </thead>
                    <tbody>
                      {(data.products || []).length === 0 ? (
                        <tr><td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">Belum ada transaksi.</td></tr>
                      ) : data.products.map((p) => (
                        <tr key={p.product_name} className="border-b last:border-0">
                          <td className="px-4 py-2">{p.product_name}</td>
                          <td className="px-2 py-2 text-right font-mono">{num(p.qty)}</td>
                          <td className="px-2 py-2 text-right font-mono text-muted-foreground">{num(p.tx_count)}</td>
                          <td className="px-4 py-2 text-right font-mono">{num(p.pv)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border bg-card">
                <div className="border-b px-4 py-3"><h3 className="font-display text-base font-semibold">Penerima Bonus Terbesar</h3></div>
                <div className="table-wrap max-h-[360px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                      <tr><th className="px-4 py-2 text-left">Member</th><th className="px-2 py-2 text-right">Omset Pribadi</th><th className="px-4 py-2 text-right">Bonus</th></tr>
                    </thead>
                    <tbody>
                      {(data.results || []).filter((r) => r.total_bonus_bv > 0).slice(0, 25).length === 0 ? (
                        <tr><td colSpan={3} className="p-6 text-center text-sm text-muted-foreground">Belum ada bonus pada rentang ini.</td></tr>
                      ) : data.results.filter((r) => r.total_bonus_bv > 0).slice(0, 25).map((r) => (
                        <tr key={r.member_id} className="border-b last:border-0" data-testid={`payout-earner-${r.member_id}`}>
                          <td className="px-4 py-2">
                            <p className="font-mono text-[11px] text-muted-foreground">{r.member_id}</p>
                            <p className="font-medium">{r.name}</p>
                            <div className="mt-1"><RankBadge rank={r.rank} /></div>
                          </td>
                          <td className="px-2 py-2 text-right font-mono">{num(r.ppv)} PV</td>
                          <td className="px-4 py-2 text-right font-mono font-semibold">{num(r.total_bonus_bv)} BV</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="card-c overflow-hidden">
              <div className="card-head">
                <h3 className="card-title">Fee Perantara Stokis</h3>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {num(feePct, 2)}% dari omset member · masuk ke total payout
                </span>
              </div>
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr><th className="px-3 text-left">Stokis</th><th className="px-2 text-left">Wilayah</th><th className="px-2 text-right">Omset Member</th><th className="px-3 text-right">Fee</th></tr>
                  </thead>
                  <tbody>
                    {(data.stokis_fee?.rows || []).length === 0 ? (
                      <tr><td colSpan={4} className="p-5 text-center text-[13px] text-muted-foreground" data-testid="payout-fee-empty">
                        {feePct ? 'Belum ada omset member melalui stokis pada rentang ini.' : 'Fee perantara stokis masih 0%. Atur di menu Pengaturan.'}
                      </td></tr>
                    ) : data.stokis_fee.rows.map((f) => (
                      <tr key={f.stokis_id} data-testid={`payout-fee-${f.stokis_id}`}>
                        <td className="px-3"><span className="font-mono text-[11px] font-semibold text-primary">{f.stokis_id}</span> {f.name}</td>
                        <td className="px-2 text-muted-foreground">{f.province || '-'}</td>
                        <td className="px-2 text-right font-mono">{num(f.omset_pv)} PV</td>
                        <td className="px-3 text-right font-mono font-semibold">{num(f.fee_bv)} BV</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/60 text-[13px]">
                    <tr>
                      <td className="px-3 py-1.5 font-medium" colSpan={3}>Total fee stokis</td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold" data-testid="payout-fee-total">{num(fee)} BV</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
