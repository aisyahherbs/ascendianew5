import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Lock, LockOpen, Loader2 } from 'lucide-react';
import AppShell from '../components/AppShell';
import { Button } from '../components/ui/button';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { num, rp, tanggal } from '../lib/format';

export default function Periods() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState('');

  const load = async () => {
    try { const { data } = await api.get('/periods'); setRows(data); }
    catch (e) { toast.error(errMsg(e)); }
  };
  useEffect(() => { load(); }, []);

  const act = async (key, action) => {
    if (action === 'close' && !window.confirm(`Jalankan tutup buku untuk periode ${key}? Bonus akan dihitung dan dikunci.`)) return;
    setBusy(key + action);
    try {
      const { data } = await api.post(`/periods/${key}/${action}`);
      if (action === 'close') {
        toast.success('Tutup buku selesai', {
          description: `Total bonus ${num(data.summary?.total_bonus_bv)} BV`,
        });
      } else toast.success('Periode dibuka kembali');
      load();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(''); }
  };

  return (
    <AppShell title="Periode & Tutup Buku" subtitle="Tutup buku 2x sebulan: maksimal tanggal 11 (Periode 1) dan tanggal 27 (Periode 2)">
      <div className="grid gap-4">
        <div className="rounded-xl border bg-accent p-4">
          <p className="flex items-center gap-2 font-display text-sm font-semibold"><CalendarClock className="h-4 w-4" /> Cara kerja periode</p>
          <p className="mt-1 text-sm text-accent-foreground">
            Periode 1 mencakup transaksi tanggal 1–11, Periode 2 tanggal 12 sampai akhir bulan. Setelah tutup buku, bonus
            periode tersebut dikunci dan sisa omset pasangan (carry) diteruskan ke periode berikutnya.
          </p>
        </div>

        <div className="rounded-xl border bg-card">
          <div className="table-wrap">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Periode</th><th className="px-2 py-3 text-left">Rentang</th>
                  <th className="px-2 py-3 text-left">Tutup Buku</th><th className="px-2 py-3 text-right">Perkembangan</th>
                  <th className="px-2 py-3 text-right">Penjualan</th><th className="px-2 py-3 text-right">Total Bonus</th>
                  <th className="px-2 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-sm text-muted-foreground">Belum ada periode</td></tr>
                ) : rows.map((p) => (
                  <tr key={p.key} className="border-b last:border-0 hover:bg-muted/60" data-testid={`period-row-${p.key}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.label}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{p.key}{p.is_current ? ' · berjalan' : ''}</p>
                    </td>
                    <td className="px-2 py-3 text-muted-foreground">{tanggal(p.start)} – {tanggal(p.end)}</td>
                    <td className="px-2 py-3 text-muted-foreground">{tanggal(p.close_date)}</td>
                    <td className="px-2 py-3 text-right font-mono">{num(p.omset_perkembangan)}</td>
                    <td className="px-2 py-3 text-right font-mono">{num(p.omset_penjualan)}</td>
                    <td className="px-2 py-3 text-right font-mono">{num(p.total_bonus_bv)} BV<br /><span className="text-[11px] text-muted-foreground">{rp(p.total_bonus_bv * 1000)}</span></td>
                    <td className="px-2 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${p.status === 'open' ? 'border-[#C6EAD8] bg-[#E7F6EE] text-[#1F8A5B]' : 'border-border bg-muted text-muted-foreground'}`}>
                        {p.status === 'open' ? <LockOpen className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        {p.status === 'open' ? 'Buka' : 'Ditutup'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user?.role === 'admin_pusat' ? (
                        p.status === 'open' ? (
                          <Button size="sm" onClick={() => act(p.key, 'close')} disabled={busy === p.key + 'close'} data-testid={`period-close-run-button-${p.key}`}>
                            {busy === p.key + 'close' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null} Tutup Buku
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => act(p.key, 'reopen')} disabled={busy === p.key + 'reopen'} data-testid={`period-reopen-button-${p.key}`}>
                            Buka Kembali
                          </Button>
                        )
                      ) : <span className="text-xs text-muted-foreground">hanya Admin Pusat</span>}
                    </td>
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
