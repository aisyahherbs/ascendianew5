import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EyeOff, Info, Loader2, Lock, ShieldOff } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { api, errMsg } from '../lib/api';

const LBL = 'text-[10px] font-semibold uppercase tracking-wide text-muted-foreground';

/**
 * Dialog Admin Pusat: nonaktifkan jenis bonus & tutup halaman untuk
 * satu pengguna atau banyak pengguna sekaligus (massal).
 *
 * Bersifat SENYAP: pengguna yang dibatasi tidak diberi tahu dan tidak bisa
 * melihat konfigurasi ini dari akunnya.
 */
export default function AccessDialog({ targets, onClose, onSaved }) {
  const list = targets || [];
  const single = list.length === 1 ? list[0] : null;
  const [opt, setOpt] = useState(null);
  const [bonusOff, setBonusOff] = useState([]);
  const [pagesOff, setPagesOff] = useState([]);
  const [applyBonus, setApplyBonus] = useState(true);
  const [applyPages, setApplyPages] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const roles = useMemo(() => [...new Set(list.map((t) => t.role || 'member'))], [list]);
  const allMembers = roles.length === 1 && roles[0] === 'member';

  useEffect(() => {
    if (!list.length) return;
    let alive = true;
    setLoading(true);
    const jobs = [api.get('/access/options')];
    if (list.length === 1) jobs.push(api.get(`/access/member/${list[0].member_id}`));
    Promise.all(jobs)
      .then(([o, m]) => {
        if (!alive) return;
        setOpt(o.data);
        setBonusOff(m ? m.data.bonus_disabled || [] : []);
        setPagesOff(m ? m.data.blocked_pages || [] : []);
        setApplyBonus(m ? (m.data.role || 'member') === 'member' : allMembers);
        setApplyPages(true);
      })
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets]);

  if (!list.length) return null;

  const globalBonus = opt?.bonus_disabled_global || [];
  const globalPages = opt?.pages_blocked_global || {};
  const pageList = (opt?.pages || []).filter((p) => roles.every((r) => p.roles.includes(r)));

  const toggle = (arr, setArr, key) =>
    setArr(arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key]);

  const save = async () => {
    if (!applyBonus && !applyPages) {
      toast.error('Pilih minimal satu bagian yang ingin diterapkan');
      return;
    }
    setSaving(true);
    try {
      const body = { member_ids: list.map((t) => t.member_id) };
      if (applyBonus && allMembers) body.bonus_disabled = bonusOff;
      if (applyPages) body.blocked_pages = pagesOff;
      if (!body.bonus_disabled && !body.blocked_pages) {
        toast.error('Tidak ada perubahan untuk disimpan');
        setSaving(false);
        return;
      }
      const { data } = await api.post('/members/bulk/access', body);
      toast.success(data.message);
      (data.failed || []).forEach((f) => toast.error(`${f.member_id}: ${f.reason}`));
      onSaved && onSaved();
      onClose();
    } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
  };

  const globalPageNote = (key) => {
    const rs = roles.filter((r) => (globalPages[r] || []).includes(key));
    return rs.length === roles.length && roles.length > 0;
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-[760px] overflow-y-auto bg-card p-4 md:p-5" data-testid="access-dialog">
        <DialogHeader className="pb-1">
          <DialogTitle className="flex items-center gap-2 font-display text-base">
            <ShieldOff className="h-4 w-4 text-[hsl(var(--danger))]" />
            Nonaktifkan Bonus &amp; Tutup Halaman
            {single ? <span className="font-mono text-xs text-muted-foreground">{single.member_id}</span> : null}
          </DialogTitle>
          <div className="accent-bar" />
        </DialogHeader>

        {loading || !opt ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">Memuat...</p>
        ) : (
          <div className="grid gap-3">
            <div className="card-c p-3 text-[12px]" data-testid="access-target-info">
              {single ? (
                <>
                  <p className="font-medium">{single.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {single.member_id} · {single.role === 'member' ? 'Member' : single.role}
                  </p>
                </>
              ) : (
                <p className="font-medium">{list.length} pengguna dipilih — pengaturan akan menimpa pengaturan lama masing-masing</p>
              )}
              <p className="mt-1.5 flex items-start gap-1.5 rounded-md border border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.1)] px-2 py-1.5 text-[11px] leading-snug text-[hsl(var(--warning-soft-foreground))]">
                <EyeOff className="mt-[1px] h-3.5 w-3.5 shrink-0" />
                Senyap: bonus yang dinonaktifkan benar-benar tidak dihitung (0 BV, tanpa baris rincian)
                dan pengguna tidak diberi tahu maupun bisa melihat pengaturan ini.
              </p>
            </div>

            {/* ---------------------------------------------- BONUS */}
            <div className="card-c p-3">
              <label className="flex items-center gap-2 text-[13px] font-semibold">
                <input type="checkbox" className="h-4 w-4 accent-[#0F766E]" checked={applyBonus && allMembers}
                  disabled={!allMembers}
                  onChange={(e) => setApplyBonus(e.target.checked)} data-testid="access-apply-bonus" />
                Terapkan penonaktifan jenis bonus
              </label>
              {!allMembers ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Hanya berlaku untuk peran Member. Admin &amp; Stokis tidak menerima bonus jaringan.
                </p>
              ) : (
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {(opt.bonus_types || []).map((b) => {
                    const isGlobal = globalBonus.includes(b.key);
                    const checked = bonusOff.includes(b.key) || isGlobal;
                    return (
                      <label key={b.key}
                        className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-[12.5px] ${
                          checked ? 'border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.07)]' : 'bg-muted/30'
                        } ${applyBonus ? '' : 'opacity-50'}`}>
                        <span className="flex items-center gap-2">
                          <input type="checkbox" className="h-4 w-4 accent-[#DC2626]"
                            disabled={!applyBonus || isGlobal}
                            checked={checked}
                            onChange={() => toggle(bonusOff, setBonusOff, b.key)}
                            data-testid={`access-bonus-${b.key}`} />
                          {b.label}
                        </span>
                        {isGlobal ? (
                          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-[hsl(var(--danger))]">
                            <Lock className="h-3 w-3" /> Global
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ---------------------------------------------- HALAMAN */}
            <div className="card-c p-3">
              <label className="flex items-center gap-2 text-[13px] font-semibold">
                <input type="checkbox" className="h-4 w-4 accent-[#0F766E]" checked={applyPages}
                  onChange={(e) => setApplyPages(e.target.checked)} data-testid="access-apply-pages" />
                Terapkan penutupan halaman
              </label>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Halaman yang ditutup hilang dari menu dan datanya ditolak server.
                Dashboard tidak bisa ditutup agar pengguna tidak terjebak tanpa halaman.
              </p>
              <div className={`mt-2 grid gap-1.5 sm:grid-cols-2 ${applyPages ? '' : 'opacity-50'}`}>
                {pageList.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground">
                    Tidak ada halaman yang berlaku untuk kombinasi peran terpilih.
                  </p>
                ) : pageList.map((p) => {
                  const isGlobal = globalPageNote(p.key);
                  const checked = pagesOff.includes(p.key) || isGlobal;
                  return (
                    <label key={p.key}
                      className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-[12.5px] ${
                        checked ? 'border-[hsl(var(--danger)/0.4)] bg-[hsl(var(--danger)/0.07)]' : 'bg-muted/30'
                      }`}>
                      <span className="flex items-center gap-2">
                        <input type="checkbox" className="h-4 w-4 accent-[#DC2626]"
                          disabled={!applyPages || isGlobal}
                          checked={checked}
                          onChange={() => toggle(pagesOff, setPagesOff, p.key)}
                          data-testid={`access-page-${p.key}`} />
                        {p.label}
                      </span>
                      {isGlobal ? (
                        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase text-[hsl(var(--danger))]">
                          <Lock className="h-3 w-3" /> Global
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                <Info className="mt-[1px] h-3.5 w-3.5 shrink-0" />
                Bertanda <b className="mx-1">Global</b> berarti sudah ditutup untuk seluruh peran tersebut
                dari halaman Pengaturan, jadi tidak bisa dibuka per pengguna.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button size="sm" variant="outline" onClick={onClose} data-testid="access-cancel">Batal</Button>
          <Button size="sm" onClick={save} disabled={saving || loading} data-testid="access-submit">
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null} Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { LBL };
