import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertCircle, Loader2, Megaphone, Pencil, Pin, Plus, Trash2,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { CATEGORY_META, CategoryBadge } from '../components/Badges';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ROLE_LABEL, tanggal } from '../lib/format';

const CATS = ['pengumuman', 'promo', 'reward', 'penting', 'berita'];
const ROLES = ['admin_pusat', 'admin_provinsi', 'stokis', 'member'];
const LBL = 'text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground';

const blank = {
  title: '', body: '', category: 'pengumuman', pinned: false, published: true,
  image: '', target_roles: [],
};

function Editor({ open, target, onClose, onSaved }) {
  const [f, setF] = useState(blank);
  const [err, setErr] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr({});
    setF(target ? {
      title: target.title || '', body: target.body || '', category: target.category || 'pengumuman',
      pinned: !!target.pinned, published: target.published !== false,
      image: target.image || '', target_roles: target.target_roles || [],
    } : blank);
  }, [open, target]);

  const set = (k, v) => {
    setF((p) => ({ ...p, [k]: v }));
    setErr((p) => (p[k] ? { ...p, [k]: '' } : p));
  };

  const toggleRole = (r) => setF((p) => ({
    ...p,
    target_roles: p.target_roles.includes(r)
      ? p.target_roles.filter((x) => x !== r)
      : [...p.target_roles, r],
  }));

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (f.title.trim().length < 3) er.title = 'Judul minimal 3 karakter';
    if (!f.body.trim()) er.body = 'Isi pengumuman wajib diisi';
    setErr(er);
    if (Object.keys(er).length) { toast.error('Lengkapi kolom wajib terlebih dahulu'); return; }
    setSaving(true);
    try {
      if (target) await api.put(`/announcements/${target.id}`, f);
      else await api.post('/announcements', f);
      toast.success(target ? 'Pengumuman diperbarui' : 'Pengumuman diterbitkan');
      onSaved();
      onClose();
    } catch (e2) { toast.error(errMsg(e2)); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-[680px] overflow-y-auto bg-card p-4 md:p-5">
        <DialogHeader className="pb-1">
          <DialogTitle className="font-display text-base">
            {target ? 'Ubah Pengumuman' : 'Buat Pengumuman Baru'}
          </DialogTitle>
          <div className="accent-bar" />
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-2.5">
          <div className="grid gap-2.5 md:grid-cols-[1fr_180px]">
            <div className="grid gap-1">
              <Label className={LBL}>Judul <span className="text-[hsl(var(--danger))]">*</span></Label>
              <Input className={`h-9 text-[13px] ${err.title ? 'input-err' : ''}`} value={f.title}
                onChange={(e) => set('title', e.target.value)} data-testid="ann-title" />
              {err.title ? <p className="field-err" data-testid="ann-error-title"><AlertCircle className="h-3 w-3" /> {err.title}</p> : null}
            </div>
            <div className="grid gap-1">
              <Label className={LBL}>Kategori</Label>
              <select className="h-9 rounded-md border bg-background px-2.5 text-[13px]" value={f.category}
                onChange={(e) => set('category', e.target.value)} data-testid="ann-category">
                {CATS.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid gap-1">
            <Label className={LBL}>Isi pengumuman <span className="text-[hsl(var(--danger))]">*</span></Label>
            <Textarea className={`min-h-[120px] text-[13px] ${err.body ? 'input-err' : ''}`} value={f.body}
              onChange={(e) => set('body', e.target.value)} data-testid="ann-body" />
            {err.body ? <p className="field-err" data-testid="ann-error-body"><AlertCircle className="h-3 w-3" /> {err.body}</p> : null}
          </div>

          <div className="grid gap-1">
            <Label className={LBL}>URL gambar (opsional)</Label>
            <Input className="h-9 text-[13px]" placeholder="https://..." value={f.image}
              onChange={(e) => set('image', e.target.value)} data-testid="ann-image" />
          </div>

          <div className="grid gap-1">
            <Label className={LBL}>Ditujukan untuk (kosong = semua peran)</Label>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map((r) => (
                <button type="button" key={r} onClick={() => toggleRole(r)} data-testid={`ann-role-${r}`}
                  className={`rounded-md border px-2 py-1 text-[11px] font-medium ${
                    f.target_roles.includes(r)
                      ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}>
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <label className="flex items-center gap-1.5 text-[12px]">
              <input type="checkbox" className="h-4 w-4 accent-[#0F766E]" checked={f.pinned}
                onChange={(e) => set('pinned', e.target.checked)} data-testid="ann-pinned" /> Sematkan di atas
            </label>
            <label className="flex items-center gap-1.5 text-[12px]">
              <input type="checkbox" className="h-4 w-4 accent-[#0F766E]" checked={f.published}
                onChange={(e) => set('published', e.target.checked)} data-testid="ann-published" /> Terbitkan (terlihat semua pengguna)
            </label>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" size="sm" variant="outline" onClick={onClose} data-testid="ann-cancel">Batal</Button>
            <Button type="submit" size="sm" disabled={saving} data-testid="ann-submit">
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null} Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Announcements() {
  const { user } = useAuth();
  const isPusat = user?.role === 'admin_pusat';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('');
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/announcements', { params: cat ? { category: cat } : {} });
      setRows(data);
    } catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
  }, [cat]);

  useEffect(() => { load(); }, [load]);

  const pinned = useMemo(() => rows.filter((r) => r.pinned), [rows]);

  const remove = async (a) => {
    if (!window.confirm(`Hapus pengumuman "${a.title}"?`)) return;
    try { await api.delete(`/announcements/${a.id}`); toast.success('Pengumuman dihapus'); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  const Card = ({ a }) => {
    const meta = CATEGORY_META[a.category] || CATEGORY_META.pengumuman;
    return (
      <article className="card-c overflow-hidden" data-testid={`announcement-card-${a.id}`}>
        <div className="flex items-start gap-2 border-b bg-muted/40 px-3 py-2"
          style={{ borderLeft: `3px solid ${meta.dot}` }}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <CategoryBadge category={a.category} />
              {a.pinned ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.12)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[hsl(var(--primary))]">
                  <Pin className="h-3 w-3" /> Disematkan
                </span>
              ) : null}
              {a.published === false ? (
                <span className="rounded-md border bg-muted px-1.5 py-0.5 text-[10.5px] font-semibold text-muted-foreground">Draf</span>
              ) : null}
              {(a.target_roles || []).length ? (
                <span className="rounded-md border bg-background px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
                  untuk {a.target_roles.map((r) => ROLE_LABEL[r]).join(', ')}
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 font-display text-[15px] font-semibold leading-snug">{a.title}</h3>
            <p className="text-[11px] text-muted-foreground">
              {tanggal(a.created_at)}{a.author_name ? ` · oleh ${a.author_name}` : ''}
            </p>
          </div>
          {isPusat ? (
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setTarget(a); setOpen(true); }} data-testid={`announcement-edit-${a.id}`}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-destructive" onClick={() => remove(a)} data-testid={`announcement-delete-${a.id}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
        </div>
        {a.image ? (
          <img src={a.image} alt={a.title} className="max-h-[200px] w-full object-cover"
            onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        ) : null}
        <p className="whitespace-pre-wrap px-3 py-2.5 text-[13px] leading-relaxed">{a.body}</p>
      </article>
    );
  };

  return (
    <AppShell
      title="Pengumuman & Berita"
      subtitle="Informasi reward, promosi, dan pengumuman penting dari pusat"
      actions={isPusat ? (
        <Button size="sm" onClick={() => { setTarget(null); setOpen(true); }} data-testid="announcements-create-button">
          <Plus className="mr-1 h-3.5 w-3.5" /> Buat
        </Button>
      ) : null}
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
        <div className="grid gap-3">
          <div className="card-c flex flex-wrap items-center gap-1.5 p-2">
            <button onClick={() => setCat('')} data-testid="ann-filter-all"
              className={`rounded-md border px-2 py-1 text-[11px] font-medium ${!cat ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
              Semua
            </button>
            {CATS.map((c) => (
              <button key={c} onClick={() => setCat(c)} data-testid={`ann-filter-${c}`}
                className={`rounded-md border px-2 py-1 text-[11px] font-medium ${cat === c ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                {CATEGORY_META[c].label}
              </button>
            ))}
            <span className="ml-auto rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">{rows.length} item</span>
          </div>

          {loading ? (
            <p className="card-c p-6 text-center text-[13px] text-muted-foreground">Memuat pengumuman...</p>
          ) : rows.length === 0 ? (
            <div className="card-c grid place-items-center gap-2 p-8 text-center" data-testid="announcements-empty">
              <Megaphone className="h-8 w-8 text-muted-foreground/60" />
              <p className="text-[13px] text-muted-foreground">Belum ada pengumuman.</p>
              {isPusat ? (
                <Button size="sm" onClick={() => { setTarget(null); setOpen(true); }} data-testid="announcements-empty-create">
                  <Plus className="mr-1 h-3.5 w-3.5" /> Buat Pengumuman
                </Button>
              ) : null}
            </div>
          ) : rows.map((a) => <Card key={a.id} a={a} />)}
        </div>

        <aside className="grid content-start gap-3">
          <div className="card-c overflow-hidden">
            <div className="card-head"><h3 className="card-title">Disematkan</h3></div>
            <div className="grid gap-1.5 p-2.5">
              {pinned.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">Belum ada pengumuman yang disematkan.</p>
              ) : pinned.map((a) => (
                <div key={a.id} className="rounded-md border bg-background px-2 py-1.5" data-testid={`announcement-pinned-${a.id}`}>
                  <CategoryBadge category={a.category} />
                  <p className="mt-1 text-[12px] font-medium leading-snug">{a.title}</p>
                  <p className="text-[10.5px] text-muted-foreground">{tanggal(a.created_at)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card-c overflow-hidden">
            <div className="card-head"><h3 className="card-title">Kategori</h3></div>
            <div className="grid gap-1 p-2.5">
              {CATS.map((c) => (
                <div key={c} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_META[c].dot }} />
                    {CATEGORY_META[c].label}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {rows.filter((r) => r.category === c).length}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <Editor open={open} target={target} onClose={() => { setOpen(false); setTarget(null); }} onSaved={load} />
    </AppShell>
  );
}
