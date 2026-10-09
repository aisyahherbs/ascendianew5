import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertCircle, Award, Flame, Info, KeyRound, Loader2, Pencil, Plus, Search, ShieldOff, Trash2,
  UserCheck, UserX,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import MemberPicker from '../components/MemberPicker';
import PlacementHint from '../components/PlacementHint';
import RegionSelect, { ProvinceFilter } from '../components/RegionSelect';
import BulkBar, { Checkbox } from '../components/BulkBar';
import AccessDialog from '../components/AccessDialog';
import {
  BonusOffBadge, MembershipBadge, OverrideBadge, PageLockBadge, RankBadge, RoleBadge,
  StatusBadge, TupoFlame,
} from '../components/Badges';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { num, tanggal } from '../lib/format';

const ROLE_NAME = {
  member: 'Member', stokis: 'Stokis', admin_provinsi: 'Admin Provinsi', admin_pusat: 'Admin Pusat',
};

/** Field apa saja yang relevan untuk setiap peran. */
export const ROLE_FIELDS = {
  member: { network: true, region: true, city: true, phone: true, omset: true, bank: true },
  stokis: { network: false, region: true, city: true, phone: true, omset: false, bank: true },
  admin_provinsi: { network: false, region: true, city: false, phone: true, omset: false, bank: false },
  admin_pusat: { network: false, region: false, city: false, phone: true, omset: false, bank: false },
};

const ROLE_HINT = {
  member: 'Member adalah satu-satunya peran yang masuk struktur jaringan sponsor & placement dan mendapat bonus.',
  stokis: 'Stokis cukup provinsi & kabupaten/kota. Otomatis berada di bawah Admin Provinsi wilayah tersebut dan hanya menerima fee perantara dari omset member yang mendaftar padanya.',
  admin_provinsi: 'Admin Provinsi membawahi seluruh Stokis di provinsinya. Tidak punya PV, jenis omset, maupun posisi di jaringan.',
  admin_pusat: 'Admin Pusat mengelola seluruh sistem. Tidak punya wilayah, PV, maupun posisi di jaringan.',
};

const LBL = 'text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground';
const REQ = <span className="text-[hsl(var(--danger))]">*</span>;

function Err({ id, msg }) {
  if (!msg) return null;
  return (
    <p className="field-err" data-testid={`form-error-${id}`}>
      <AlertCircle className="h-3 w-3" /> {msg}
    </p>
  );
}

