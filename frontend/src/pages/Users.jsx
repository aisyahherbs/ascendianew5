import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Info, KeyRound, Pencil, Plus, ShieldOff, Trash2, UserCheck, UserX } from 'lucide-react';
import AppShell from '../components/AppShell';
import { MemberForm, MemberEditDialog } from './Members';
import BulkBar, { Checkbox } from '../components/BulkBar';
import AccessDialog from '../components/AccessDialog';
import { PageLockBadge, RoleBadge, StatusBadge } from '../components/Badges';
import { ProvinceFilter } from '../components/RegionSelect';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { num, tanggal } from '../lib/format';

export default function Users() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [pwTarget, setPwTarget] = useState(null);
  const [accessTargets, setAccessTargets] = useState(null);
  const [pw, setPw] = useState('');
  const [province, setProvince] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = province ? { province } : {};
      const all = await Promise.all([
        api.get('/members', { params: { ...params, role: 'admin_pusat' } }),
        api.get('/members', { params: { ...params, role: 'admin_provinsi' } }),
        api.get('/members', { params: { ...params, role: 'stokis' } }),
      ]);
      const merged = [...all[0].data, ...all[1].data, ...all[2].data];
      setRows(merged);
      setSelected((prev) => new Set([...prev].filter((id) => merged.some((d) => d.member_id === id))));
    } catch (e) { toast.error(errMsg(e)); }
  }, [province]);

  useEffect(() => { load(); }, [load]);

  const provinceAdmin = useMemo(() => {
    const map = {};
    rows.filter((r) => r.role === 'admin_provinsi').forEach((r) => {
      map[r.province || ''] = map[r.province || ''] || [];
      map[r.province || ''].push(r);
    });
    return map;
  }, [rows]);

  const selectable = useMemo(() => rows.filter((m) => m.member_id !== user?.member_id), [rows, user]);
  const allChecked = selectable.length > 0 && selectable.every((m) => selected.has(m.member_id));
  const someChecked = selectable.some((m) => selected.has(m.member_id));
  const ids = [...selected];

  const toggleOne = (id, on) => setSelected((prev) => {
    const next = new Set(prev);
    if (on) next.add(id); else next.delete(id);
    return next;
  });

  const reportResult = (data) => {
    toast.success(data.message);
    (data.failed || []).forEach((f) => toast.error(`${f.member_id}: ${f.reason}`));
    setSelected(new Set());
    load();
  };

  const bulkStatus = async (active) => {
    setBusy(true);
    try { const { data } = await api.post('/members/bulk/status', { member_ids: ids, active }); reportResult(data); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const bulkDelete = async () => {
    if (!window.confirm(`Hapus ${ids.length} pengguna terpilih?`)) return;
    setBusy(true);
    try { const { data } = await api.post('/members/bulk/delete', { member_ids: ids }); reportResult(data); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const toggleStatus = async (m) => {
    try { await api.post(`/members/${m.member_id}/status`, { active: !m.active }); toast.success('Status diperbarui'); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  const remove = async (m) => {
    if (!window.confirm(`Hapus ${m.member_id}?`)) return;
    try { await api.delete(`/members/${m.member_id}`); toast.success('Dihapus'); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  const savePw = async () => {
    try {
      await api.post(`/members/${pwTarget.member_id}/password`, { password: pw });
      toast.success('Sandi diperbarui'); setPwTarget(null); setPw('');
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <AppShell
      title="Admin & Stokis"
      subtitle="Peran operasional: tidak masuk struktur jaringan sponsor / placement dan tidak menerima bonus jaringan"
      actions={<Button size="sm" onClick={() => setOpen(true)} data-testid="add-user-button"><Plus className="mr-1 h-3.5 w-3.5" /> Tambah</Button>}
    >
      <div className="grid gap-3">
        <p className="flex items-start gap-1.5 rounded-md border border-[hsl(var(--info)/0.3)] bg-[hsl(var(--info)/0.08)] px-2.5 py-1.5 text-[11px] leading-snug text-[hsl(var(--info-soft-foreground))]">
          <Info className="mt-[1px] h-3.5 w-3.5 shrink-0" />
          Admin Provinsi cukup mengisi provinsi. Stokis mengisi provinsi + kabupaten/kota lalu otomatis berada di bawah Admin Provinsi wilayah tersebut. Stokis hanya menerima fee perantara dari omset member yang mendaftar padanya.
        </p>

        <div className="card-c flex flex-wrap items-center gap-2 p-2.5">
          <ProvinceFilter value={province} onChange={setProvince} testid="users-filter-province" />
          <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">{rows.length} pengguna</span>
        </div>

        <BulkBar
          count={selected.size} busy={busy}
          onClear={() => setSelected(new Set())}
          onActivate={() => bulkStatus(true)}
          onDeactivate={() => bulkStatus(false)}
          onDelete={bulkDelete}
          onAccess={() => setAccessTargets(rows.filter((r) => selected.has(r.member_id) && r.role !== 'admin_pusat'))}
          testid="users-bulk-bar"
        />

        <div className="card-c overflow-hidden">
          <div className="table-wrap max-h-[70vh] overflow-y-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="px-2.5 text-left">
                    <Checkbox checked={allChecked} indeterminate={someChecked}
                      onChange={(on) => setSelected(on ? new Set(selectable.map((m) => m.member_id)) : new Set())}
                      testid="users-select-all" title="Pilih semua" />
                  </th>
                  <th className="px-2 text-left">ID</th><th className="px-2 text-left">Nama</th>
                  <th className="px-2 text-left">Peran</th><th className="px-2 text-left">Wilayah</th>
                  <th className="px-2 text-left">Atasan</th>
                  <th className="px-2 text-right">Member</th>
                  <th className="px-2 text-left">Dibuat</th><th className="px-2 text-left">Status</th>
                  <th className="px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={10} className="p-6 text-center text-[13px] text-muted-foreground">Belum ada data</td></tr>
                ) : rows.map((m) => {
                  const atasan = m.role === 'stokis'
                    ? (provinceAdmin[m.province || ''] || []).map((a) => a.name).join(', ') || 'Belum ada Admin Provinsi'
                    : m.role === 'admin_provinsi' ? 'Admin Pusat' : '—';
                  return (
                    <tr key={m.member_id} className={selected.has(m.member_id) ? 'is-selected' : ''}
                      data-testid={`user-row-${m.member_id}`}>
                      <td className="px-2.5">
                        {m.member_id === user?.member_id ? (
                          <span className="text-[10px] text-muted-foreground">Anda</span>
                        ) : (
                          <Checkbox checked={selected.has(m.member_id)} onChange={(on) => toggleOne(m.member_id, on)} testid={`user-check-${m.member_id}`} />
                        )}
                      </td>
                      <td className="px-2"><Link to={`/members/${m.member_id}`} className="font-mono text-[11px] font-semibold text-primary hover:underline">{m.member_id}</Link></td>
                      <td className="px-2">
                        <p className="font-medium">{m.name}</p>
                        {(m.blocked_pages || []).length ? (
                          <div className="mt-1"><PageLockBadge count={m.blocked_pages.length}
                            titleText={`Halaman ditutup: ${m.blocked_pages.join(', ')}`} /></div>
                        ) : null}
                      </td>
                      <td className="px-2"><RoleBadge role={m.role} /></td>
                      <td className="px-2 text-muted-foreground">{m.province || '-'}{m.city ? `, ${m.city}` : ''}</td>
                      <td className="px-2 text-[11px] text-muted-foreground">{atasan}</td>
                      <td className="px-2 text-right font-mono text-[11px]">{m.role === 'stokis' ? num(m.stat_member_count ?? 0) : '—'}</td>
                      <td className="px-2 text-muted-foreground">{tanggal(m.created_at)}</td>
                      <td className="px-2"><StatusBadge active={m.active} /></td>
                      <td className="px-3">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setEditTarget(m)} data-testid={`user-edit-${m.member_id}`} title="Ubah data"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setPwTarget(m)} data-testid={`user-password-${m.member_id}`}><KeyRound className="h-3.5 w-3.5" /></Button>
                          {m.member_id !== user?.member_id ? (
                            <>
                              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => toggleStatus(m)} data-testid={`user-status-${m.member_id}`}>{m.active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}</Button>
                              {m.role !== 'admin_pusat' ? (
                                <Button size="sm" variant="outline" className="h-7 px-2 text-[hsl(var(--danger))]"
                                  onClick={() => setAccessTargets([m])} data-testid={`user-access-${m.member_id}`}
                                  title="Tutup halaman untuk pengguna ini"><ShieldOff className="h-3.5 w-3.5" /></Button>
                              ) : null}
                              <Button size="sm" variant="outline" className="h-7 px-2 text-destructive" onClick={() => remove(m)} data-testid={`user-delete-${m.member_id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <MemberForm open={open} onClose={() => setOpen(false)} onSaved={load} defaultRole="stokis" roleOptions={['stokis', 'admin_provinsi', 'admin_pusat']} />
      <MemberEditDialog target={editTarget} onClose={() => setEditTarget(null)} onSaved={load} />
      <AccessDialog targets={accessTargets} onClose={() => setAccessTargets(null)}
        onSaved={() => { setSelected(new Set()); load(); }} />

      <Dialog open={!!pwTarget} onOpenChange={(o) => !o && setPwTarget(null)}>
        <DialogContent className="max-w-md bg-card p-4">
          <DialogHeader className="pb-1"><DialogTitle className="font-display text-base">Ganti Sandi {pwTarget?.member_id}</DialogTitle></DialogHeader>
          <div className="grid gap-1">
            <Label className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Sandi baru</Label>
            <Input className="h-9 text-[13px]" value={pw} onChange={(e) => setPw(e.target.value)} data-testid="user-new-password" />
          </div>
          <DialogFooter className="pt-2">
            <Button size="sm" variant="outline" onClick={() => setPwTarget(null)}>Batal</Button>
            <Button size="sm" onClick={savePw} data-testid="user-save-password">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
