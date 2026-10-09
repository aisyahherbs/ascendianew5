import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import AppShell from '../components/AppShell';
import MemberPicker from '../components/MemberPicker';
import PeriodFilter from '../components/PeriodFilter';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { api, errMsg } from '../lib/api';
import { canInput, useAuth } from '../lib/auth';
import { num, rp, tanggal } from '../lib/format';
import { PLACEHOLDER } from '../lib/image';

export default function Transactions() {
  const { user } = useAuth();
  const allowed = canInput(user?.role);
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [range, setRange] = useState({ mode: 'period', key: '' });
  const [filter, setFilter] = useState({ member_id: '', kind: '', q: '' });
  const [f, setF] = useState({ member_id: '', kind: 'perkembangan', pv: '', date: new Date().toISOString().slice(0, 10), product_id: '', qty: 1, note: '' });
  const [saving, setSaving] = useState(false);
  const [stock, setStock] = useState({});
  const [stockOwner, setStockOwner] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/transactions', {
        params: {
          member_id: filter.member_id || undefined,
          kind: filter.kind || undefined,
          q: filter.q || undefined,
          mode: range.key ? range.mode : undefined,
          range_key: range.key || undefined,
        },
      });
      setRows(data);
    } catch (e) { toast.error(errMsg(e)); }
  }, [filter, range]);

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);
  useEffect(() => {
    api.get('/products').then(({ data }) => setProducts(data.filter((p) => p.active))).catch(() => {});
    if (allowed) {
      api.get('/stock/owners')
        .then(({ data }) => {
          const own = data[0]?.owner_id;
          if (!own) return;
          return api.get('/stock', { params: { owner_id: own } }).then(({ data: s }) => {
            setStockOwner({ id: own, name: data[0].name });
            setStock(Object.fromEntries(s.rows.map((r) => [r.product_id, r])));
          });
        })
        .catch(() => {});
    }
    // eslint-disable-next-line
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...f, pv: Number(f.pv || 0), qty: Number(f.qty || 1) };
      if (!payload.product_id) delete payload.product_id;
      await api.post('/transactions', payload);
      toast.success('Omset berhasil dicatat');
      setF({ ...f, pv: '', note: '', product_id: '' });
      load();
    } catch (e2) { toast.error(errMsg(e2)); } finally { setSaving(false); }
  };

  const remove = async (t) => {
    if (!window.confirm('Hapus transaksi ini?')) return;
    try { await api.delete(`/transactions/${t.id}`); toast.success('Transaksi dihapus'); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  const selectedProduct = products.find((p) => p.id === f.product_id);

  return (
    <AppShell title="Omset / Transaksi" subtitle="Input omset Perkembangan (membership) atau Penjualan (tupo & prestasi)">
      <div className="grid gap-4 lg:grid-cols-3">
        {allowed ? (
          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-display text-base font-semibold">Input Omset</h3>
            <form onSubmit={submit} className="mt-3 grid gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs uppercase text-muted-foreground">Member *</Label>
                <MemberPicker value={f.member_id} onChange={(v) => setF({ ...f, member_id: v })} testid="tx-member" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs uppercase text-muted-foreground">Jenis omset *</Label>
                <select className="h-11 rounded-md border bg-background px-3 text-sm" value={f.kind}
                  onChange={(e) => setF({ ...f, kind: e.target.value, product_id: '' })} data-testid="tx-kind">
                  <option value="perkembangan">Omset Perkembangan</option>
                  <option value="penjualan">Omset Penjualan</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs uppercase text-muted-foreground">Produk (opsional)</Label>
                <select className="h-11 rounded-md border bg-background px-3 text-sm" value={f.product_id}
                  onChange={(e) => setF({ ...f, product_id: e.target.value })} data-testid="tx-product">
                  <option value="">- input PV manual -</option>
                  {products.filter((p) => p.kind === f.kind).map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · {num(p.pv)} PV</option>
                  ))}
                </select>
              </div>
              {selectedProduct ? (
                <div className="flex items-center gap-3 rounded-lg border bg-background p-2">
                  <img src={selectedProduct.image || PLACEHOLDER} alt={selectedProduct.name} className="h-14 w-14 rounded-md object-cover"
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER; }} />
                  <div className="min-w-0 text-xs">
                    <p className="truncate font-medium">{selectedProduct.name}</p>
                    <p className="font-mono text-muted-foreground">{rp(selectedProduct.price)} · {num(selectedProduct.pv)} PV</p>
                    {stock[selectedProduct.id]?.tracked ? (
                      <p className={`font-mono ${stock[selectedProduct.id].qty <= 0 ? 'text-destructive' : 'text-muted-foreground'}`} data-testid="tx-stock-info">
                        Stok {stockOwner?.name}: {num(stock[selectedProduct.id].qty)} {selectedProduct.unit || ''}
                      </p>
                    ) : <p className="text-muted-foreground">Stok belum dilacak</p>}
                  </div>
                </div>
              ) : null}
              {selectedProduct ? (
                <div className="grid gap-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">Jumlah</Label>
                  <Input className="h-11 font-mono" type="number" min="1" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} data-testid="tx-qty" />
                  <p className="text-xs text-muted-foreground">Total {num((selectedProduct.pv || 0) * Number(f.qty || 1))} PV</p>
                </div>
              ) : (
                <div className="grid gap-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">PV *</Label>
                  <Input className="h-11 font-mono" type="number" min="1" value={f.pv} onChange={(e) => setF({ ...f, pv: e.target.value })} data-testid="tx-pv" />
                </div>
              )}
              <div className="grid gap-1.5">
                <Label className="text-xs uppercase text-muted-foreground">Tanggal *</Label>
                <Input className="h-11" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} data-testid="tx-date" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs uppercase text-muted-foreground">Catatan</Label>
                <Input className="h-11" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} data-testid="tx-note" />
              </div>
              <Button type="submit" disabled={saving} data-testid="tx-submit">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />} Catat Omset
              </Button>
            </form>
          </div>
        ) : null}

        <div className={`rounded-xl border bg-card ${allowed ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="grid gap-2 border-b px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-semibold">Daftar Omset</h3>
              <span className="text-xs text-muted-foreground" data-testid="tx-count">{rows.length} transaksi</span>
              <div className="ml-auto flex flex-wrap gap-2">
                <Input className="h-9 w-[180px] text-xs" placeholder="Cari member / produk" value={filter.q}
                  onChange={(e) => setFilter({ ...filter, q: e.target.value })} data-testid="tx-filter-search" />
                <select className="h-9 rounded-md border bg-background px-2 text-xs" value={filter.kind}
                  onChange={(e) => setFilter({ ...filter, kind: e.target.value })} data-testid="tx-filter-kind">
                  <option value="">Semua jenis</option>
                  <option value="perkembangan">Perkembangan</option>
                  <option value="penjualan">Penjualan</option>
                </select>
              </div>
            </div>
            <PeriodFilter value={range} onChange={setRange} testid="tx-period-filter" />
          </div>
          <div className="table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Tanggal</th><th className="px-2 py-2 text-left">Member</th>
                  <th className="px-2 py-2 text-left">Jenis</th><th className="px-2 py-2 text-left">Periode</th>
                  <th className="px-2 py-2 text-left">Keterangan</th><th className="px-2 py-2 text-right">PV</th>
                  {allowed ? <th className="px-4 py-2 text-right">Aksi</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">Belum ada transaksi</td></tr>
                ) : rows.map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-muted/60" data-testid={`tx-row-${t.id}`}>
                    <td className="px-4 py-2">{tanggal(t.date)}</td>
                    <td className="px-2 py-2"><span className="font-mono text-xs">{t.member_id}</span> <span className="text-muted-foreground">{t.member_name}</span></td>
                    <td className="px-2 py-2 capitalize">{t.kind}</td>
                    <td className="px-2 py-2 font-mono text-xs">{t.period_key}</td>
                    <td className="px-2 py-2 text-muted-foreground">{t.product_name || t.note || '-'}</td>
                    <td className="px-2 py-2 text-right font-mono">{num(t.pv)}</td>
                    {allowed ? (
                      <td className="px-4 py-2 text-right">
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => remove(t)} data-testid={`tx-delete-${t.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
