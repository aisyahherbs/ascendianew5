import React, { useEffect, useState } from 'react';
import { CornerDownRight, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

/**
 * Petunjuk penempatan biner (maksimal 2 kaki placement).
 *
 * Aturan yang ditampilkan sama dengan yang dipakai server:
 * - Placement kosong        -> mulai dari sponsor, turun ke KAKI TERLEMAH sampai ada slot kosong.
 * - Placement diisi & penuh -> member baru OTOMATIS turun ke kaki terlemah di bawahnya (tidak ditolak).
 * - Sponsor tidak dibatasi jumlahnya.
 */
export default function PlacementHint({ sponsorId, placementId, exclude }) {
  const [info, setInfo] = useState(null);
  const [manual, setManual] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setInfo(null); setManual(null);
      const pl = (placementId || '').trim().toUpperCase();
      const sp = (sponsorId || '').trim().toUpperCase();
      if (!pl && !sp) return;
      setBusy(true);
      try {
        if (sp) {
          const params = { sponsor_id: sp };
          if (pl) params.placement_id = pl;
          const { data } = await api.get('/placement-slot', { params });
          if (!alive) return;
          setInfo(data);
        } else {
          const { data } = await api.get(`/members/${pl}`);
          if (!alive) return;
          setManual({ id: pl, name: data.member?.name || '',
            pakai: Number(data.frontline_placement || 0), max: 2 });
        }
      } catch (e) {
        if (alive) { setInfo(null); setManual(null); }
      } finally {
        if (alive) setBusy(false);
      }
    };
    run();
    return () => { alive = false; };
  }, [sponsorId, placementId, exclude]);

  if (busy) {
    return (
      <p className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Memeriksa kaki placement...
      </p>
    );
  }

  if (manual) {
    const penuh = manual.pakai >= manual.max;
    const cls = penuh
      ? 'border-[hsl(var(--warning)/0.45)] bg-[hsl(var(--warning)/0.12)]'
      : 'border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.1)]';
    return (
      <p className={`flex items-start gap-1.5 rounded-md border px-2 py-1 text-[10.5px] leading-snug ${cls}`}
        data-testid="placement-hint-manual">
        <CornerDownRight className="mt-[1px] h-3 w-3 shrink-0" />
        <span>
          Kaki placement <b className="font-mono">{manual.id}</b>: {manual.pakai} dari maksimal {manual.max}.
          {penuh
            ? ' Sudah penuh — member akan otomatis turun ke kaki terlemah di bawahnya.'
            : ' Masih ada slot kosong.'}
        </span>
      </p>
    );
  }

  if (!info) return null;
  const turun = !!info.turun_otomatis;
  const cls = turun
    ? 'border-[hsl(var(--warning)/0.45)] bg-[hsl(var(--warning)/0.12)]'
    : 'border-[hsl(var(--info)/0.35)] bg-[hsl(var(--info)/0.08)]';
  return (
    <p className={`flex items-start gap-1.5 rounded-md border px-2 py-1 text-[10.5px] leading-snug ${cls}`}
      data-testid="placement-hint-auto">
      <CornerDownRight className="mt-[1px] h-3 w-3 shrink-0" />
      <span>
        {turun
          ? <>Kedua kaki <b className="font-mono">{info.requested_placement_id || info.sponsor_id}</b> sudah
            penuh 2/2 — member akan <b>otomatis turun ke kaki terlemah</b> (member paling sedikit) di </>
          : <>Member akan ditempatkan di </>}
        <b className="font-mono">{info.placement_id}</b>
        {info.placement_name ? ` (${info.placement_name})` : ''}
        {' '}(kaki terpakai {info.kaki_terpakai}/{info.kaki_maksimal}).{' '}
        {turun && (info.jalur || []).length > 1
          ? <>Jalur: <b className="font-mono">{info.jalur.join(' → ')}</b>.{' '}</>
          : null}
        Sponsor <b className="font-mono">{info.sponsor_id}</b> punya {info.sponsor_kaki_terpakai} kaki
        placement — jumlah sponsor sendiri tidak dibatasi.
      </span>
    </p>
  );
}
