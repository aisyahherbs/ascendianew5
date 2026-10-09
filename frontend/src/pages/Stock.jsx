import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRightLeft, PackageMinus, PackagePlus, RefreshCw } from 'lucide-react';
import AppShell from '../components/AppShell';
import StatCard from '../components/StatCard';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PLACEHOLDER } from '../lib/image';
import { num, rp, tanggal } from '../lib/format';

const TYPE_LABEL = {
  in: 'Stok masuk', out: 'Stok keluar', set: 'Stok opname',
  transfer_in: 'Transfer masuk', transfer_out: 'Transfer keluar', sale: 'Penjualan',
};

export default function Stock() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin_pusat' || user?.role === 'admin_provinsi';
  const [owners, setOwners] = useState([]);
  const [owner, setOwner] = useState('');
  const [rows, setRows] = useState([]);
  const [moves, setMoves] = useState([]);
  const [adj, setAdj] = useState(null);
  const [form, setForm] = useState({ type: 'in', qty: '', note: '' });
  const [tr, setTr] = useState(null);
  const [trForm, setTrForm] = useState({ to_owner: '', qty: '', note: '' });

  useEffect(() => {
    api.get('/stock/owners').then(({ data }) => {
      setOwners(data);
      if (data.length) setOwner(data[0].owner_id);
    }).catch((e) => toast.error(errMsg(e)));
  }, []);

  const load = useCallback(async () => {
    if (!owner) return;
    try {
      const { data } = await api.get('/stock', { params: { owner_id: owner } });
      setRows(data.rows);
      const m = await api.get('/stock/movements', { params: { owner_id: owner, limit: 40 } });
      setMoves(m.data);
    } catch (e) { toast.error(errMsg(e)); }
  }, [owner]);

  useEffect(() => { load(); }, [load]);

  const saveAdjust = async () => {
    try {
      await api.post('/stock/adjust', {
        product_id: adj.product_id, owner_id: owner, type: form.type,
        qty: Number(form.qty || 0), note: form.note,
      });
      toast.success('Stok diperbarui');
      setAdj(null); setForm({ type: 'in', qty: '', note: '' }); load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const saveTransfer = async () => {
    try {
      await api.post('/stock/transfer', {
        product_id: tr.product_id, from_owner: owner, to_owner: trForm.to_owner,
        qty: Number(trForm.qty || 0), note: trForm.note,
      });
      toast.success('Transfer stok berhasil');
      setTr(null); setTrForm({ to_owner: '', qty: '', note: '' }); load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  const totalItems = rows.filter((r) => r.tracked).length;
  const lowItems = rows.filter((r) => r.tracked && r.qty <= (r.min_stock || 0)).length;
  const totalQty = rows.reduce((a, r) => a + (r.qty || 0), 0);
  const totalValue = rows.reduce((a, r) => a + (r.qty || 0) * (r.price || 0), 0);

  return (
    <AppShell title="Stok Produk" subtitle="Kelola stok gudang pusat dan stok tiap stokis"
      actions={<Button variant="outline" onClick={load} data-testid="stock-refresh"><RefreshCw className="mr-1 h-4 w-4" /> Muat ulang</Button>}>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
          <Label className="text-xs uppercase text-muted-foreground">Gudang / Stokis</Label>
          <select className="h-11 rounded-md border bg-background px-3 text-sm" value={owner} onChange={(e) => setOwner(e.target.value)} data-testid="stock-owner-select">
            {owners.map((o) => <option key={o.owner_id} value={o.owner_id}>{o.name}{o.province ? ` · ${o.province}` : ''}</option>)}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard testid="stock-kpi-items" label="Produk Dilacak" value={num(totalItems)} sub={`${rows.length} produk di katalog`} tone="primary" />
          <StatCard testid="stock-kpi-qty" label="Total Unit" value={num(totalQty)} />
          <StatCard testid="stock-kpi-value" label="Nilai Stok" value={rp(totalValue)} />
          <StatCard testid="stock-kpi-low" label="Stok Rendah" value={num(lowItems)} sub="di bawah batas minimum" />
        </div>

        <div className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3"><h3 className="font-display text-base font-semibold">Daftar Stok</h3></div>
          <div className="table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Produk</th><th className="px-2 py-3 text-left">Kategori</th>
                  <th className="px-2 py-3 text-right">Harga</th><th className="px-2 py-3 text-right">PV</th>
                  <th className="px-2 py-3 text-right">Stok</th><th className="px-2 py-3 text-right">Min</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">Belum ada produk di katalog.</td></tr>
                ) : rows.map((r) => {
                  const low = r.tracked && r.qty <= (r.min_stock || 0);
                  return (
                    <tr key={r.product_id} className="border-b last:border-0 hover:bg-muted/60" data-testid={`stock-row-${r.product_id}`}>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <img src={r.image || PLACEHOLDER} alt={r.name} className="h-10 w-10 rounded-md object-cover"
                            onError={(e) => { e.currentTarget.src = PLACEHOLDER; }} />
                          <div>
                            <p className="font-medium">{r.name}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">{r.code || '-'} · {r.kind}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{r.category || '-'}</td>
                      <td className="px-2 py-2 text-right font-mono">{rp(r.price)}</td>
                      <td className="px-2 py-2 text-right font-mono">{num(r.pv)}</td>
                      <td className={`px-2 py-2 text-right font-mono ${low ? 'text-[#8A5B00]' : ''}`}>
                        {num(r.qty)} {r.unit || ''}{low ? ' ⚠' : ''}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-muted-foreground">{num(r.min_stock)}</td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => { setAdj(r); setForm({ type: 'in', qty: '', note: '' }); }} data-testid={`stock-adjust-${r.product_id}`}>
                            <PackagePlus className="mr-1 h-3.5 w-3.5" /> Sesuaikan
                          </Button>
                          {isAdmin ? (
                            <Button size="sm" variant="outline" onClick={() => { setTr(r); setTrForm({ to_owner: (owners.find((o) => o.owner_id !== owner) || {}).owner_id || '', qty: '', note: '' }); }} data-testid={`stock-transfer-${r.product_id}`}>
                              <ArrowRightLeft className="h-3.5 w-3.5" />
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

        <div className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3"><h3 className="font-display text-base font-semibold">Riwayat Mutasi Stok</h3></div>
          <div className="table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Waktu</th><th className="px-2 py-2 text-left">Produk</th>
                  <th className="px-2 py-2 text-left">Jenis</th><th className="px-2 py-2 text-right">Perubahan</th>
                  <th className="px-2 py-2 text-right">Sisa</th><th className="px-4 py-2 text-left">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {moves.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">Belum ada mutasi stok</td></tr>
                ) : moves.map((m) => (
                  <tr key={m.id} className="border-b last:border-0" data-testid={`stock-move-${m.id}`}>
                    <td className="px-4 py-2 text-muted-foreground">{tanggal(m.created_at)}</td>
                    <td className="px-2 py-2">{m.product_name}</td>
                    <td className="px-2 py-2">{TYPE_LABEL[m.type] || m.type}</td>
                    <td className={`px-2 py-2 text-right font-mono ${m.qty < 0 ? 'text-destructive' : 'text-[#1F8A5B]'}`}>{m.qty > 0 ? '+' : ''}{num(m.qty)}</td>
                    <td className="px-2 py-2 text-right font-mono">{num(m.qty_after)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{m.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={!!adj} onOpenChange={(o) => !o && setAdj(null)}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader><DialogTitle className="font-display">Sesuaikan Stok — {adj?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">Stok saat ini: <span className="font-mono">{num(adj?.qty)} {adj?.unit}</span></p>
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase text-muted-foreground">Jenis penyesuaian</Label>
              <select className="h-11 rounded-md border bg-background px-3 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} data-testid="stock-adjust-type">
                <option value="in">Stok masuk (tambah)</option>
                <option value="out">Stok keluar (kurangi)</option>
                <option value="set">Stok opname (set jumlah)</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase text-muted-foreground">Jumlah</Label>
              <Input className="h-11 font-mono" type="number" min="0" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} data-testid="stock-adjust-qty" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase text-muted-foreground">Catatan</Label>
              <Input className="h-11" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} data-testid="stock-adjust-note" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdj(null)}>Batal</Button>
            <Button onClick={saveAdjust} data-testid="stock-adjust-save">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tr} onOpenChange={(o) => !o && setTr(null)}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader><DialogTitle className="font-display">Transfer Stok — {tr?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">Dari: <span className="font-mono">{(owners.find((o) => o.owner_id === owner) || {}).name}</span> (tersedia {num(tr?.qty)})</p>
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase text-muted-foreground">Tujuan</Label>
              <select className="h-11 rounded-md border bg-background px-3 text-sm" value={trForm.to_owner} onChange={(e) => setTrForm({ ...trForm, to_owner: e.target.value })} data-testid="stock-transfer-to">
                {owners.filter((o) => o.owner_id !== owner).map((o) => <option key={o.owner_id} value={o.owner_id}>{o.name}</option>)}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase text-muted-foreground">Jumlah</Label>
              <Input className="h-11 font-mono" type="number" min="1" value={trForm.qty} onChange={(e) => setTrForm({ ...trForm, qty: e.target.value })} data-testid="stock-transfer-qty" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase text-muted-foreground">Catatan</Label>
              <Input className="h-11" value={trForm.note} onChange={(e) => setTrForm({ ...trForm, note: e.target.value })} data-testid="stock-transfer-note" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTr(null)}>Batal</Button>
            <Button onClick={saveTransfer} data-testid="stock-transfer-save"><PackageMinus className="mr-1 h-4 w-4" /> Kirim</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
