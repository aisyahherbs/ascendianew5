import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, Wrench } from 'lucide-react';
import { Button } from './ui/button';
import { api, errMsg } from '../lib/api';

/**
 * Audit aturan biner: cari member dengan lebih dari 2 kaki placement,
 * tampilkan rencana pemindahan, lalu terapkan bila admin setuju.
 * Sponsor tidak pernah diubah.
 */
export default function PlacementAudit() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get('/placement-audit');
      setData(d);
    } catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fix = async () => {
    setFixing(true);
    try {
      const { data: d } = await api.post('/placement-audit/fix');
      toast.success(d.message);
      await load();
    } catch (e) { toast.error(errMsg(e)); } finally { setFixing(false); }
  };

  const bersih = data && data.jumlah_dipindah === 0;

  return (
    <div className="rounded-xl border bg-card p-3" data-testid="placement-audit">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h3 className="font-display text-[14px] font-semibold">Audit Aturan Biner (maksimal 2 kaki placement)</h3>
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" variant="outline" onClick={load} disabled={loading} data-testid="audit-refresh">
            {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Periksa ulang
          </Button>
          {data && data.jumlah_dipindah > 0 ? (
            <Button size="sm" onClick={fix} disabled={fixing} data-testid="audit-fix">
              {fixing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                : <Wrench className="mr-1.5 h-3.5 w-3.5" />}
              Perbaiki {data.jumlah_dipindah} penempatan
            </Button>
          ) : null}
        </div>
      </div>

      {!data ? (
        <p className="mt-2 text-[12px] text-muted-foreground">Memeriksa struktur...</p>
      ) : (
        <>
          <p className={`mt-2 flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-[11.5px] leading-snug ${
            bersih
              ? 'border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.1)]'
              : 'border-[hsl(var(--warning)/0.45)] bg-[hsl(var(--warning)/0.12)]'
          }`} data-testid="audit-message">
            {bersih ? <CheckCircle2 className="mt-[1px] h-3.5 w-3.5 shrink-0" />
              : <AlertTriangle className="mt-[1px] h-3.5 w-3.5 shrink-0" />}
            <span>{data.pesan} Total {data.total_member} member diperiksa.</span>
          </p>

          {data.pelanggaran?.length ? (
            <div className="mt-2 grid gap-1">
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                Member yang kakinya melebihi batas
              </p>
              {data.pelanggaran.map((p) => (
                <p key={p.member_id} className="text-[11.5px]" data-testid={`audit-violation-${p.member_id}`}>
                  <b className="font-mono">{p.member_id}</b> ({p.name}) punya{' '}
                  <b>{p.kaki} kaki</b>: {p.anak.join(', ')}
                </p>
              ))}
            </div>
          ) : null}

          {data.rencana?.length ? (
            <div className="mt-2 overflow-hidden rounded-lg border">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="px-2 text-left">Member dipindah</th>
                    <th className="px-2 text-left">Sponsor (tidak diubah)</th>
                    <th className="px-2 text-left">Placement lama</th>
                    <th className="px-2 text-left">Placement baru</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rencana.map((c) => (
                    <tr key={c.member_id} data-testid={`audit-plan-${c.member_id}`}>
                      <td className="px-2">
                        <span className="font-mono text-[11px] font-semibold">{c.member_id}</span>
                        <span className="ml-1.5 text-[10.5px] text-muted-foreground">{c.name}</span>
                      </td>
                      <td className="px-2 font-mono text-[11px] text-muted-foreground">{c.sponsor_id || '—'}</td>
                      <td className="px-2 font-mono text-[11px]">{c.placement_lama}</td>
                      <td className="px-2 font-mono text-[11px] font-semibold text-[hsl(var(--success))]">
                        {c.placement_baru}
                        {c.placement_baru_nama ? (
                          <span className="ml-1 font-sans text-[10.5px] font-normal text-muted-foreground">
                            {c.placement_baru_nama}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
