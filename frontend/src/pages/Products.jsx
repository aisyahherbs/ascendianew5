import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Boxes, ImagePlus, LayoutGrid, List, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import AppShell from '../components/AppShell';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fileToCompressedDataUrl, PLACEHOLDER } from '../lib/image';
import { num, rp } from '../lib/format';

const EMPTY = {
  name: '', code: '', price: '', pv: '', kind: 'penjualan', description: '', active: true,
  image: '', category: '', unit: 'pcs', min_stock: 0,
};

export default function Products() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin_pusat' || user?.role === 'admin_provinsi';
  const [rows, setRows] = useState([]);
  const [stock, setStock] = useState({});
  const [owners, setOwners] = useState([]);
  const [owner, setOwner] = useState('');
  const [view, setView] = useState('grid');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const loadProducts = async () => {
    try { const { data } = await api.get('/products'); setRows(data); }
    catch (e) { toast.error(errMsg(e)); }
  };

  const loadStock = async (o) => {
    if (!o) return;
    try {
      const { data } = await api.get('/stock', { params: { owner_id: o } });
      setStock(Object.fromEntries(data.rows.map((r) => [r.product_id, r])));
    } catch (e) { setStock({}); }
  };

  useEffect(() => {
    loadProducts();
    api.get('/stock/owners').then(({ data }) => {
      setOwners(data);
      if (data.length) setOwner(data[0].owner_id);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadStock(owner); }, [owner]);

  const categories = useMemo(() => [...new Set(rows.map((r) => r.category).filter(Boolean))], [rows]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((p) => {
      if (cat && p.category !== cat) return false;
      if (!ql) return true;
      return `${p.name} ${p.code} ${p.category}`.toLowerCase().includes(ql);
    });
  }, [rows, q, cat]);

  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setF((p) => ({ ...p, image: dataUrl }));
      toast.success('Foto siap diunggah');
    } catch (e2) { toast.error(e2.message || 'Gagal memproses gambar'); }
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...f, price: Number(f.price || 0), pv: Number(f.pv || 0),
        min_stock: Number(f.min_stock || 0),
      };
      if (editId) await api.put(`/products/${editId}`, payload);
      else await api.post('/products', payload);
      toast.success(editId ? 'Produk diperbarui' : 'Produk ditambahkan');
      setOpen(false); setF(EMPTY); setEditId(null); loadProducts(); loadStock(owner);
    } catch (e2) { toast.error(errMsg(e2)); } finally { setBusy(false); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Hapus produk ${p.name}?`)) return;
    try { await api.delete(`/products/${p.id}`); toast.success('Produk dihapus'); loadProducts(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  const stockBadge = (p) => {
    const s = stock[p.id];
    if (!s || !s.tracked) return null;
    const low = s.qty <= (p.min_stock || 0);
    return (
      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${low ? 'border-[#F5E0B8] bg-[#FFF6E5] text-[#8A5B00]' : 'border-[#C6EAD8] bg-[#E7F6EE] text-[#1F8A5B]'}`}
        data-testid={`product-stock-${p.id}`}>
        Stok {num(s.qty)} {p.unit || 'pcs'}{low ? ' · rendah' : ''}
      </span>
    );
  };

  return (
    <AppShell title="Katalog Produk" subtitle="Foto produk, harga, PV, dan stok per gudang/stokis"
      actions={
        <div className="flex items-center gap-2">
          <div className="hidden rounded-lg border p-1 sm:flex">
            <button onClick={() => setView('grid')} className={`rounded px-2 py-1.5 ${view === 'grid' ? 'bg-accent' : 'text-muted-foreground'}`} data-testid="product-view-grid"><LayoutGrid className="h-4 w-4" /></button>
            <button onClick={() => setView('table')} className={`rounded px-2 py-1.5 ${view === 'table' ? 'bg-accent' : 'text-muted-foreground'}`} data-testid="product-view-table"><List className="h-4 w-4" /></button>
          </div>
          {canManage ? <Button onClick={() => { setF(EMPTY); setEditId(null); setOpen(true); }} data-testid="add-product-button"><Plus className="mr-1 h-4 w-4" /> Tambah Produk</Button> : null}
        </div>
      }>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input className="h-11 pl-9" placeholder="Cari nama, kode, atau kategori" value={q} onChange={(e) => setQ(e.target.value)} data-testid="product-search" />
          </div>
          <select className="h-11 rounded-md border bg-background px-3 text-sm" value={cat} onChange={(e) => setCat(e.target.value)} data-testid="product-filter-category">
            <option value="">Semua kategori</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {owners.length ? (
            <select className="h-11 rounded-md border bg-background px-3 text-sm" value={owner} onChange={(e) => setOwner(e.target.value)} data-testid="product-stock-owner">
              {owners.map((o) => <option key={o.owner_id} value={o.owner_id}>Stok: {o.name}</option>)}
            </select>
          ) : null}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border bg-card p-10 text-center">
            <Boxes className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Belum ada produk. {canManage ? 'Tambahkan produk beserta fotonya agar stokis mudah menjual.' : ''}
            </p>
          </div>
        ) : view === 'grid' ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <div key={p.id} className="flex flex-col overflow-hidden rounded-xl border bg-card" data-testid={`product-card-${p.id}`}>
                <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                  <img src={p.image || PLACEHOLDER} alt={p.name} className="h-full w-full object-cover" loading="lazy"
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER; }} />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-semibold">{p.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{p.code || '-'}{p.category ? ` · ${p.category}` : ''}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] capitalize ${p.kind === 'perkembangan' ? 'border-[#CFE6E4] bg-[#E9F3F2] text-[#0B5F5A]' : 'border-[#CFE4FF] bg-[#E6F2FF] text-[#1E4E8C]'}`}>{p.kind}</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="font-mono text-base font-semibold">{rp(p.price)}</p>
                      <p className="font-mono text-xs text-muted-foreground">{num(p.pv)} PV</p>
                    </div>
                    <div className="text-right">{stockBadge(p)}</div>
                  </div>
                  {p.description ? <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p> : null}
                  {!p.active ? <span className="w-fit rounded bg-[#FDECEC] px-1.5 py-0.5 text-[10px] text-[#B4322F]">Nonaktif</span> : null}
                  {canManage ? (
                    <div className="mt-auto flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => { setF({ ...EMPTY, ...p }); setEditId(p.id); setOpen(true); }} data-testid={`edit-product-${p.id}`}>
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Ubah
                      </Button>
                      {user?.role === 'admin_pusat' ? (
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => remove(p)} data-testid={`delete-product-${p.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border bg-card">
            <div className="table-wrap">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Produk</th><th className="px-2 py-3 text-left">Kategori</th>
                    <th className="px-2 py-3 text-left">Jenis</th><th className="px-2 py-3 text-right">Harga</th>
                    <th className="px-2 py-3 text-right">PV</th><th className="px-2 py-3 text-right">Stok</th>
                    <th className="px-2 py-3 text-left">Status</th>{canManage ? <th className="px-4 py-3 text-right">Aksi</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/60" data-testid={`product-row-${p.id}`}>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <img src={p.image || PLACEHOLDER} alt={p.name} className="h-10 w-10 rounded-md object-cover"
                            onError={(e) => { e.currentTarget.src = PLACEHOLDER; }} />
                          <div>
                            <p className="font-medium">{p.name}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">{p.code || '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{p.category || '-'}</td>
                      <td className="px-2 py-2 capitalize">{p.kind}</td>
                      <td className="px-2 py-2 text-right font-mono">{rp(p.price)}</td>
                      <td className="px-2 py-2 text-right font-mono">{num(p.pv)}</td>
                      <td className="px-2 py-2 text-right font-mono">{stock[p.id]?.tracked ? `${num(stock[p.id].qty)} ${p.unit || ''}` : '-'}</td>
                      <td className="px-2 py-2">{p.active ? 'Aktif' : 'Nonaktif'}</td>
                      {canManage ? (
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => { setF({ ...EMPTY, ...p }); setEditId(p.id); setOpen(true); }} data-testid={`edit-product-table-${p.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                            {user?.role === 'admin_pusat' ? <Button size="sm" variant="outline" className="text-destructive" onClick={() => remove(p)} data-testid={`delete-product-table-${p.id}`}><Trash2 className="h-3.5 w-3.5" /></Button> : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-card">
          <DialogHeader><DialogTitle className="font-display">{editId ? 'Ubah Produk' : 'Produk Baru'}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-background p-3">
                <img src={f.image || PLACEHOLDER} alt="pratinjau" className="h-24 w-32 rounded-lg object-cover" data-testid="product-image-preview"
                  onError={(e) => { e.currentTarget.src = PLACEHOLDER; }} />
                <div className="grid gap-2">
                  <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} className="hidden" data-testid="product-image-file" />
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} data-testid="product-image-upload">
                    <ImagePlus className="mr-1 h-4 w-4" /> Unggah Foto
                  </Button>
                  <Input className="h-10 w-full min-w-[240px]" placeholder="atau tempel URL gambar" value={f.image?.startsWith('data:') ? '' : f.image}
                    onChange={(e) => setF({ ...f, image: e.target.value })} data-testid="product-image-url" />
                  {f.image ? (
                    <button type="button" className="text-left text-xs text-destructive hover:underline" onClick={() => setF({ ...f, image: '' })} data-testid="product-image-clear">Hapus foto</button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">Foto otomatis dikompres (maks 900px) agar cepat dimuat di HP.</p>
              </div>
            </div>
            <div className="grid gap-1.5 md:col-span-2">
              <Label className="text-xs uppercase text-muted-foreground">Nama produk *</Label>
              <Input className="h-11" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="product-name" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase text-muted-foreground">Kode</Label>
              <Input className="h-11 font-mono" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} data-testid="product-code" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase text-muted-foreground">Kategori</Label>
              <Input className="h-11" placeholder="mis. Kesehatan" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} data-testid="product-category" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase text-muted-foreground">Jenis omset</Label>
              <select className="h-11 rounded-md border bg-background px-3 text-sm" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} data-testid="product-kind">
                <option value="perkembangan">Omset Perkembangan</option>
                <option value="penjualan">Omset Penjualan</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase text-muted-foreground">Satuan</Label>
              <Input className="h-11" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} data-testid="product-unit" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase text-muted-foreground">Harga (Rp)</Label>
              <Input className="h-11 font-mono" type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} data-testid="product-price" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase text-muted-foreground">PV</Label>
              <Input className="h-11 font-mono" type="number" value={f.pv} onChange={(e) => setF({ ...f, pv: e.target.value })} data-testid="product-pv" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase text-muted-foreground">Batas stok minimum</Label>
              <Input className="h-11 font-mono" type="number" value={f.min_stock} onChange={(e) => setF({ ...f, min_stock: e.target.value })} data-testid="product-min-stock" />
            </div>
            <div className="grid gap-1.5 md:col-span-2">
              <Label className="text-xs uppercase text-muted-foreground">Deskripsi</Label>
              <Input className="h-11" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} data-testid="product-description" />
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" checked={!!f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} data-testid="product-active" />
              Produk aktif (bisa dipilih saat input omset)
            </label>
            <DialogFooter className="md:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit" disabled={busy} data-testid="product-submit">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
