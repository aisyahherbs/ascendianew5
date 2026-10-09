import React, { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Play, Plus, RotateCcw, Trash2 } from 'lucide-react';
import AppShell from '../components/AppShell';
import { MembershipBadge, RankBadge, TupoBadge } from '../components/Badges';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BONUS_LIST, num, pct, rp } from '../lib/format';
import SimAddMembers from './SimAddMembers';

const RANKS = ['Member', 'VIP', 'Royal Star', 'Crown Star', 'Leader Ambassador', 'Leader Majestic', 'Director', 'Executive Director'];
const MEMBERSHIPS = ['None', 'Bronze', 'Silver', 'Gold', 'Platinum'];

const CONTOH = [
  { id: 'A', name: 'Anda (Platinum)', sponsor_id: '', placement_id: '', membership: 'Platinum', rank: 'Leader Majestic', appv_perkembangan: 19000, appv: 19000, atnpv: 7000000, perkembangan_pv: 0, penjualan_pv: 3000 },
  { id: 'B', name: 'Jalur 1', sponsor_id: 'A', placement_id: 'A', membership: 'None', rank: 'Member', appv_perkembangan: 0, appv: 0, atnpv: 0, perkembangan_pv: 500000, penjualan_pv: 0 },
  { id: 'C', name: 'Jalur 2', sponsor_id: 'A', placement_id: 'A', membership: 'None', rank: 'Member', appv_perkembangan: 0, appv: 0, atnpv: 0, perkembangan_pv: 300000, penjualan_pv: 0 },
];

const blank = (i) => ({
  id: `M${i}`, name: `Member ${i}`, sponsor_id: 'A', placement_id: '', membership: 'None', rank: 'Member',
  appv_perkembangan: 0, appv: 0, atnpv: 0, perkembangan_pv: 0, penjualan_pv: 0,
});

