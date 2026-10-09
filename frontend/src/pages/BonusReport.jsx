import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Download, Search } from 'lucide-react';
import AppShell from '../components/AppShell';
import PeriodFilter from '../components/PeriodFilter';
import { MembershipBadge, RankBadge, TupoBadge } from '../components/Badges';
import StatCard from '../components/StatCard';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api, downloadCsv, errMsg } from '../lib/api';
import { BONUS_LIST, num, pct, rp } from '../lib/format';

export default function BonusReport() {
  const [range, setRange] = useState({ mode: 'period', key: '' });
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!range.key) return;
    setLoading(true);
    setSel(null);
    try {
      const { data: d } = await api.get('/payout', { params: { mode: range.mode, key: range.key } });
      setData(d);
    } catch (e) { setData(null); toast.error(errMsg(e)); } finally { setLoading(false); }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const list = (data?.results || []).filter((r) => r.total_bonus_bv > 0 || r.ppv > 0);
    const ql = q.trim().toLowerCase();
    return ql
      ? list.filter((r) => r.member_id.toLowerCase().includes(ql) || (r.name || '').toLowerCase().includes(ql))
      : list;
  }, [data, q]);

  const totals = useMemo(() => {
    const t = { total: data?.bonus?.total_bv || 0 };
    BONUS_LIST.forEach((b) => { t[b.key] = 0; });
    (data?.results || []).forEach((r) => {
      BONUS_LIST.forEach((b) => { t[b.key] += r[b.key] || 0; });
    });
    return t;
  }, [data]);

  const sharingPool = useMemo(() => {
    let sum = 0;
    (data?.periods || []).forEach((p) => {
      const sp = p.sharing_pool || {};
      sum += (sp.Director?.pool_bv || 0) + (sp['Executive Director']?.pool_bv || 0);
    });
    return sum;
  }, [data]);

  const rewardPool = useMemo(
    () => (data?.periods || []).reduce((a, p) => a + (p.reward_pool_bv || 0), 0),
    [data]
  );

  const allClosed = (data?.periods || []).length > 0 && data.periods.every((p) => p.status === 'closed');

  const exportCsv = async () => {
    try {
      await downloadCsv(`/bonus/export?mode=${range.mode}&key=${range.key}`, `bonus-${range.mode}-${range.key}.csv`);
      toast.success('CSV diunduh');
    } catch (e) { toast.error('Gagal mengunduh CSV'); }
  };

  return (
    <AppShell title="Laporan Bonus" subtitle="Rincian perhitungan 7 bonus per member, bisa diaudit baris per baris"
      actions={<Button variant="outline" onClick={exportCsv} data-testid="bonus-report-export-csv-button"><Download className="mr-1 h-4 w-4" /> CSV</Button>}>
      <div className="grid gap-4">
        <div className="grid gap-3 rounded-xl border bg-card p-3">
          <PeriodFilter value={range} onChange={setRange} testid="bonus-filter" />
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input className="h-11 pl-9" placeholder="Cari ID atau nama member" value={q} onChange={(e) => setQ(e.target.value)} data-testid="bonus-search" />
            </div>
            <span className="font-mono text-xs text-muted-foreground" data-testid="bonus-range-label">{data?.label || ''}</span>
            <span className={`rounded-full border px-3 py-1.5 text-xs ${allClosed ? 'bg-muted text-muted-foreground' : 'border-[#C6EAD8] bg-[#E7F6EE] text-[#1F8A5B]'}`} data-testid="bonus-status">
              {allClosed ? 'Sudah tutup buku' : 'Termasuk estimasi periode berjalan'}
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard testid="bonus-total" label="Total Bonus" value={`${num(totals.total)} BV`} sub={rp(data?.bonus?.total_rp || 0)} tone="primary" />
          <StatCard testid="bonus-omset" label="Omset Rentang Ini" value={`${num(data?.omset?.total)} PV`} sub={`Perk ${num(data?.omset?.perkembangan)} · Penj ${num(data?.omset?.penjualan)}`} />
          <StatCard testid="bonus-payout-percent" label="Persentase Payout" value={`${num(data?.payout_percent, 2)}%`} sub={`Sisa perusahaan ${num(data?.company_percent, 2)}%`} tone="soft" />
          <StatCard testid="bonus-reward-pool" label="Pool Sharing & Reward" value={`${num(sharingPool + rewardPool)} BV`} sub={`Sharing ${num(sharingPool)} · Reward ${num(rewardPool)}`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border bg-card lg:col-span-2">
            <div className="border-b px-4 py-3"><h3 className="font-display text-base font-semibold">Bonus per Member</h3></div>
            <div className="table-wrap">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-[11px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Member</th>
                    {BONUS_LIST.map((b) => <th key={b.key} className="px-2 py-2 text-right">{b.label.replace('Bonus ', '')}</th>)}
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="p-8 text-center text-sm text-muted-foreground">Menghitung...</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={9} className="p-8 text-center text-sm text-muted-foreground">Belum ada data pada rentang ini</td></tr>
                  ) : rows.map((r) => (
                    <tr key={r.member_id} onClick={() => setSel(r)}
                      className={`cursor-pointer border-b last:border-0 hover:bg-muted/60 ${sel?.member_id === r.member_id ? 'bg-accent' : ''}`}
                      data-testid={`bonus-row-${r.member_id}`}>
                      <td className="px-3 py-2">
                        <p className="font-mono text-[11px] text-muted-foreground">{r.member_id}</p>
                        <p className="font-medium">{r.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1"><RankBadge rank={r.rank} /><MembershipBadge membership={r.membership} /></div>
                      </td>
                      {BONUS_LIST.map((b) => <td key={b.key} className="px-2 py-2 text-right font-mono text-xs">{num(r[b.key])}</td>)}
                      <td className="px-3 py-2 text-right font-mono font-semibold">{num(r.total_bonus_bv)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/60 text-xs">
                  <tr>
                    <td className="px-3 py-2 font-medium">Total</td>
                    {BONUS_LIST.map((b) => <td key={b.key} className="px-2 py-2 text-right font-mono">{num(totals[b.key])}</td>)}
                    <td className="px-3 py-2 text-right font-mono font-semibold">{num(totals.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 lg:sticky lg:top-16 lg:self-start">
            <h3 className="font-display text-base font-semibold">Rincian Perhitungan</h3>
            {!sel ? <p className="mt-2 text-sm text-muted-foreground">Pilih member pada tabel untuk melihat rincian rumus bonus.</p> : (
              <div className="mt-3 grid gap-3" data-testid="bonus-detail-panel">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{sel.member_id}</p>
                  <p className="font-display text-lg font-semibold">{sel.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <RankBadge rank={sel.rank} /><MembershipBadge membership={sel.membership} />
                    <TupoBadge ok={sel.tupo_ok} required={sel.tupo_required} manual={sel.tupo_manual} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[['PPV', sel.ppv], ['Perkembangan', sel.ppv_perkembangan], ['Penjualan', sel.ppv_penjualan],
                    ['TNPV', sel.tnpv], ['APPV', sel.appv], ['ATNPV', sel.atnpv], ['KG', sel.kg], ['AKG', sel.akg]].map(([k, v]) => (
                    <div key={k} className="rounded-lg border bg-background px-2 py-1.5">
                      <p className="text-[10px] uppercase text-muted-foreground">{k}</p>
                      <p className="font-mono">{num(v)} PV</p>
                    </div>
                  ))}
                </div>
                {(sel.lines || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada bonus pada rentang ini.</p>
                ) : (
                  <div className="grid gap-2">
                    {BONUS_LIST.filter((b) => (sel.lines || []).some((l) => l.bonus === b.label)).map((b) => (
                      <div key={b.key} className="rounded-lg border bg-background p-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{b.label}</p>
                          <p className="font-mono text-sm">{num(sel[b.key])} BV</p>
                        </div>
                        <div className="mt-1.5 grid gap-1">
                          {sel.lines.filter((l) => l.bonus === b.label).map((l, i) => (
                            <div key={i} className="formula">
                              {l.period ? <span className="text-muted-foreground">[{l.period}] </span> : null}
                              {l.description}<br />
                              {num(l.base_pv)} PV × {pct(l.rate)} = {num(l.amount_bv)} BV
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {sel.pairing_detail?.legs?.length ? (
                  <div className="rounded-lg border bg-background p-2">
                    <p className="text-sm font-medium">Jalur Bonus Pasangan</p>
                    <div className="mt-1 grid gap-1 text-xs">
                      {sel.pairing_detail.legs.map((l, i) => (
                        <div key={l.leg} className="flex justify-between font-mono">
                          <span>Jalur {i + 1} · {l.leg}</span><span>{num(l.pv)} PV</span>
                        </div>
                      ))}
                      <div className="mt-1 flex justify-between font-mono text-muted-foreground">
                        <span>Dipasangkan</span><span>{num(sel.pairing_detail.paired_pv)} PV</span>
                      </div>
                      <div className="flex justify-between font-mono text-muted-foreground">
                        <span>Batas maksimal</span><span>{num(sel.pairing_detail.cap_bv)} BV{sel.pairing_detail.capped ? ' (tercapai)' : ''}</span>
                      </div>
                      {Object.entries(sel.pairing_detail.carry || {}).map(([k, v]) => (
                        <div key={k} className="flex justify-between font-mono text-muted-foreground"><span>Sisa jalur {k}</span><span>{num(v)} PV</span></div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="rounded-lg bg-primary px-3 py-2 text-primary-foreground">
                  <p className="text-xs uppercase opacity-80">Total bonus</p>
                  <p className="font-mono text-lg">{num(sel.total_bonus_bv)} BV · {rp(sel.total_bonus_rp)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {(data?.stokis_fee?.rows || []).length ? (
          <div className="rounded-xl border bg-card">
            <div className="border-b px-4 py-3"><h3 className="font-display text-base font-semibold">Fee Perantara Stokis</h3></div>
            <div className="table-wrap">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr><th className="px-4 py-2 text-left">Stokis</th><th className="px-4 py-2 text-right">Omset Member</th><th className="px-4 py-2 text-right">Fee</th></tr>
                </thead>
                <tbody>
                  {data.stokis_fee.rows.map((f) => (
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
    </AppShell>
  );
}