/* ============================================================ TAMBAH PENGGUNA */
export function MemberForm({ open, onClose, onSaved, roleOptions, defaultRole = 'member' }) {
  const { user } = useAuth();
  const blank = {
    name: '', role: defaultRole, member_id: '', password: '', phone: '', email: '',
    province: '', city: '', address: '', bank_name: '', bank_account: '',
    sponsor_id: '', placement_id: '', stokis_id: '',
    join_date: new Date().toISOString().slice(0, 10), initial_pv: '', initial_pv_kind: 'perkembangan',
  };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState({});
  const [saving, setSaving] = useState(false);
  const [memberCount, setMemberCount] = useState(null);

  const set = (k, v) => {
    setF((p) => ({ ...p, [k]: v }));
    setErr((p) => (p[k] ? { ...p, [k]: '' } : p));
  };

  useEffect(() => {
    if (!open) return;
    setF({ ...blank, role: defaultRole });
    setErr({});
    api.get('/members', { params: { role: 'member', limit: 1 } })
      .then(({ data }) => setMemberCount(data.length))
      .catch(() => setMemberCount(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultRole]);

  const cfg = ROLE_FIELDS[f.role] || ROLE_FIELDS.member;
  const isFirstMember = f.role === 'member' && memberCount === 0;

  const validate = () => {
    const e = {};
    if (!f.name.trim()) e.name = 'Nama lengkap wajib diisi';
    else if (f.name.trim().length < 3) e.name = 'Nama lengkap minimal 3 karakter';
    if (f.password && f.password.length < 6) e.password = 'Sandi awal minimal 6 karakter';
    if (cfg.phone && !f.phone.trim()) e.phone = 'No. HP wajib diisi';
    if (cfg.region && !f.province) e.province = 'Provinsi wajib dipilih';
    if (cfg.city && !f.city) e.city = 'Kabupaten / Kota wajib dipilih';
    if (cfg.network && !isFirstMember && !f.sponsor_id.trim()) e.sponsor_id = 'Sponsor wajib diisi untuk Member';
    setErr(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Lengkapi kolom wajib terlebih dahulu');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...f, initial_pv: Number(f.initial_pv || 0) };
      if (!payload.member_id) delete payload.member_id;
      if (!payload.password) delete payload.password;
      if (!cfg.network) {
        payload.sponsor_id = '';
        payload.placement_id = '';
        payload.stokis_id = '';
      }
      if (!cfg.omset) payload.initial_pv = 0;
      const { data } = await api.post('/members', payload);
      const pi = data.placement_info;
      const extra = pi && pi.turun
        ? ` · Placement otomatis turun ke ${pi.placement_id} (kaki ${pi.root} sudah penuh 2/2)`
        : (pi && pi.placement_id ? ` · Placement: ${pi.placement_id}` : '');
      toast.success(`Berhasil dibuat: ${data.member.member_id}`, {
        description: `Sandi awal: ${data.initial_password}${extra}`,
        duration: pi && pi.turun ? 9000 : 5000,
      });
      if (pi && pi.turun) toast.info(pi.reason, { duration: 10000 });
      onSaved && onSaved(data.member);
      onClose();
    } catch (e2) {
      toast.error(errMsg(e2));
    } finally {
      setSaving(false);
    }
  };

  const options = roleOptions || (user?.role === 'admin_pusat'
    ? ['member', 'stokis', 'admin_provinsi', 'admin_pusat']
    : user?.role === 'admin_provinsi' ? ['member', 'stokis'] : ['member']);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-[760px] overflow-y-auto bg-card p-4 md:p-5">
        <DialogHeader className="pb-1">
          <DialogTitle className="font-display text-base">Tambah Pengguna Baru</DialogTitle>
          <div className="accent-bar" />
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-2.5">
          {/* --------- peran --------- */}
          <div className="grid gap-2.5 md:grid-cols-2">
            <div className="grid gap-1">
              <Label className={LBL}>Peran</Label>
              <select
                className="h-9 rounded-md border bg-background px-2.5 text-[13px]"
                value={f.role}
                onChange={(e) => { set('role', e.target.value); setErr({}); }}
                data-testid="form-role"
              >
                {options.map((r) => <option key={r} value={r}>{ROLE_NAME[r]}</option>)}
              </select>
            </div>
            <div className="grid gap-1">
              <Label className={LBL}>Nama lengkap {REQ}</Label>
              <Input
                className={`h-9 text-[13px] ${err.name ? 'input-err' : ''}`}
                value={f.name} onChange={(e) => set('name', e.target.value)} data-testid="form-name"
              />
              <Err id="name" msg={err.name} />
            </div>
          </div>

          <p className="flex items-start gap-1.5 rounded-md border border-[hsl(var(--info)/0.3)] bg-[hsl(var(--info)/0.08)] px-2.5 py-1.5 text-[11px] leading-snug text-[hsl(var(--info-soft-foreground))]"
             data-testid="form-role-hint">
            <Info className="mt-[1px] h-3.5 w-3.5 shrink-0" /> {ROLE_HINT[f.role]}
          </p>

          {/* --------- akun --------- */}
          <p className={`${LBL} pt-1`}>Data akun</p>
          <div className="grid gap-2.5 md:grid-cols-3">
            <div className="grid gap-1">
              <Label className={LBL}>ID Member (opsional)</Label>
              <Input className="h-9 font-mono text-[13px]" placeholder="otomatis" value={f.member_id}
                onChange={(e) => set('member_id', e.target.value)} data-testid="form-member-id" />
            </div>
            <div className="grid gap-1">
              <Label className={LBL}>Sandi awal</Label>
              <Input className={`h-9 text-[13px] ${err.password ? 'input-err' : ''}`} placeholder="123456"
                value={f.password} onChange={(e) => set('password', e.target.value)} data-testid="form-password" />
              <Err id="password" msg={err.password} />
            </div>
            <div className="grid gap-1">
              <Label className={LBL}>Tanggal daftar</Label>
              <Input className="h-9 text-[13px]" type="date" value={f.join_date}
                onChange={(e) => set('join_date', e.target.value)} data-testid="form-join-date" />
            </div>
          </div>

          {/* --------- kontak & wilayah --------- */}
          <p className={`${LBL} pt-1`}>Kontak & wilayah</p>
          <div className="grid gap-2.5 md:grid-cols-2">
            {cfg.phone ? (
              <div className="grid gap-1">
                <Label className={LBL}>No. HP {REQ}</Label>
                <Input className={`h-9 text-[13px] ${err.phone ? 'input-err' : ''}`} value={f.phone}
                  onChange={(e) => set('phone', e.target.value)} data-testid="form-phone" />
                <Err id="phone" msg={err.phone} />
              </div>
            ) : null}
            <div className="grid gap-1">
              <Label className={LBL}>Email (opsional)</Label>
              <Input className="h-9 text-[13px]" value={f.email}
                onChange={(e) => set('email', e.target.value)} data-testid="form-email" />
            </div>
            {cfg.region ? (
              <RegionSelect
                province={f.province}
                city={f.city}
                required
                showCity={cfg.city}
                errProvince={err.province}
                errCity={err.city}
                onChange={({ province, city }) => {
                  setF((p) => ({ ...p, province, city }));
                  setErr((p) => ({ ...p, province: '', city: '' }));
                }}
                testid="form-region"
              />
            ) : null}
            {cfg.bank ? (
              <>
                <div className="grid gap-1">
                  <Label className={LBL}>Nama bank (opsional)</Label>
                  <Input className="h-9 text-[13px]" value={f.bank_name}
                    onChange={(e) => set('bank_name', e.target.value)} data-testid="form-bank-name" />
                </div>
                <div className="grid gap-1">
                  <Label className={LBL}>No. rekening (opsional)</Label>
                  <Input className="h-9 font-mono text-[13px]" value={f.bank_account}
                    onChange={(e) => set('bank_account', e.target.value)} data-testid="form-bank-account" />
                </div>
              </>
            ) : null}
          </div>

          {/* --------- jaringan + omset (hanya member) --------- */}
          {cfg.network ? (
            <>
              <p className={`${LBL} pt-1`}>Posisi jaringan</p>
              {isFirstMember ? (
                <p className="rounded-md border border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.1)] px-2.5 py-1.5 text-[11px] text-[hsl(var(--warning-soft-foreground))]"
                   data-testid="form-first-member-note">
                  Belum ada member sama sekali. Member pertama ini otomatis menjadi akar jaringan, jadi sponsor boleh dikosongkan.
                </p>
              ) : null}
              <div className="grid gap-2.5 md:grid-cols-3">
                <div className="grid gap-1">
                  <Label className={LBL}>Sponsor {isFirstMember ? null : REQ}</Label>
                  <MemberPicker value={f.sponsor_id} role="member" invalid={!!err.sponsor_id}
                    onChange={(v) => set('sponsor_id', v)} testid="form-sponsor" />
                  <Err id="sponsor_id" msg={err.sponsor_id} />
                </div>
                <div className="grid gap-1">
                  <Label className={LBL}>Placement (kosong = otomatis seimbang, maks 2 kaki)</Label>
                  <MemberPicker value={f.placement_id} role="member"
                    onChange={(v) => set('placement_id', v)} testid="form-placement" />
                  <PlacementHint sponsorId={f.sponsor_id} placementId={f.placement_id} />
                </div>
                {user?.role !== 'stokis' ? (
                  <div className="grid gap-1">
                    <Label className={LBL}>Stokis pendaftar (opsional)</Label>
                    <MemberPicker value={f.stokis_id} role="stokis"
                      onChange={(v) => set('stokis_id', v)} testid="form-stokis" />
                  </div>
                ) : null}
              </div>

              <p className={`${LBL} pt-1`}>Belanja pendaftaran</p>
              <div className="grid gap-2.5 md:grid-cols-2">
                <div className="grid gap-1">
                  <Label className={LBL}>Belanja pendaftaran (PV)</Label>
                  <Input className="h-9 font-mono text-[13px]" type="number" min="0" value={f.initial_pv}
                    onChange={(e) => set('initial_pv', e.target.value)} data-testid="form-initial-pv" />
                </div>
                <div className="grid gap-1">
                  <Label className={LBL}>Jenis omset pendaftaran</Label>
                  <select className="h-9 rounded-md border bg-background px-2.5 text-[13px]"
                    value={f.initial_pv_kind} onChange={(e) => set('initial_pv_kind', e.target.value)}
                    data-testid="form-initial-kind">
                    <option value="perkembangan">Omset Perkembangan (Membership)</option>
                    <option value="penjualan">Omset Penjualan</option>
                  </select>
                </div>
              </div>
            </>
          ) : null}

          <DialogFooter className="pt-2">
            <Button type="button" size="sm" variant="outline" onClick={onClose} data-testid="form-cancel">Batal</Button>
            <Button type="submit" size="sm" disabled={saving} data-testid="form-submit">
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null} Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================ UBAH DATA */
export function MemberEditDialog({ target, onClose, onSaved }) {
  const { user } = useAuth();
  const [f, setF] = useState(null);
  const [err, setErr] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) { setF(null); return; }
    setErr({});
    setF({
      name: target.name || '', phone: target.phone || '', email: target.email || '',
      address: target.address || '', province: target.province || '', city: target.city || '',
      bank_name: target.bank_name || '', bank_account: target.bank_account || '',
      sponsor_id: target.sponsor_id || '', placement_id: target.placement_id || '',
      stokis_id: target.stokis_id || '', role: target.role || 'member',
    });
  }, [target]);

  if (!target || !f) return null;
  const set = (k, v) => {
    setF((p) => ({ ...p, [k]: v }));
    setErr((p) => (p[k] ? { ...p, [k]: '' } : p));
  };
  const isPusat = user?.role === 'admin_pusat';
  const cfg = ROLE_FIELDS[f.role] || ROLE_FIELDS.member;

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!f.name.trim() || f.name.trim().length < 3) er.name = 'Nama lengkap minimal 3 karakter';
    if (cfg.region && !f.province) er.province = 'Provinsi wajib dipilih';
    if (cfg.city && !f.city) er.city = 'Kabupaten / Kota wajib dipilih';
    setErr(er);
    if (Object.keys(er).length) { toast.error('Lengkapi kolom wajib terlebih dahulu'); return; }
    setSaving(true);
    try {
      const payload = { ...f };
      if (!isPusat) delete payload.role;
      if (!cfg.network) {
        payload.sponsor_id = '';
        payload.placement_id = '';
        payload.stokis_id = '';
      }
      const { data: up } = await api.put(`/members/${target.member_id}`, payload);
      toast.success(`${target.member_id} diperbarui`);
      if (up?.placement_info?.turun) {
        toast.info(up.placement_info.reason, { duration: 10000 });
      }
      onSaved && onSaved();
      onClose();
    } catch (e2) { toast.error(errMsg(e2)); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-[720px] overflow-y-auto bg-card p-4 md:p-5">
        <DialogHeader className="pb-1">
          <DialogTitle className="font-display text-base">
            Ubah Data <span className="font-mono text-xs text-muted-foreground">{target.member_id}</span>
          </DialogTitle>
          <div className="accent-bar" />
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-2.5 md:grid-cols-2">
          <div className="grid gap-1">
            <Label className={LBL}>Nama lengkap {REQ}</Label>
            <Input className={`h-9 text-[13px] ${err.name ? 'input-err' : ''}`} value={f.name}
              onChange={(e) => set('name', e.target.value)} data-testid="edit-name" />
            <Err id="name" msg={err.name} />
          </div>
          {isPusat ? (
            <div className="grid gap-1">
              <Label className={LBL}>Peran</Label>
              <select className="h-9 rounded-md border bg-background px-2.5 text-[13px]" value={f.role}
                onChange={(e) => set('role', e.target.value)} data-testid="edit-role">
                {['member', 'stokis', 'admin_provinsi', 'admin_pusat'].map((r) => (
                  <option key={r} value={r}>{ROLE_NAME[r]}</option>
                ))}
              </select>
            </div>
          ) : <div />}
          <div className="grid gap-1">
            <Label className={LBL}>No. HP</Label>
            <Input className="h-9 text-[13px]" value={f.phone}
              onChange={(e) => set('phone', e.target.value)} data-testid="edit-phone" />
          </div>
          <div className="grid gap-1">
            <Label className={LBL}>Email</Label>
            <Input className="h-9 text-[13px]" value={f.email}
              onChange={(e) => set('email', e.target.value)} data-testid="edit-email" />
          </div>
          {cfg.region ? (
            <RegionSelect
              province={f.province} city={f.city} required showCity={cfg.city}
              errProvince={err.province} errCity={err.city}
              onChange={({ province, city }) => {
                setF((p) => ({ ...p, province, city }));
                setErr((p) => ({ ...p, province: '', city: '' }));
              }}
              testid="edit-region"
            />
          ) : null}
          <div className="grid gap-1 md:col-span-2">
            <Label className={LBL}>Alamat</Label>
            <Input className="h-9 text-[13px]" value={f.address}
              onChange={(e) => set('address', e.target.value)} data-testid="edit-address" />
          </div>
          {cfg.bank ? (
            <>
              <div className="grid gap-1">
                <Label className={LBL}>Nama bank</Label>
                <Input className="h-9 text-[13px]" value={f.bank_name}
                  onChange={(e) => set('bank_name', e.target.value)} data-testid="edit-bank-name" />
              </div>
              <div className="grid gap-1">
                <Label className={LBL}>No. rekening</Label>
                <Input className="h-9 font-mono text-[13px]" value={f.bank_account}
                  onChange={(e) => set('bank_account', e.target.value)} data-testid="edit-bank-account" />
              </div>
            </>
          ) : null}
          {cfg.network ? (
            <>
              {isPusat ? (
                <>
                  <div className="grid gap-1">
                    <Label className={LBL}>Sponsor</Label>
                    <MemberPicker value={f.sponsor_id} role="member"
                      onChange={(v) => set('sponsor_id', v)} testid="edit-sponsor" />
                  </div>
                  <div className="grid gap-1">
                    <Label className={LBL}>Placement (maks 2 kaki)</Label>
                    <MemberPicker value={f.placement_id} role="member"
                      onChange={(v) => set('placement_id', v)} testid="edit-placement" />
                    <PlacementHint sponsorId={f.sponsor_id} placementId={f.placement_id}
                      exclude={target?.member_id} />
                  </div>
                </>
              ) : null}
              {user?.role !== 'stokis' ? (
                <div className="grid gap-1 md:col-span-2">
                  <Label className={LBL}>Stokis pengelola</Label>
                  <MemberPicker value={f.stokis_id} role="stokis"
                    onChange={(v) => set('stokis_id', v)} testid="edit-stokis" />
                </div>
              ) : null}
            </>
          ) : (
            <p className="md:col-span-2 rounded-md border border-[hsl(var(--info)/0.3)] bg-[hsl(var(--info)/0.08)] px-2.5 py-1.5 text-[11px] text-[hsl(var(--info-soft-foreground))]">
              {ROLE_HINT[f.role]}
            </p>
          )}
          <DialogFooter className="pt-2 md:col-span-2">
            <Button type="button" size="sm" variant="outline" onClick={onClose} data-testid="edit-cancel">Batal</Button>
            <Button type="submit" size="sm" disabled={saving} data-testid="edit-submit">
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null} Simpan Perubahan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================ UBAH MEMBERSHIP & PERINGKAT */
export function GradeDialog({ target, onClose, onSaved }) {
  const [opt, setOpt] = useState({ memberships: [], ranks: [] });
  const [auto, setAuto] = useState(true);
  const [membership, setMembership] = useState('');
  const [rank, setRank] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    api.get('/grades').then(({ data }) => setOpt(data)).catch(() => {});
    const hasOverride = !!(target.override_membership || target.override_rank);
    setAuto(!hasOverride);
    setMembership(target.override_membership || target.stat_membership || 'None');
    setRank(target.override_rank || target.stat_rank || 'Member');
  }, [target]);

  if (!target) return null;

  const save = async () => {
    setSaving(true);
    try {
      const body = auto ? { clear: true } : { membership, rank };
      const { data } = await api.post(`/members/${target.member_id}/grade`, body);
      toast.success(data.message);
      onSaved && onSaved();
      onClose();
    } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[620px] bg-card p-4 md:p-5">
        <DialogHeader className="pb-1">
          <DialogTitle className="font-display text-base">
            Ubah Membership &amp; Peringkat
            <span className="ml-2 font-mono text-xs text-muted-foreground">{target.member_id}</span>
          </DialogTitle>
          <div className="accent-bar" />
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="card-c p-3 text-[13px]">
            <p className="font-medium">{target.name}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {target.province || '-'}{target.city ? ` \u00b7 ${target.city}` : ''}
            </p>
            <dl className="mt-2 grid gap-1 text-[12px]">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Perhitungan sistem</dt>
                <dd className="flex gap-1">
                  <MembershipBadge membership={target.stat_membership} />
                  <RankBadge rank={target.stat_rank} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">APPV terkumpul</dt>
                <dd className="font-mono">{num(target.stat_appv)} PV</dd>
              </div>
            </dl>
          </div>

          <div className="grid content-start gap-2.5">
            <label className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-2 text-[13px]">
              <input type="checkbox" className="h-4 w-4 accent-[#0F766E]" checked={auto}
                onChange={(e) => setAuto(e.target.checked)} data-testid="grade-auto-switch" />
              Ikuti perhitungan otomatis sistem
            </label>
            <div className="grid gap-1">
              <Label className={LBL}>Membership</Label>
              <select className="h-9 rounded-md border bg-background px-2.5 text-[13px]" disabled={auto}
                value={membership} onChange={(e) => setMembership(e.target.value)} data-testid="grade-membership">
                {(opt.memberships || []).map((m) => <option key={m} value={m}>{m === 'None' ? 'Belum Membership' : m}</option>)}
              </select>
            </div>
            <div className="grid gap-1">
              <Label className={LBL}>Peringkat</Label>
              <select className="h-9 rounded-md border bg-background px-2.5 text-[13px]" disabled={auto}
                value={rank} onChange={(e) => setRank(e.target.value)} data-testid="grade-rank">
                {(opt.ranks || []).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <p className={`flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] leading-snug ${
              auto
                ? 'border-[hsl(var(--info)/0.3)] bg-[hsl(var(--info)/0.08)] text-[hsl(var(--info-soft-foreground))]'
                : 'border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning-soft-foreground))]'
            }`} data-testid="grade-note">
              <Info className="mt-[1px] h-3.5 w-3.5 shrink-0" />
              {auto
                ? 'Membership & peringkat mengikuti akumulasi PV dan aturan marketing plan.'
                : 'Penetapan manual tidak menambah PV sama sekali, tetapi mempengaruhi rate bonus, tampilan, dan laporan.'}
            </p>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button size="sm" variant="outline" onClick={onClose} data-testid="grade-cancel">Batal</Button>
          <Button size="sm" onClick={save} disabled={saving} data-testid="grade-submit">
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null} Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================ HALAMAN MEMBER */
export default function Members() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('member');
  const [province, setProvince] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [gradeTarget, setGradeTarget] = useState(null);
  const [accessTargets, setAccessTargets] = useState(null);
  const [pwTarget, setPwTarget] = useState(null);
  const [pw, setPw] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);

  const isPusat = user?.role === 'admin_pusat';
  const canTupo = isPusat || user?.role === 'admin_provinsi';
  const canStatus = user?.role !== 'member';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/members', {
        params: {
          q: q || undefined, status: status || undefined,
          role: role || undefined, province: province || undefined,
        },
      });
      setRows(data);
      setSelected((prev) => new Set([...prev].filter((id) => data.some((d) => d.member_id === id))));
    } catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
  }, [q, status, role, province]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const selectable = useMemo(() => rows.filter((m) => m.member_id !== user?.member_id), [rows, user]);
  const allChecked = selectable.length > 0 && selectable.every((m) => selected.has(m.member_id));
  const someChecked = selectable.some((m) => selected.has(m.member_id));

  const toggleAll = (on) => setSelected(on ? new Set(selectable.map((m) => m.member_id)) : new Set());
  const toggleOne = (id, on) => setSelected((prev) => {
    const next = new Set(prev);
    if (on) next.add(id); else next.delete(id);
    return next;
  });
  const ids = [...selected];

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
    if (!window.confirm(`Hapus ${ids.length} pengguna terpilih? Tindakan ini tidak bisa dibatalkan.`)) return;
    setBusy(true);
    try { const { data } = await api.post('/members/bulk/delete', { member_ids: ids }); reportResult(data); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const bulkTupo = async (clear) => {
    setBusy(true);
    try {
      const { data } = await api.post('/tupo', { member_ids: ids, ok: true, clear, note: 'Ditandai dari halaman Member' });
      reportResult(data);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const toggleStatus = async (m) => {
    try {
      await api.post(`/members/${m.member_id}/status`, { active: !m.active });
      toast.success(`${m.member_id} ${!m.active ? 'diaktifkan' : 'dinonaktifkan'}`);
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const remove = async (m) => {
    if (!window.confirm(`Hapus ${m.member_id} - ${m.name}? Tindakan ini tidak bisa dibatalkan.`)) return;
    try { await api.delete(`/members/${m.member_id}`); toast.success('Member dihapus'); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const toggleTupoOne = async (m) => {
    try {
      const { data } = await api.post('/tupo', { member_ids: [m.member_id], ok: true, clear: !!m.stat_tupo_manual });
      toast.success(data.message);
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const savePw = async () => {
    try {
      await api.post(`/members/${pwTarget.member_id}/password`, { password: pw });
      toast.success('Sandi diperbarui');
      setPwTarget(null); setPw('');
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <AppShell
      title="Manajemen Member"
      subtitle="Centang beberapa baris untuk aktifkan, nonaktifkan, hapus, atau tandai Tupo sekaligus"
      actions={<Button size="sm" onClick={() => setOpen(true)} data-testid="add-member-button"><Plus className="mr-1 h-3.5 w-3.5" /> Tambah</Button>}
    >
      <div className="grid gap-3">
        <div className="card-c flex flex-wrap items-center gap-2 p-2.5">
          <div className="relative min-w-[190px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="h-9 pl-8 text-[13px]" placeholder="Cari ID, nama, atau no. HP"
              value={q} onChange={(e) => setQ(e.target.value)} data-testid="member-search" />
          </div>
          <select className="h-9 rounded-md border bg-background px-2.5 text-[13px]" value={role}
            onChange={(e) => setRole(e.target.value)} data-testid="filter-role">
            <option value="">Semua peran</option>
            <option value="member">Member</option>
            <option value="stokis">Stokis</option>
            <option value="admin_provinsi">Admin Provinsi</option>
            <option value="admin_pusat">Admin Pusat</option>
          </select>
          <ProvinceFilter value={province} onChange={setProvince} testid="filter-province" />
          <select className="h-9 rounded-md border bg-background px-2.5 text-[13px]" value={status}
            onChange={(e) => setStatus(e.target.value)} data-testid="filter-status">
            <option value="">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
          <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
            {rows.length} baris
          </span>
        </div>

        <BulkBar
          count={selected.size} busy={busy}
          onClear={() => setSelected(new Set())}
          onActivate={canStatus ? () => bulkStatus(true) : null}
          onDeactivate={canStatus ? () => bulkStatus(false) : null}
          onDelete={isPusat ? bulkDelete : null}
          onTupo={canTupo ? () => bulkTupo(false) : null}
          onTupoClear={canTupo ? () => bulkTupo(true) : null}
          onAccess={isPusat ? () => setAccessTargets(rows.filter((r) => selected.has(r.member_id))) : null}
          testid="member-bulk-bar"
        />

        <div className="card-c overflow-hidden">
          <div className="table-wrap max-h-[68vh] overflow-y-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="px-2.5 text-left">
                    <Checkbox checked={allChecked} indeterminate={someChecked} onChange={toggleAll} testid="member-select-all" title="Pilih semua" />
                  </th>
                  <th className="px-2 text-left">ID</th>
                  <th className="px-2 text-left">Nama</th>
                  <th className="px-2 text-left">Peran</th>
                  <th className="px-2 text-left">Peringkat</th>
                  <th className="px-2 text-left">Membership</th>
                  <th className="px-2 text-left">Tupo</th>
                  <th className="px-2 text-left">Sponsor / Placement</th>
                  <th className="px-2 text-right">APPV</th>
                  <th className="px-2 text-left">Status</th>
                  <th className="px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} className="p-6 text-center text-[13px] text-muted-foreground">Memuat...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={11} className="p-6 text-center text-[13px] text-muted-foreground">Belum ada data</td></tr>
                ) : rows.map((m) => {
                  const isMember = m.role === 'member';
                  return (
                    <tr key={m.member_id} className={selected.has(m.member_id) ? 'is-selected' : ''}
                      data-testid={`member-row-${m.member_id}`}>
                      <td className="px-2.5">
                        {m.member_id === user?.member_id ? (
                          <span className="text-[10px] text-muted-foreground">Anda</span>
                        ) : (
                          <Checkbox checked={selected.has(m.member_id)} onChange={(on) => toggleOne(m.member_id, on)} testid={`member-check-${m.member_id}`} />
                        )}
                      </td>
                      <td className="px-2">
                        <Link to={`/members/${m.member_id}`} className="font-mono text-[11px] font-semibold text-primary hover:underline" data-testid={`member-link-${m.member_id}`}>{m.member_id}</Link>
                      </td>
                      <td className="px-2">
                        <p className="font-medium">{m.name}</p>
                        <p className="text-[10.5px] text-muted-foreground">
                          {m.province || '-'}{m.city ? ` · ${m.city}` : ''}{` · gabung ${tanggal(m.join_date)}`}
                        </p>
                        {isPusat && ((m.bonus_disabled || []).length || (m.blocked_pages || []).length) ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(m.bonus_disabled || []).length ? (
                              <BonusOffBadge count={m.bonus_disabled.length}
                                titleText={`Bonus dinonaktifkan: ${m.bonus_disabled.join(', ')}`} />
                            ) : null}
                            {(m.blocked_pages || []).length ? (
                              <PageLockBadge count={m.blocked_pages.length}
                                titleText={`Halaman ditutup: ${m.blocked_pages.join(', ')}`} />
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-2"><RoleBadge role={m.role} /></td>
                      <td className="px-2">
                        {isMember ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <RankBadge rank={m.stat_rank} />
                            {m.override_rank ? <OverrideBadge /> : null}
                          </div>
                        ) : <span className="text-[11px] text-muted-foreground">&mdash;</span>}
                      </td>
                      <td className="px-2">
                        {isMember ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <MembershipBadge membership={m.stat_membership} />
                            {m.override_membership ? <OverrideBadge /> : null}
                          </div>
                        ) : <span className="text-[11px] text-muted-foreground">&mdash;</span>}
                      </td>
                      <td className="px-2">
                        {isMember ? (
                          <button type="button" disabled={!canTupo} onClick={() => toggleTupoOne(m)}
                            title={canTupo ? 'Klik untuk tandai / batalkan Tupo manual' : ''}
                            data-testid={`member-tupo-${m.member_id}`}
                            className={canTupo ? 'cursor-pointer' : 'cursor-default'}>
                            <TupoFlame ok={m.stat_tupo_ok} manual={m.stat_tupo_manual} />
                          </button>
                        ) : <span className="text-[11px] text-muted-foreground">&mdash;</span>}
                      </td>
                      <td className="px-2 font-mono text-[10.5px] text-muted-foreground">
                        {isMember ? (
                          <>
                            S: {m.sponsor_id || '-'}<br />P: {m.placement_id || '-'}
                            {m.stokis_id ? <><br />Stokis: {m.stokis_id}</> : null}
                          </>
                        ) : <span>Di luar jaringan</span>}
                      </td>
                      <td className="px-2 text-right font-mono text-[11px]">{isMember ? num(m.stat_appv) : '\u2014'}</td>
                      <td className="px-2"><StatusBadge active={m.active} /></td>
                      <td className="px-3">
                        <div className="flex justify-end gap-1">
                          {isPusat && isMember ? (
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setGradeTarget(m)}
                              data-testid={`grade-member-${m.member_id}`} title="Ubah membership & peringkat">
                              <Award className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                          {isPusat && m.member_id !== user?.member_id ? (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[hsl(var(--danger))]"
                              onClick={() => setAccessTargets([m])}
                              data-testid={`access-member-${m.member_id}`} title="Nonaktifkan bonus & tutup halaman">
                              <ShieldOff className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setEditTarget(m)} data-testid={`edit-member-${m.member_id}`} title="Ubah data">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setPwTarget(m)} data-testid={`reset-password-${m.member_id}`} title="Ganti sandi">
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                          {canStatus && m.member_id !== user?.member_id ? (
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => toggleStatus(m)} data-testid={`toggle-status-${m.member_id}`} title={m.active ? 'Nonaktifkan' : 'Aktifkan'}>
                              {m.active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                            </Button>
                          ) : null}
                          {isPusat && m.member_id !== user?.member_id ? (
                            <Button size="sm" variant="outline" className="h-7 px-2 text-destructive" onClick={() => remove(m)} data-testid={`delete-member-${m.member_id}`} title="Hapus">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
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

        {canTupo ? (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Flame className="h-3.5 w-3.5 text-[hsl(var(--bonus-5))]" />
            Ikon api menyala = Tupo terpenuhi. Huruf <b>M</b> berarti ditandai manual oleh admin untuk periode berjalan
            (tidak menambah omset sama sekali).
          </p>
        ) : null}
      </div>

      <MemberForm open={open} onClose={() => setOpen(false)} onSaved={load} />
      <MemberEditDialog target={editTarget} onClose={() => setEditTarget(null)} onSaved={load} />
      <GradeDialog target={gradeTarget} onClose={() => setGradeTarget(null)} onSaved={load} />
      <AccessDialog targets={accessTargets} onClose={() => setAccessTargets(null)}
        onSaved={() => { setSelected(new Set()); load(); }} />

      <Dialog open={!!pwTarget} onOpenChange={(o) => !o && setPwTarget(null)}>
        <DialogContent className="max-w-md bg-card p-4">
          <DialogHeader className="pb-1"><DialogTitle className="font-display text-base">Ganti Sandi {pwTarget?.member_id}</DialogTitle></DialogHeader>
          <div className="grid gap-1">
            <Label className={LBL}>Sandi baru (min. 6 karakter)</Label>
            <Input className="h-9 text-[13px]" value={pw} onChange={(e) => setPw(e.target.value)} data-testid="new-password-input" />
          </div>
          <DialogFooter className="pt-2">
            <Button size="sm" variant="outline" onClick={() => setPwTarget(null)}>Batal</Button>
            <Button size="sm" onClick={savePw} data-testid="save-password-button">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