export default function Simulator() {
  const { user } = useAuth();
  const isPusat = user?.role === 'admin_pusat';
  const [tab, setTab] = useState(isPusat ? 'add' : 'manual');
  const [rows, setRows] = useState(CONTOH);
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(null);

  const setCell = (i, k, v) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const addRow = () => setRows((p) => [...p, blank(p.length + 1)]);
  const delRow = (i) => setRows((p) => p.filter((_, idx) => idx !== i));

  const run = async () => {
    setLoading(true);
    try {
      const payload = {
        period_label: 'Simulasi',
        members: rows.map((r) => ({
          ...r,
          id: String(r.id || '').trim().toUpperCase(),
          sponsor_id: String(r.sponsor_id || '').trim().toUpperCase(),
          placement_id: String(r.placement_id || '').trim().toUpperCase(),
          appv_perkembangan: Number(r.appv_perkembangan || 0),
          appv: Number(r.appv || 0),
          atnpv: Number(r.atnpv || 0),
          perkembangan_pv: Number(r.perkembangan_pv || 0),
          penjualan_pv: Number(r.penjualan_pv || 0),
        })),
      };
      const { data } = await api.post('/simulator', payload);
      setRes(data);
      setSel(data.results[0]);
      toast.success('Simulasi selesai');
    } catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
  };

  const TabBtn = ({ id, label }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      data-testid={`sim-tab-${id}`}
      className={`rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
        tab === id ? 'bg-[hsl(var(--primary))] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'
      }`}
    >
      {label}
    </button>
  );

  return (
    <AppShell title="Simulator Bonus" subtitle="Uji skenario jaringan & omset tanpa menyimpan data apa pun"
      actions={tab === 'manual' ? (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setRows(CONTOH); setRes(null); setSel(null); }} data-testid="sim-reset"><RotateCcw className="mr-1 h-3.5 w-3.5" /> Contoh</Button>
          <Button size="sm" onClick={run} disabled={loading} data-testid="sim-run">{loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />} Hitung</Button>
        </div>
      ) : null}>
      {isPusat ? (
        <div className="mb-3 flex flex-wrap gap-2" data-testid="sim-tabs">
          <TabBtn id="add" label="Simulasi Tambah Member" />
          <TabBtn id="manual" label="Skenario Manual" />
        </div>
      ) : null}

      {tab === 'add' && isPusat ? <SimAddMembers /> : (
      <div className="grid gap-4">
        <div className="rounded-xl border bg-accent p-3 text-sm">
          Isi struktur jaringan (Sponsor & Placement memakai kolom terpisah), akumulasi awal, dan omset periode ini.
          Simulator memakai mesin perhitungan yang sama dengan tutup buku sebenarnya.
        </div>

        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="font-display text-base font-semibold">Skenario</h3>
            <Button size="sm" variant="outline" onClick={addRow} data-testid="sim-add-row"><Plus className="mr-1 h-3.5 w-3.5" /> Tambah Baris</Button>
          </div>
          <div className="table-wrap">
            <table className="w-full text-xs">
              <thead className="bg-muted/60 uppercase text-muted-foreground">
                <tr>
                  {['ID', 'Nama', 'Sponsor', 'Placement', 'Membership', 'Peringkat', 'APPV Perk.', 'APPV', 'ATNPV', 'Omset Perk.', 'Omset Penj.', ''].map((h) => (
                    <th key={h} className="px-2 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-1 py-1"><Input className="h-9 w-16 font-mono" value={r.id} onChange={(e) => setCell(i, 'id', e.target.value)} data-testid={`sim-id-${i}`} /></td>
                    <td className="px-1 py-1"><Input className="h-9 w-32" value={r.name} onChange={(e) => setCell(i, 'name', e.target.value)} /></td>
                    <td className="px-1 py-1"><Input className="h-9 w-16 font-mono" value={r.sponsor_id} onChange={(e) => setCell(i, 'sponsor_id', e.target.value)} data-testid={`sim-sponsor-${i}`} /></td>
                    <td className="px-1 py-1"><Input className="h-9 w-16 font-mono" value={r.placement_id} onChange={(e) => setCell(i, 'placement_id', e.target.value)} data-testid={`sim-placement-${i}`} /></td>
                    <td className="px-1 py-1">
                      <select className="h-9 rounded border bg-background px-1" value={r.membership} onChange={(e) => setCell(i, 'membership', e.target.value)} data-testid={`sim-membership-${i}`}>
                        {MEMBERSHIPS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <select className="h-9 rounded border bg-background px-1" value={r.rank} onChange={(e) => setCell(i, 'rank', e.target.value)} data-testid={`sim-rank-${i}`}>
                        {RANKS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                    {['appv_perkembangan', 'appv', 'atnpv', 'perkembangan_pv', 'penjualan_pv'].map((k) => (
                      <td key={k} className="px-1 py-1">
                        <Input className="h-9 w-24 font-mono" type="number" value={r[k]} onChange={(e) => setCell(i, k, e.target.value)} data-testid={`sim-${k}-${i}`} />
                      </td>
                    ))}
                    <td className="px-1 py-1">
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => delRow(i)} data-testid={`sim-del-${i}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {res ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border bg-card lg:col-span-2">
              <div className="border-b px-4 py-3">
                <h3 className="font-display text-base font-semibold">Hasil Simulasi</h3>
                <p className="text-xs text-muted-foreground">Omset nasional {num(res.summary?.total_omset_pv)} PV · total bonus {num(res.summary?.total_bonus_bv)} BV</p>
              </div>
              <div className="table-wrap">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Member</th>
                      {BONUS_LIST.map((b) => <th key={b.key} className="px-2 py-2 text-right">{b.label.replace('Bonus ', '')}</th>)}
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.results.map((r) => (
                      <tr key={r.member_id} onClick={() => setSel(r)} className={`cursor-pointer border-b last:border-0 hover:bg-muted/60 ${sel?.member_id === r.member_id ? 'bg-accent' : ''}`} data-testid={`sim-result-${r.member_id}`}>
                        <td className="px-3 py-2">
                          <p className="font-mono">{r.member_id}</p>
                          <div className="mt-1 flex flex-wrap gap-1"><RankBadge rank={r.rank} /><MembershipBadge membership={r.membership} /></div>
                        </td>
                        {BONUS_LIST.map((b) => <td key={b.key} className="px-2 py-2 text-right font-mono">{num(r[b.key])}</td>)}
                        <td className="px-3 py-2 text-right font-mono font-semibold">{num(r.total_bonus_bv)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h3 className="font-display text-base font-semibold">Rincian Rumus</h3>
              {!sel ? <p className="mt-2 text-sm text-muted-foreground">Pilih baris hasil.</p> : (
                <div className="mt-3 grid gap-3" data-testid="sim-detail">
                  <div className="flex flex-wrap gap-2">
                    <RankBadge rank={sel.rank} /><MembershipBadge membership={sel.membership} /><TupoBadge ok={sel.tupo_ok} required={sel.tupo_required} />
                  </div>
                  {(sel.lines || []).length === 0 ? <p className="text-sm text-muted-foreground">Tidak ada bonus.</p> : (sel.lines || []).map((l, i) => (
                    <div key={i} className="formula">
                      <b>{l.bonus}</b><br />{l.description}<br />{num(l.base_pv)} PV × {pct(l.rate)} = {num(l.amount_bv)} BV
                    </div>
                  ))}
                  <div className="rounded-lg bg-primary px-3 py-2 text-primary-foreground">
                    <p className="text-xs uppercase opacity-80">Total</p>
                    <p className="font-mono text-lg">{num(sel.total_bonus_bv)} BV · {rp(sel.total_bonus_rp)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
      )}
    </AppShell>
  );
}
