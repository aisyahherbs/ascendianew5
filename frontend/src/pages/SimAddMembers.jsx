import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowUpRight, Coins, GitBranch, Info, Layers, Loader2, Network, Play, RefreshCw,
  RotateCcw, Trash2, TrendingUp, Users,
} from 'lucide-react';
import MemberPicker from '../components/MemberPicker';
import SimTree from '../components/SimTree';
import { BonusDot, MembershipBadge, RankBadge, TupoBadge } from '../components/Badges';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { api, errMsg } from '../lib/api';
import { BONUS_LIST, num, pct, rp } from '../lib/format';

const RANKS = ['Member', 'VIP', 'Royal Star', 'Crown Star', 'Leader Ambassador',
  'Leader Majestic', 'Director', 'Executive Director'];
const MEMBERSHIPS = ['None', 'Bronze', 'Silver', 'Gold', 'Platinum'];
const LBL = 'text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground';

const BLANK = {
  mode: 'single',
  sponsor_id: '', placement_id: '', count: 4, levels: 1,
  pv_perkembangan: 5000, pv_penjualan: 1000,
  membership: 'Bronze', rank: 'Member',
  tupo_ok: true, include_current_omset: true, spread_sponsor: false,
};

function Kpi({ label, value, sub, icon: Icon, tone = 'teal', testid }) {
  const tones = {
    teal: 'border-l-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.07)]',
    blue: 'border-l-[hsl(var(--info))] bg-[hsl(var(--info)/0.07)]',
    green: 'border-l-[hsl(var(--success))] bg-[hsl(var(--success)/0.08)]',
    amber: 'border-l-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.1)]',
    violet: 'border-l-[hsl(var(--info))] bg-[hsl(var(--info)/0.12)]',
  };
  return (
    <div className={`rounded-xl border border-l-4 bg-card p-3 ${tones[tone]}`} data-testid={testid}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
      </div>
      <p className="mt-1 font-mono text-xl font-semibold leading-tight">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export default function SimAddMembers() {
  const [f, setF] = useState(BLANK);
  const [res, setRes] = useState(null);
  const [sim, setSim] = useState([]);          // akumulasi member simulasi semua batch
  const [history, setHistory] = useState([]);  // ringkasan tiap batch
  const [sel, setSel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tree, setTree] = useState('placement');
  const [showAll, setShowAll] = useState(false);
  const [targetMode, setTargetMode] = useState('last');
  const [targetSel, setTargetSel] = useState([]);
  const [extraTarget, setExtraTarget] = useState('');

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const lastBatch = history.length ? history[history.length - 1].batch : 0;
  const lastBatchIds = useMemo(
    () => sim.filter((m) => (m.batch || 1) === lastBatch).map((m) => m.member_id), [sim, lastBatch],
  );
  const allSimIds = useMemo(() => sim.map((m) => m.member_id), [sim]);

  const targets = useMemo(() => {
    if (targetMode === 'last') return lastBatchIds;
    if (targetMode === 'all') return allSimIds;
    return targetSel;
  }, [targetMode, lastBatchIds, allSimIds, targetSel]);

  const perInduk = Number(f.count || 0);
  const levels = Math.max(1, Math.min(Number(f.levels || 1), 12));
  const perLevel = useMemo(() => {
    const base = f.mode === 'per_member' ? perInduk * targets.length : perInduk;
    const out = [base];
    for (let i = 1; i < levels; i += 1) out.push(out[out.length - 1] * perInduk);
    return out;
  }, [f.mode, perInduk, targets.length, levels]);
  const projected = perLevel.reduce((a, b) => a + b, 0);

  const call = async (payload, okMsg) => {
    setLoading(true);
    try {
      const { data } = await api.post('/simulator/add-members', payload);
      setRes(data);
      setSim(data.sim_members || []);
      setSel(data.results?.[0] || null);
      toast.success(okMsg(data));
      return data;
    } catch (e) {
      toast.error(errMsg(e));
      return null;
    } finally { setLoading(false); }
  };

  const run = async () => {
    if (perInduk < 1) { toast.error('Jumlah member minimal 1'); return; }
    if (f.mode === 'per_member' && targets.length === 0) {
      toast.error('Pilih dulu member yang akan diberi downline baru');
      return;
    }
    if (projected > 500) {
      toast.error(`Total member baru ${projected} melebihi batas 500 (${perLevel.join(' + ')})`);
      return;
    }
    const batch = lastBatch + 1;
    const data = await call({
      mode: f.mode,
      sponsor_id: f.mode === 'single' ? (f.sponsor_id || null) : null,
      placement_id: f.mode === 'single' ? (f.placement_id || null) : null,
      targets: f.mode === 'per_member' ? targets : [],
      count: perInduk,
      levels,
      pv_perkembangan: Number(f.pv_perkembangan || 0),
      pv_penjualan: Number(f.pv_penjualan || 0),
      membership: f.membership || null,
      rank: f.rank || null,
      tupo_ok: !!f.tupo_ok,
      include_current_omset: !!f.include_current_omset,
      spread_sponsor: !!f.spread_sponsor,
      existing_sim: sim,
      batch,
      include_unchanged: showAll,
    }, (d) => `Batch ${batch}: ${d.count} member ditambahkan — total ${d.total_sim_count} member simulasi, tidak ada data yang disimpan`);
    if (data) {
      setHistory((h) => [...h, {
        batch,
        mode: f.mode,
        count: data.count,
        per_induk: data.per_induk,
        levels: data.levels || 1,
        per_level: data.per_level || [],
        induk: data.mode === 'per_member' ? data.targets.length : 1,
        delta_bv: data.bonus?.delta_bv || 0,
        omset_pv: data.omset?.tambahan_pv || 0,
        total_sim: data.total_sim_count,
      }]);
      setTargetMode('last');
      setTargetSel([]);
    }
  };

  const recalc = async (simList, opts = {}) => {
    if (!simList.length) { setRes(null); setSel(null); return; }
    await call({
      mode: 'single', count: 0, existing_sim: simList,
      include_current_omset: !!f.include_current_omset,
      include_unchanged: opts.showAll ?? showAll,
      batch: simList.reduce((a, m) => Math.max(a, m.batch || 1), 1),
    }, () => 'Perhitungan diperbarui');
  };

  const dropLastBatch = async () => {
    if (!history.length) return;
    const keep = sim.filter((m) => (m.batch || 1) !== lastBatch);
    const newHist = history.slice(0, -1);
    setHistory(newHist);
    setSim(keep);
    if (!keep.length) { setRes(null); setSel(null); toast.success('Semua batch dihapus'); return; }
    await recalc(keep);
    toast.success(`Batch ${lastBatch} dihapus`);
  };

  const resetAll = () => {
    setF(BLANK); setRes(null); setSel(null); setSim([]); setHistory([]);
    setTargetSel([]); setTargetMode('last'); setShowAll(false);
  };

  const toggleShowAll = async (v) => {
    setShowAll(v);
    if (sim.length) await recalc(sim, { showAll: v });
  };

  const toggleTarget = (id) => setTargetSel((p) => (
    p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const delta = res?.bonus?.delta_bv || 0;
  const simMode = f.mode === 'single';
  const isSim = (v) => String(v || '').toUpperCase().startsWith('SIM');

  return (
    <div className="grid gap-3">
      <p className="flex items-start gap-1.5 rounded-lg border border-[hsl(var(--info)/0.3)] bg-[hsl(var(--info)/0.08)] px-2.5 py-2 text-[11.5px] leading-snug text-[hsl(var(--info-soft-foreground))]">
        <Info className="mt-[1px] h-3.5 w-3.5 shrink-0" />
        <span>
          Simulasi murni &amp; bertingkat: <b>tidak ada member, omset, atau pengaturan yang disimpan.</b>{' '}
          Isi <b>kedalaman berantai</b> untuk langsung membuat 4 member, lalu 4 member lagi untuk
          masing-masing member tadi, dan seterusnya dalam sekali klik — atau tambah batch satu per satu.
          Penempatan mengikuti aturan asli: <b>placement maksimal 2 kaki</b> — kalau sudah 2, member
          baru otomatis turun ke binary di bawahnya secara seimbang. Jumlah sponsor tidak dibatasi.
        </span>
      </p>

      {/* -------------------------------------------------------- RIWAYAT BATCH */}
      {history.length ? (
        <div className="card-c flex flex-wrap items-center gap-2 p-2.5" data-testid="simadd-batches">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Layers className="h-3.5 w-3.5" /> Riwayat batch
          </span>
          {history.map((h) => (
            <span key={h.batch}
              className="rounded-lg border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.08)] px-2 py-1 text-[11px]"
              data-testid={`simadd-batch-${h.batch}`}>
              <b>Batch {h.batch}</b> · {num(h.count)} member
              {h.mode === 'per_member' ? ` (${num(h.induk)} induk × ${num(h.per_induk)})` : ''}
              {(h.levels || 1) > 1 ? ` · ${h.levels} level (${(h.per_level || []).join('+')})` : ''}
              {' · '}
              <span className="font-mono text-[hsl(var(--success))]">+{num(h.delta_bv)} BV</span>
            </span>
          ))}
          <span className="rounded-lg bg-muted px-2 py-1 font-mono text-[11px]">
            Total {num(sim.length)} member simulasi
          </span>
          <div className="ml-auto flex gap-1.5">
            <Button size="sm" variant="outline" onClick={dropLastBatch} disabled={loading}
              data-testid="simadd-drop-batch">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hapus batch terakhir
            </Button>
            <Button size="sm" variant="outline" onClick={() => recalc(sim)} disabled={loading}
              data-testid="simadd-recalc">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Hitung ulang
            </Button>
          </div>
        </div>
      ) : null}

      {/* --------------------------------------------------------------- FORM */}
      <div className="card-c p-3" data-testid="simadd-form">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={LBL}>Cara menambah</span>
          <div className="flex overflow-hidden rounded-lg border">
            <button type="button" onClick={() => set('mode', 'single')}
              className={`px-3 py-1.5 text-[12px] font-medium ${simMode ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
              data-testid="simadd-mode-single">
              Satu induk
            </button>
            <button type="button" onClick={() => set('mode', 'per_member')}
              className={`px-3 py-1.5 text-[12px] font-medium ${!simMode ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
              data-testid="simadd-mode-per-member">
              Untuk masing-masing member
            </button>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {simMode
              ? 'Semua member baru masuk di bawah satu sponsor/placement.'
              : 'Setiap member yang dipilih mendapat sejumlah downline baru — pakai ini untuk melanjutkan simulasi bertingkat.'}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          {simMode ? (
            <>
              <div className="grid gap-1">
                <Label className={LBL}>Sponsor (opsional)</Label>
                <MemberPicker role="member" value={isSim(f.sponsor_id) ? '' : f.sponsor_id}
                  onChange={(v) => set('sponsor_id', v)}
                  testid="simadd-sponsor" placeholder="Kosongkan = akar baru" />
                {sim.length ? (
                  <select className="h-8 rounded-md border bg-background px-2 text-[12px]"
                    value={isSim(f.sponsor_id) ? f.sponsor_id : ''}
                    onChange={(e) => set('sponsor_id', e.target.value)}
                    data-testid="simadd-sponsor-sim">
                    <option value="">— atau pilih member simulasi —</option>
                    {sim.map((m) => (
                      <option key={m.member_id} value={m.member_id}>
                        {m.member_id} (batch {m.batch || 1})
                      </option>
                    ))}
                  </select>
                ) : null}
                <p className="text-[10.5px] text-muted-foreground">
                  Kosong = member simulasi pertama jadi akar, sisanya menyebar di bawahnya.
                </p>
              </div>
              <div className="grid gap-1">
                <Label className={LBL}>Placement (opsional)</Label>
                <MemberPicker role="member" value={isSim(f.placement_id) ? '' : f.placement_id}
                  onChange={(v) => set('placement_id', v)}
                  testid="simadd-placement" placeholder="Kosongkan = seimbang otomatis" />
                {sim.length ? (
                  <select className="h-8 rounded-md border bg-background px-2 text-[12px]"
                    value={isSim(f.placement_id) ? f.placement_id : ''}
                    onChange={(e) => set('placement_id', e.target.value)}
                    data-testid="simadd-placement-sim">
                    <option value="">— atau pilih member simulasi —</option>
                    {sim.map((m) => (
                      <option key={m.member_id} value={m.member_id}>
                        {m.member_id} (batch {m.batch || 1})
                      </option>
                    ))}
                  </select>
                ) : null}
                <p className="text-[10.5px] text-muted-foreground">
                  Kosong = penempatan biner seimbang (maks. 2 kaki, diisi rata dari atas).
                </p>
              </div>
            </>
          ) : (
            <div className="grid gap-1.5 md:col-span-2">
              <Label className={LBL}>Induk yang diberi downline baru</Label>
              <div className="flex flex-wrap gap-1.5">
                {[['last', `Member batch terakhir (${lastBatchIds.length})`],
                  ['all', `Semua member simulasi (${allSimIds.length})`],
                  ['manual', 'Pilih sendiri']].map(([k, lb]) => (
                    <button key={k} type="button" onClick={() => setTargetMode(k)}
                      className={`rounded-lg border px-2.5 py-1 text-[11.5px] ${
                        targetMode === k ? 'border-primary bg-[hsl(var(--primary)/0.1)] font-semibold' : 'bg-background hover:bg-muted'
                      }`}
                      data-testid={`simadd-targetmode-${k}`}>
                      {lb}
                    </button>
                ))}
              </div>
              {targetMode === 'manual' ? (
                <div className="grid gap-1.5">
                  <div className="max-h-28 overflow-y-auto rounded-lg border p-1.5" data-testid="simadd-target-list">
                    {sim.length === 0 ? (
                      <p className="p-1 text-[11.5px] text-muted-foreground">
                        Belum ada member simulasi. Tambahkan member nyata di bawah, atau buat batch pertama dengan mode &quot;Satu induk&quot;.
                      </p>
                    ) : (
                      <div className="grid gap-0.5 sm:grid-cols-2 lg:grid-cols-3">
                        {sim.map((m) => (
                          <label key={m.member_id}
                            className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[11.5px] hover:bg-muted">
                            <input type="checkbox" className="h-3.5 w-3.5 accent-[#0F766E]"
                              checked={targetSel.includes(m.member_id)}
                              onChange={() => toggleTarget(m.member_id)}
                              data-testid={`simadd-target-${m.member_id}`} />
                            <span className="font-mono">{m.member_id}</span>
                            <span className="text-muted-foreground">b{m.batch || 1}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-end gap-1.5">
                    <div className="grid flex-1 gap-1">
                      <Label className={LBL}>Tambah induk dari member nyata</Label>
                      <MemberPicker role="member" value={extraTarget} onChange={setExtraTarget}
                        testid="simadd-extra-target" placeholder="Cari ID atau nama..." />
                    </div>
                    <Button size="sm" variant="outline" disabled={!extraTarget}
                      onClick={() => {
                        const id = String(extraTarget).toUpperCase();
                        if (!targetSel.includes(id)) setTargetSel([...targetSel, id]);
                        setExtraTarget('');
                      }}
                      data-testid="simadd-add-target">
                      Tambahkan
                    </Button>
                  </div>
                  {targetSel.length ? (
                    <div className="flex flex-wrap gap-1">
                      {targetSel.map((id) => (
                        <span key={id} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                          {id}
                          <button type="button" className="ml-1 text-muted-foreground"
                            onClick={() => toggleTarget(id)}>×</button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-[10.5px] text-muted-foreground">
                  {targets.length
                    ? `${targets.length} induk terpilih: ${targets.slice(0, 12).join(', ')}${targets.length > 12 ? ', …' : ''}`
                    : 'Belum ada induk. Buat batch pertama dulu dengan mode "Satu induk".'}
                </p>
              )}
            </div>
          )}

          <div className="grid gap-1">
            <Label className={LBL}>
              {simMode ? 'Jumlah member ditambah' : 'Jumlah member baru PER induk'}
            </Label>
            <Input className="h-9 font-mono text-[13px]" type="number" min="1" max="500"
              value={f.count} onChange={(e) => set('count', e.target.value)} data-testid="simadd-count" />
            {!simMode ? (
              <p className="text-[10.5px] text-muted-foreground">
                Level 1: <b className="text-foreground">{num(perLevel[0])}</b>
                {' '}({num(targets.length)} induk × {num(perInduk)})
              </p>
            ) : null}
          </div>
          <div className="grid gap-1">
            <Label className={LBL}>Kedalaman berantai (level)</Label>
            <Input className="h-9 font-mono text-[13px]" type="number" min="1" max="12"
              value={f.levels} onChange={(e) => set('levels', e.target.value)}
              data-testid="simadd-levels" />
            <p className="text-[10.5px] text-muted-foreground">
              1 = hanya satu lapis. Lebih dari 1 = tiap member baru ikut mendapat{' '}
              <b className="text-foreground">{num(perInduk)}</b> member lagi, dan seterusnya.
            </p>
            <p className={`rounded-md border px-2 py-1 text-[10.5px] leading-snug ${
              projected > 500
                ? 'border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.1)]'
                : 'border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.07)]'
            }`} data-testid="simadd-projection">
              Total member baru: <b>{num(projected)}</b>
              {levels > 1 ? <> — {perLevel.map((x, i) => (
                <span key={i}>{i ? ' + ' : ''}L{i + 1}:{num(x)}</span>
              ))}</> : null}
              {projected > 500 ? ' · melebihi batas 500, kurangi jumlah atau level' : ''}
              {' · '}Placement tetap maksimal 2 kaki (otomatis turun bila penuh)
            </p>
          </div>
          <div className="grid gap-1">
            <Label className={LBL}>Membership (ditetapkan manual)</Label>
            <select className="h-9 rounded-md border bg-background px-2.5 text-[13px]"
              value={f.membership} onChange={(e) => set('membership', e.target.value)} data-testid="simadd-membership">
              {MEMBERSHIPS.map((m) => <option key={m} value={m}>{m === 'None' ? 'Belum Membership' : m}</option>)}
            </select>
          </div>
          <div className="grid gap-1">
            <Label className={LBL}>Peringkat (ditetapkan manual)</Label>
            <select className="h-9 rounded-md border bg-background px-2.5 text-[13px]"
              value={f.rank} onChange={(e) => set('rank', e.target.value)} data-testid="simadd-rank">
              {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="grid gap-1">
            <Label className={LBL}>Omset perkembangan / member (PV)</Label>
            <Input className="h-9 font-mono text-[13px]" type="number" value={f.pv_perkembangan}
              onChange={(e) => set('pv_perkembangan', e.target.value)} data-testid="simadd-pv-perkembangan" />
          </div>
          <div className="grid gap-1">
            <Label className={LBL}>Omset penjualan / member (PV)</Label>
            <Input className="h-9 font-mono text-[13px]" type="number" value={f.pv_penjualan}
              onChange={(e) => set('pv_penjualan', e.target.value)} data-testid="simadd-pv-penjualan" />
          </div>
          <div className="grid content-end gap-1.5">
            <label className="flex items-center gap-2 text-[12px]">
              <input type="checkbox" className="h-4 w-4 accent-[#0F766E]" checked={f.tupo_ok}
                onChange={(e) => set('tupo_ok', e.target.checked)} data-testid="simadd-tupo" />
              Anggap Tupo terpenuhi
            </label>
            <label className="flex items-center gap-2 text-[12px]">
              <input type="checkbox" className="h-4 w-4 accent-[#0F766E]" checked={f.include_current_omset}
                onChange={(e) => set('include_current_omset', e.target.checked)} data-testid="simadd-include-omset" />
              Sertakan omset periode berjalan
            </label>
            <label className="flex items-center gap-2 text-[12px]">
              <input type="checkbox" className="h-4 w-4 accent-[#0F766E]" checked={f.spread_sponsor}
                onChange={(e) => set('spread_sponsor', e.target.checked)} data-testid="simadd-spread-sponsor" />
              Sebar sponsor biner juga
            </label>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={run} disabled={loading} data-testid="simadd-run">
            {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
            {history.length ? `Tambah Batch ${lastBatch + 1}` : 'Hitung Simulasi'}
          </Button>
          <Button size="sm" variant="outline" onClick={resetAll} data-testid="simadd-reset">
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset semua
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------ HASIL */}
      {res ? (
        <div className="grid gap-3" data-testid="simadd-result">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi label={res.count ? 'Member batch ini' : 'Perhitungan ulang'}
              value={res.count ? num(res.count) : num(res.total_sim_count)} icon={Users} tone="green"
              sub={!res.count ? 'tanpa penambahan member baru'
                : ((res.levels || 1) > 1
                  ? `${res.levels} level berantai: ${(res.per_level || []).join(' + ')}`
                  : (res.mode === 'per_member'
                    ? `${num(res.targets?.length)} induk × ${num(res.per_induk)}`
                    : 'satu induk'))}
              testid="simadd-kpi-count" />
            <Kpi label="Total member simulasi" value={num(res.total_sim_count)} icon={Layers} tone="violet"
              sub={`${num(res.prior_sim_count)} dari batch sebelumnya · ${num(res.existing_member_count)} member nyata`}
              testid="simadd-kpi-total" />
            <Kpi label="Omset tambahan" value={`${num(res.omset?.tambahan_pv)} PV`} icon={Coins} tone="blue"
              sub={`Perk. ${num(res.omset?.tambahan_perkembangan_pv)} · Penj. ${num(res.omset?.tambahan_penjualan_pv)}`}
              testid="simadd-kpi-omset" />
            <Kpi label="Kenaikan bonus batch ini" value={`${num(delta)} BV`} icon={TrendingUp} tone="teal"
              sub={`${num(res.bonus?.sebelum_bv)} → ${num(res.bonus?.sesudah_bv)} BV · ${rp(res.bonus?.delta_rp)}`}
              testid="simadd-kpi-bonus" />
            <Kpi label="Payout sesudah" value={`${num(res.payout?.persen_sesudah, 2)}%`} icon={ArrowUpRight} tone="amber"
              sub={`sebelum ${num(res.payout?.persen_sebelum, 2)}% · sisa perusahaan ${num(res.payout?.perusahaan_bv)} BV`}
              testid="simadd-kpi-payout" />
          </div>

          <div className="card-c p-3 text-[11.5px] text-muted-foreground" data-testid="simadd-mode-info">
            Periode <b className="text-foreground">{res.label}</b> ·
            {res.count ? (
              <>
                {' '}Batch <b className="text-foreground">{res.batch}</b> ·
                Mode <b className="text-foreground">{res.mode === 'per_member' ? 'per member terpilih' : 'satu induk'}</b> ·
                Sponsor: <b className="text-foreground">{res.sponsor ? `${res.sponsor.member_id} (${res.sponsor.name})` : (res.mode === 'per_member' ? 'induk terpilih' : 'akar baru')}</b> — {res.sponsor_mode} ·
                Placement: <b className="text-foreground">{res.placement ? `${res.placement.member_id} (${res.placement.name})` : 'otomatis'}</b> — {res.placement_mode} ·
                {(res.levels || 1) > 1 ? (
                  <> Berantai <b className="text-foreground">{res.levels} level</b>{' '}
                    ({(res.per_level || []).join(' + ')} = {num(res.count)} member) · </>
                ) : null}
                <span className={res.binary_ok === false ? 'font-semibold text-[hsl(var(--danger))]' : 'font-semibold text-[hsl(var(--success))]'}>
                  {res.binary_ok === false
                    ? `Ada ${Object.keys(res.binary_violations || {}).length} node melebihi 2 kaki`
                    : 'Aturan biner terpenuhi: semua placement maksimal 2 kaki'}
                </span> ·
                Membership <b className="text-foreground">{res.membership || 'otomatis'}</b> ·
                Peringkat <b className="text-foreground">{res.rank || 'otomatis'}</b> ·
                Tupo {res.tupo_ok ? 'dianggap terpenuhi' : 'dihitung dari omset'}
              </>
            ) : (
              <>
                {' '}Perhitungan ulang atas <b className="text-foreground">{num(res.total_sim_count)} member simulasi</b> yang
                sudah ada (tanpa penambahan). Membership, peringkat, dan omset masing-masing member
                mengikuti batch saat member itu dibuat.
              </>
            )}
          </div>

          {/* ------------------------------------------------- STRUKTUR POHON */}
          <div className="card-c overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
              <GitBranch className="h-3.5 w-3.5 text-primary" />
              <h3 className="font-display text-[14px] font-semibold">Struktur Jaringan &amp; Bonus per Member</h3>
              <div className="ml-auto flex overflow-hidden rounded-lg border">
                <button type="button" onClick={() => setTree('placement')}
                  className={`px-2.5 py-1 text-[11.5px] font-medium ${tree === 'placement' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                  data-testid="simadd-tree-placement">
                  Pohon Placement
                </button>
                <button type="button" onClick={() => setTree('sponsor')}
                  className={`px-2.5 py-1 text-[11.5px] font-medium ${tree === 'sponsor' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                  data-testid="simadd-tree-sponsor">
                  Pohon Sponsor
                </button>
              </div>
            </div>
            <div className="max-h-[55vh] overflow-auto">
              <SimTree nodes={res.nodes || []}
                parentKey={tree === 'sponsor' ? 'sponsor_id' : 'placement_id'}
                selected={sel?.member_id}
                onSelect={(id) => {
                  const row = (res.results || []).find((r) => r.member_id === id)
                    || (res.nodes || []).find((n) => n.member_id === id);
                  if (row) setSel(row);
                }}
                testid={`simadd-tree-${tree}`} />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="card-c overflow-hidden lg:col-span-2">
              <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
                <div className="flex-1">
                  <h3 className="font-display text-[14px] font-semibold">Bonus per Member</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {num(res.total_sim_count)} member simulasi + {num(res.affected_existing)} member nyata.
                    Klik baris untuk melihat rumusnya.
                  </p>
                </div>
                <label className="flex items-center gap-1.5 text-[11.5px]">
                  <input type="checkbox" className="h-3.5 w-3.5 accent-[#0F766E]" checked={showAll}
                    onChange={(e) => toggleShowAll(e.target.checked)} data-testid="simadd-show-all" />
                  Tampilkan semua member nyata
                </label>
              </div>
              <div className="table-wrap max-h-[52vh] overflow-y-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th className="px-2 text-left">Member</th>
                      <th className="px-2 text-left">Sponsor</th>
                      <th className="px-2 text-left">Placement</th>
                      {BONUS_LIST.map((b, i) => (
                        <th key={b.key} className="px-1.5 text-right" title={b.label}>
                          <span className="inline-flex items-center gap-1">
                            <BonusDot index={i} />{b.label.replace('Bonus ', '')}
                          </span>
                        </th>
                      ))}
                      <th className="px-2 text-right">Total</th>
                      <th className="px-2 text-right">Selisih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.results.length === 0 ? (
                      <tr><td colSpan={12} className="p-5 text-center text-[13px] text-muted-foreground">
                        Belum ada bonus yang terbentuk dari skenario ini.
                      </td></tr>
                    ) : res.results.map((r) => (
                      <tr key={r.member_id} onClick={() => setSel(r)}
                        className={`cursor-pointer ${sel?.member_id === r.member_id ? 'is-selected' : ''}`}
                        data-testid={`simadd-row-${r.member_id}`}>
                        <td className="px-2">
                          <p className="font-mono text-[11px] font-semibold">{r.member_id}</p>
                          <p className="text-[10.5px] text-muted-foreground">
                            {r.is_simulasi ? `Simulasi · batch ${r.batch || 1}${r.level ? ` · L${r.level}` : ''}` : 'Member nyata'} · {r.name}
                          </p>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            <MembershipBadge membership={r.membership} /><RankBadge rank={r.rank} />
                          </div>
                        </td>
                        <td className="px-2 font-mono text-[10.5px] text-muted-foreground">{r.sponsor_id || '—'}</td>
                        <td className="px-2 font-mono text-[10.5px] text-muted-foreground">{r.placement_id || '—'}</td>
                        {BONUS_LIST.map((b) => (
                          <td key={b.key} className="px-1.5 text-right font-mono text-[11px]">{num(r[b.key])}</td>
                        ))}
                        <td className="px-2 text-right font-mono text-[11.5px] font-semibold">{num(r.total_bonus_bv)}</td>
                        <td className={`px-2 text-right font-mono text-[11.5px] font-semibold ${
                          r.delta_bv > 0 ? 'text-[hsl(var(--success))]' : r.delta_bv < 0 ? 'text-[hsl(var(--danger))]' : 'text-muted-foreground'
                        }`}>
                          {r.delta_bv > 0 ? '+' : ''}{num(r.delta_bv)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid content-start gap-3">
              <div className="card-c p-3">
                <h3 className="font-display text-[14px] font-semibold">Komposisi Bonus</h3>
                <div className="mt-2 grid gap-1">
                  {BONUS_LIST.map((b, i) => (
                    <div key={b.key} className="flex items-center justify-between gap-2 text-[11.5px]">
                      <span className="flex items-center gap-1.5"><BonusDot index={i} />{b.label}</span>
                      <span className="font-mono">
                        {num(res.bonus?.per_type_sesudah?.[b.label])}
                        <span className={`ml-1.5 ${
                          (res.bonus?.per_type_delta?.[b.label] || 0) > 0 ? 'text-[hsl(var(--success))]' : 'text-muted-foreground'
                        }`}>
                          ({(res.bonus?.per_type_delta?.[b.label] || 0) > 0 ? '+' : ''}
                          {num(res.bonus?.per_type_delta?.[b.label])})
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-c p-3">
                <h3 className="font-display text-[14px] font-semibold">Rincian Rumus</h3>
                {!sel ? (
                  <p className="mt-2 text-[12px] text-muted-foreground">Pilih salah satu baris hasil atau simpul pohon.</p>
                ) : (
                  <div className="mt-2 grid gap-2" data-testid="simadd-detail">
                    <p className="font-mono text-[11.5px] font-semibold">{sel.member_id}</p>
                    <div className="flex flex-wrap gap-1">
                      <MembershipBadge membership={sel.membership} /><RankBadge rank={sel.rank} />
                      <TupoBadge ok={sel.tupo_ok} required={sel.tupo_required} manual={sel.tupo_manual} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Sponsor <b className="font-mono text-foreground">{sel.sponsor_id || '—'}</b> ·
                      Placement <b className="font-mono text-foreground">{sel.placement_id || '—'}</b>
                    </p>
                    {(sel.lines || []).length === 0 ? (
                      <p className="text-[12px] text-muted-foreground">
                        {sel.lines ? 'Tidak ada bonus untuk member ini.'
                          : 'Klik baris member di tabel untuk melihat rumus lengkapnya.'}
                      </p>
                    ) : (sel.lines || []).map((l, i) => (
                      <div key={i} className="formula text-[11px]">
                        <b>{l.bonus}</b><br />{l.description}<br />
                        {num(l.base_pv)} PV × {pct(l.rate)} = {num(l.amount_bv)} BV
                      </div>
                    ))}
                    <div className="rounded-lg bg-primary px-2.5 py-1.5 text-primary-foreground">
                      <p className="text-[10px] uppercase opacity-80">Total bonus</p>
                      <p className="font-mono text-[15px]">{num(sel.total_bonus_bv)} BV · {rp(sel.total_bonus_rp)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* --------------------------------------- PENEMPATAN BATCH INI */}
          {res.assignments?.length ? (
            <div className="card-c overflow-hidden">
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <Network className="h-3.5 w-3.5 text-primary" />
                <h3 className="font-display text-[14px] font-semibold">
                  Penempatan Member Batch {res.batch}
                </h3>
              </div>
              <div className="table-wrap max-h-[40vh] overflow-y-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th className="px-2 text-left">Member simulasi</th>
                      <th className="px-2 text-center">Level</th>
                      <th className="px-2 text-left">Induk</th>
                      <th className="px-2 text-left">Sponsor</th>
                      <th className="px-2 text-left">Placement</th>
                      <th className="px-2 text-right">Omset Perk.</th>
                      <th className="px-2 text-right">Omset Penj.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.assignments.map((a) => (
                      <tr key={a.member_id} data-testid={`simadd-assign-${a.member_id}`}>
                        <td className="px-2 font-mono text-[11px]">{a.member_id}</td>
                        <td className="px-2 text-center">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10.5px]">
                            L{a.level || 1}
                          </span>
                        </td>
                        <td className="px-2 font-mono text-[11px] text-muted-foreground">{a.induk || '— (akar)'}</td>
                        <td className="px-2 font-mono text-[11px]">{a.sponsor_id || '— (akar)'}</td>
                        <td className="px-2 font-mono text-[11px]">{a.placement_id || '— (akar)'}</td>
                        <td className="px-2 text-right font-mono text-[11px]">{num(a.pv_perkembangan)}</td>
                        <td className="px-2 text-right font-mono text-[11px]">{num(a.pv_penjualan)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
