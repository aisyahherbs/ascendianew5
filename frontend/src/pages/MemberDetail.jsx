import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import AppShell from '../components/AppShell';
import MemberPicker from '../components/MemberPicker';
import { MembershipBadge, RankBadge, RoleBadge, StatusBadge, TupoBadge } from '../components/Badges';
import StatCard from '../components/StatCard';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BONUS_LIST, num, periodLabel, rp, tanggal } from '../lib/format';

export default function MemberDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [stmt, setStmt] = useState(null);
  const [hist, setHist] = useState([]);
  const [edit, setEdit] = useState({ sponsor_id: '', placement_id: '', stokis_id: '', name: '', phone: '', province: '', city: '' });

  const load = async () => {
    try {
      const { data } = await api.get(`/members/${id}`);
      setD(data);
      setEdit({
        name: data.member.name || '', phone: data.member.phone || '', province: data.member.province || '',
        city: data.member.city || '', sponsor_id: data.member.sponsor_id || '',
        placement_id: data.member.placement_id || '', stokis_id: data.member.stokis_id || '',
      });
    } catch (e) { toast.error(errMsg(e)); }
    try {
      const { data } = await api.get(`/bonus/statement/${id}`);
      setStmt(data);
    } catch (e) { setStmt(null); }
    try {
      const { data } = await api.get(`/bonus/history/${id}`);
      setHist(data);
    } catch (e) { setHist([]); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const save = async () => {
    try {
      await api.put(`/members/${id}`, edit);
      toast.success('Data member diperbarui');
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  if (!d) return <AppShell title="Detail Member"><p className="text-sm text-muted-foreground">Memuat...</p></AppShell>;
  const m = d.member;
  const r = stmt?.result || {};
  const canEdit = user?.role !== 'member';

  return (
    <AppShell title={`${m.name}`} subtitle={`${m.member_id} · bergabung ${tanggal(m.join_date)}`}>
      <div className="grid gap-4 md:gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <RoleBadge role={m.role} />
          <RankBadge rank={r.rank || m.stat_rank} />
          <MembershipBadge membership={r.membership || m.stat_membership} />
          <StatusBadge active={m.active} />
          {stmt ? <TupoBadge ok={r.tupo_ok} required={r.tupo_required} /> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard testid="detail-appv" label="APPV" value={`${num(r.appv ?? m.stat_appv)} PV`} sub={`Perkembangan ${num(r.appv_perkembangan ?? m.stat_appv_perkembangan)} PV`} />
          <StatCard testid="detail-atnpv" label="ATNPV" value={`${num(r.atnpv ?? m.stat_atnpv)} PV`} sub={`TNPV periode ${num(r.tnpv)} PV`} />
          <StatCard testid="detail-ppv" label="PPV Periode Ini" value={`${num(r.ppv)} PV`} sub={`Perk ${num(r.ppv_perkembangan)} · Penj ${num(r.ppv_penjualan)}`} />
          <StatCard testid="detail-bonus" label="Bonus Periode Ini" value={`${num(r.total_bonus_bv)} BV`} sub={rp((r.total_bonus_bv || 0) * 1000)} tone="primary" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-display text-base font-semibold">Data & Struktur</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5"><Label className="text-xs uppercase text-muted-foreground">Nama</Label>
                <Input className="h-11" value={edit.name} disabled={!canEdit} onChange={(e) => setEdit({ ...edit, name: e.target.value })} data-testid="edit-name" /></div>
              <div className="grid gap-1.5"><Label className="text-xs uppercase text-muted-foreground">No. HP</Label>
                <Input className="h-11" value={edit.phone} disabled={!canEdit} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} data-testid="edit-phone" /></div>
              <div className="grid gap-1.5"><Label className="text-xs uppercase text-muted-foreground">Provinsi</Label>
                <Input className="h-11" value={edit.province} disabled={!canEdit} onChange={(e) => setEdit({ ...edit, province: e.target.value })} data-testid="edit-province" /></div>
              <div className="grid gap-1.5"><Label className="text-xs uppercase text-muted-foreground">Kota</Label>
                <Input className="h-11" value={edit.city} disabled={!canEdit} onChange={(e) => setEdit({ ...edit, city: e.target.value })} data-testid="edit-city" /></div>
              {canEdit ? (
                <>
                  <div className="grid gap-1.5"><Label className="text-xs uppercase text-muted-foreground">Sponsor</Label>
                    <MemberPicker value={edit.sponsor_id} onChange={(v) => setEdit({ ...edit, sponsor_id: v })} testid="edit-sponsor" /></div>
                  <div className="grid gap-1.5"><Label className="text-xs uppercase text-muted-foreground">Placement</Label>
                    <MemberPicker value={edit.placement_id} onChange={(v) => setEdit({ ...edit, placement_id: v })} testid="edit-placement" /></div>
                  <div className="grid gap-1.5"><Label className="text-xs uppercase text-muted-foreground">Stokis</Label>
                    <MemberPicker value={edit.stokis_id} onChange={(v) => setEdit({ ...edit, stokis_id: v })} testid="edit-stokis" /></div>
                </>
              ) : null}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Frontline sponsor {d.frontline_sponsor} · placement {d.frontline_placement}</p>
              {canEdit ? <Button onClick={save} data-testid="save-member-button">Simpan Perubahan</Button> : null}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-display text-base font-semibold">Bonus {stmt ? periodLabel(stmt.period_key) : ''}</h3>
            <div className="mt-3 grid gap-2">
              {BONUS_LIST.map((b) => (
                <div key={b.key} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
                  <span className="text-sm">{b.label}</span>
                  <span className="font-mono text-sm">{num(r[b.key])} BV</span>
                </div>
              ))}
            </div>
            {Object.keys(r.carry || {}).length ? (
              <div className="mt-3">
                <p className="text-xs uppercase text-muted-foreground">Sisa omset pasangan</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {Object.entries(r.carry).map(([k, v]) => (
                    <span key={k} className="rounded border bg-muted px-2 py-1 font-mono text-[11px]">{k}: {num(v)} PV</span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3"><h3 className="font-display text-base font-semibold">Riwayat Omset</h3></div>
          <div className="table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr><th className="px-4 py-2 text-left">Tanggal</th><th className="px-2 py-2 text-left">Periode</th><th className="px-2 py-2 text-left">Jenis</th><th className="px-2 py-2 text-left">Keterangan</th><th className="px-4 py-2 text-right">PV</th></tr>
              </thead>
              <tbody>
                {(d.transactions || []).length === 0 ? (
                  <tr><td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">Belum ada transaksi</td></tr>
                ) : d.transactions.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{tanggal(t.date)}</td>
                    <td className="px-2 py-2 font-mono text-xs">{t.period_key}</td>
                    <td className="px-2 py-2 capitalize">{t.kind}</td>
                    <td className="px-2 py-2 text-muted-foreground">{t.product_name || t.note || '-'}</td>
                    <td className="px-4 py-2 text-right font-mono">{num(t.pv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {hist.length ? (
          <div className="rounded-xl border bg-card">
            <div className="border-b px-4 py-3"><h3 className="font-display text-base font-semibold">Riwayat Bonus per Periode</h3></div>
            <div className="table-wrap">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr><th className="px-4 py-2 text-left">Periode</th>{BONUS_LIST.map((b) => <th key={b.key} className="px-2 py-2 text-right">{b.label.replace('Bonus ', '')}</th>)}<th className="px-4 py-2 text-right">Total</th></tr>
                </thead>
                <tbody>
                  {hist.map((h) => (
                    <tr key={h.period_key} className="border-b last:border-0">
                      <td className="px-4 py-2 font-mono text-xs">{h.period_key}</td>
                      {BONUS_LIST.map((b) => <td key={b.key} className="px-2 py-2 text-right font-mono text-xs">{num(h[b.key])}</td>)}
                      <td className="px-4 py-2 text-right font-mono">{num(h.total_bonus_bv)}</td>
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
