import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Printer } from 'lucide-react';
import AppShell from '../components/AppShell';
import MemberPicker from '../components/MemberPicker';
import { MembershipBadge, RankBadge, TupoBadge } from '../components/Badges';
import { Button } from '../components/ui/button';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BONUS_LIST, num, pct, rp } from '../lib/format';

export default function Statement() {
  const { user } = useAuth();
  const [periods, setPeriods] = useState([]);
  const [key, setKey] = useState('');
  const [mid, setMid] = useState(user?.member_id || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/periods').then(({ data: d }) => {
      setPeriods(d);
      const cur = d.find((p) => p.is_current) || d[0];
      if (cur) setKey(cur.key);
    }).catch(() => {});
  }, []);

  const load = async (k = key, m = mid) => {
    if (!k || !m) return;
    setLoading(true);
    try {
      const { data: d } = await api.get(`/bonus/statement/${m}`, { params: { period_key: k } });
      setData(d);
    } catch (e) { setData(null); toast.error(errMsg(e)); } finally { setLoading(false); }
  };

  useEffect(() => { if (key && mid) load(key, mid); /* eslint-disable-next-line */ }, [key]);

  const r = data?.result || {};
  const isMember = user?.role === 'member';

  return (
    <AppShell title="Slip Bonus" subtitle="Rincian bonus per periode lengkap dengan rumus perhitungan"
      actions={<Button variant="outline" onClick={() => window.print()} data-testid="print-statement"><Printer className="mr-1 h-4 w-4" /> Cetak</Button>}>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
          <div>
            <p className="mb-1 text-xs uppercase text-muted-foreground">Periode</p>
            <select className="h-11 rounded-md border bg-background px-3 text-sm" value={key} onChange={(e) => setKey(e.target.value)} data-testid="statement-period">
              {periods.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          {!isMember ? (
            <div className="min-w-[220px] flex-1">
              <p className="mb-1 text-xs uppercase text-muted-foreground">Member</p>
              <MemberPicker value={mid} onChange={setMid} testid="statement-member" />
            </div>
          ) : null}
          <Button onClick={() => load()} data-testid="statement-load">Tampilkan</Button>
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Memuat slip...</p> : !data ? (
          <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Belum ada data untuk pilihan ini.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs uppercase text-muted-foreground">Slip bonus</p>
              <p className="font-display text-xl font-semibold">{data.member?.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{data.member?.member_id} · {data.label}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <RankBadge rank={r.rank} /><MembershipBadge membership={r.membership} /><TupoBadge ok={r.tupo_ok} required={r.tupo_required} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                {[['PPV', r.ppv], ['Perkembangan', r.ppv_perkembangan], ['Penjualan', r.ppv_penjualan],
                  ['TNPV', r.tnpv], ['APPV', r.appv], ['ATNPV', r.atnpv]].map(([k2, v]) => (
                  <div key={k2} className="rounded-lg border bg-background px-2 py-1.5">
                    <p className="text-[10px] uppercase text-muted-foreground">{k2}</p>
                    <p className="font-mono">{num(v)} PV</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg bg-primary px-3 py-3 text-primary-foreground">
                <p className="text-xs uppercase opacity-80">Total bonus periode ini</p>
                <p className="font-mono text-xl">{num(r.total_bonus_bv)} BV</p>
                <p className="font-mono text-sm opacity-90">{rp(r.total_bonus_rp)}</p>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {data.closed ? 'Periode sudah ditutup — angka final.' : 'Periode masih berjalan — angka bersifat estimasi.'}
              </p>
            </div>

            <div className="grid gap-3 lg:col-span-2">
              {BONUS_LIST.map((b) => {
                const lines = (r.lines || []).filter((l) => l.bonus === b.label);
                return (
                  <div key={b.key} className="rounded-xl border bg-card p-4" data-testid={`statement-${b.key}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-display text-base font-semibold">{b.label}</p>
                        <p className="text-[11px] text-muted-foreground">{b.group}</p>
                      </div>
                      <p className="font-mono text-lg">{num(r[b.key])} BV</p>
                    </div>
                    {lines.length ? (
                      <div className="mt-2 grid gap-1">
                        {lines.map((l, i) => (
                          <div key={i} className="formula">
                            {l.description}<br />{num(l.base_pv)} PV × {pct(l.rate)} = {num(l.amount_bv)} BV
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">Tidak ada bonus ini pada periode tersebut.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
