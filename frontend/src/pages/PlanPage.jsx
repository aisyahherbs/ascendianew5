import React, { useEffect, useState } from 'react';
import AppShell from '../components/AppShell';
import { MembershipBadge, RankBadge } from '../components/Badges';
import { api } from '../lib/api';
import { num, pct } from '../lib/format';

export default function PlanPage() {
  const [p, setP] = useState(null);
  useEffect(() => { api.get('/plan').then(({ data }) => setP(data)).catch(() => {}); }, []);
  if (!p) return <AppShell title="Marketing Plan"><p className="text-sm text-muted-foreground">Memuat...</p></AppShell>;

  const ranks = p.ranks || [];
  const syarat = {
    Member: 'Awal bergabung',
    VIP: `APPV ${num(p.rank_rules?.VIP?.appv)} PV`,
    'Royal Star': `APPV ${num(p.rank_rules?.['Royal Star']?.appv)} PV atau VIP dengan ATNPV ${num(p.rank_rules?.['Royal Star']?.alt_atnpv)} PV`,
    'Crown Star': `ATNPV ${num(p.rank_rules?.['Crown Star']?.atnpv)} PV, ATNPV KG ${num(p.rank_rules?.['Crown Star']?.kg)} PV`,
    'Leader Ambassador': `ATNPV ${num(p.rank_rules?.['Leader Ambassador']?.atnpv)} PV, ATNPV KG ${num(p.rank_rules?.['Leader Ambassador']?.kg)} PV`,
    'Leader Majestic': `ATNPV ${num(p.rank_rules?.['Leader Majestic']?.atnpv)} PV, ATNPV KG ${num(p.rank_rules?.['Leader Majestic']?.kg)} PV`,
    Director: 'Mempunyai 3 kaki Leader Majestic',
    'Executive Director': 'Mempunyai 3 kaki Director',
  };

  return (
    <AppShell title="Marketing Plan" subtitle="Acuan resmi perhitungan bonus — 1 PV = 1 BV = Rp 1.000">
      <div className="grid gap-4 md:gap-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-card">
            <div className="border-b px-4 py-3"><h3 className="font-display text-base font-semibold">Membership (Omset Perkembangan)</h3></div>
            <div className="table-wrap">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr><th className="px-4 py-2 text-left">Membership</th><th className="px-2 py-2 text-right">PV</th><th className="px-2 py-2 text-right">Bonus Sponsor</th><th className="px-2 py-2 text-right">Bonus Pasangan</th><th className="px-4 py-2 text-right">Maks/Periode</th></tr>
                </thead>
                <tbody>
                  {['Bronze', 'Silver', 'Gold', 'Platinum'].map((m) => (
                    <tr key={m} className="border-b last:border-0">
                      <td className="px-4 py-2"><MembershipBadge membership={m} /></td>
                      <td className="px-2 py-2 text-right font-mono">{num(p.memberships[m].threshold)}</td>
                      <td className="px-2 py-2 text-right font-mono">{pct(p.memberships[m].sponsor)}</td>
                      <td className="px-2 py-2 text-right font-mono">{pct(p.memberships[m].pairing)}</td>
                      <td className="px-4 py-2 text-right font-mono">{num(p.memberships[m].cap)} BV</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-4 py-3 text-xs text-muted-foreground">
              Bonus pasangan maksimal {num(p.pairing_cap_majestic)} BV per periode bila peringkat minimal Leader Majestic.
              Bonus bimbingan {pct(p.bimbingan_rate)} per generasi (Bronze 1 generasi, Silver 2, Gold 3, Platinum 4) dan
              hanya berlaku bila Anda sendiri mendapat bonus pasangan.
            </p>
          </div>

          <div className="rounded-xl border bg-card">
            <div className="border-b px-4 py-3"><h3 className="font-display text-base font-semibold">Peringkat & Bonus Prestasi</h3></div>
            <div className="table-wrap">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr><th className="px-4 py-2 text-left">Peringkat</th><th className="px-2 py-2 text-left">Syarat</th><th className="px-2 py-2 text-right">Prestasi</th><th className="px-4 py-2 text-right">Tupo</th></tr>
                </thead>
                <tbody>
                  {ranks.map((r) => (
                    <tr key={r} className="border-b last:border-0">
                      <td className="px-4 py-2"><RankBadge rank={r} /></td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">{syarat[r]}</td>
                      <td className="px-2 py-2 text-right font-mono">{pct(p.prestasi_rate[r])}</td>
                      <td className="px-4 py-2 text-right font-mono">{num(p.tupo[r])} PV</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-display text-base font-semibold">Bonus Kepemimpinan (12%)</h3>
            <p className="mt-1 text-xs text-muted-foreground">Minimal Crown Star, dihitung dari generasi Crown Star di bawah Anda (dikompres).</p>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {(p.gen_rates || []).map((g, i) => (
                <div key={i} className="rounded-lg border bg-background px-2 py-1.5 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">Gen {i + 1}</p>
                  <p className="font-mono text-sm">{pct(g)}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-1 text-sm">
              {Object.entries(p.leadership_depth || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-mono">{v} generasi</span></div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-display text-base font-semibold">Sharing Profit & Special Reward</h3>
            <div className="mt-3 grid gap-2 text-sm">
              {Object.entries(p.sharing_profit || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between rounded-lg border bg-background px-3 py-2">
                  <span>{k}</span><span className="font-mono">{pct(v)} omset nasional</span>
                </div>
              ))}
              <div className="flex justify-between rounded-lg border bg-background px-3 py-2">
                <span>Special Reward</span><span className="font-mono">{pct(p.reward_pool_rate)} (min. {p.reward_qualify_rank})</span>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Istilah</p>
              <p className="mt-1">PPV: belanja pribadi periode ini · APPV: akumulasi belanja pribadi · TNPV: omset pribadi + grup periode ini ·
                ATNPV: akumulasi TNPV · KU: kaki terbesar · KG: kaki gabungan (selain KU).</p>
              <p className="mt-1">Wajib Tupo untuk mendapat bonus, kecuali Bonus Sponsor. Tupo dihitung dari omset penjualan pribadi.</p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
