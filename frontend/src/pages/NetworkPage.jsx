import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import AppShell from '../components/AppShell';
import NetworkTree from '../components/NetworkTree';
import OrgTree from '../components/OrgTree';
import MemberPicker from '../components/MemberPicker';
import PlacementAudit from '../components/PlacementAudit';
import { MembershipBadge, RankBadge, TupoBadge } from '../components/Badges';
import { Button } from '../components/ui/button';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { num, periodLabel } from '../lib/format';

const TABS = [
  { id: 'placement', label: 'Pohon Placement' },
  { id: 'sponsor', label: 'Pohon Sponsor' },
  { id: 'org', label: 'Struktur Organisasi' },
];

export default function NetworkPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('placement');
  const [root, setRoot] = useState(user?.member_id || '');
  const [depth, setDepth] = useState(4);
  const [data, setData] = useState(null);
  const [org, setOrg] = useState(null);
  const [sel, setSel] = useState(null);
  const [loading, setLoading] = useState(false);

  const isOrg = tab === 'org';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isOrg) {
        const { data: d } = await api.get('/hierarchy');
        setOrg(d);
      } else {
        const { data: d } = await api.get('/network', { params: { tree: tab, root: root || undefined, depth } });
        setData(d);
      }
    } catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
  }, [tab, root, depth, isOrg]);

  useEffect(() => { load(); }, [load]);

  return (
    <AppShell title="Jaringan" subtitle="Pohon Sponsor untuk bonus sponsor/prestasi · Pohon Placement untuk bonus pasangan · Struktur Organisasi untuk jenjang Admin Provinsi → Stokis → Member">
      <div className="grid gap-4">
        {user?.role === 'admin_pusat' ? <PlacementAudit /> : null}
        <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
          <div className="flex flex-wrap rounded-lg border p-1">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} data-testid={`network-tab-${t.id}`}
                className={`rounded-md px-3 py-2 text-sm transition-colors ${tab === t.id ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                {t.label}
              </button>
            ))}
          </div>
          {!isOrg ? (
            <>
              <div className="min-w-[220px] flex-1">
                <p className="mb-1 text-xs uppercase text-muted-foreground">Mulai dari member</p>
                <MemberPicker value={root} onChange={setRoot} testid="network-root" />
              </div>
              <div>
                <p className="mb-1 text-xs uppercase text-muted-foreground">Kedalaman</p>
                <select className="h-11 rounded-md border bg-background px-3 text-sm" value={depth} onChange={(e) => setDepth(Number(e.target.value))} data-testid="network-depth">
                  {[2, 3, 4, 6, 8, 10].map((n) => <option key={n} value={n}>{n} level</option>)}
                </select>
              </div>
            </>
          ) : null}
          <Button onClick={load} data-testid="network-refresh">{isOrg ? 'Muat Ulang' : 'Tampilkan'}</Button>
        </div>

        {isOrg ? (
          <div className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-display text-base font-semibold">Struktur Organisasi</h3>
              <span className="text-xs text-muted-foreground">Admin Pusat → Admin Provinsi → Stokis → Member</span>
            </div>
            <OrgTree data={org} loading={loading} />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border bg-card lg:col-span-2">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h3 className="font-display text-base font-semibold">{tab === 'sponsor' ? 'Struktur Sponsor' : 'Struktur Placement'}</h3>
                <span className="font-mono text-xs text-muted-foreground">{data ? periodLabel(data.period_key) : ''}</span>
              </div>
              {loading ? <p className="p-8 text-center text-sm text-muted-foreground">Memuat jaringan...</p>
                : <NetworkTree node={data?.node} onSelect={setSel} defaultOpen={2} selectedId={sel?.member_id} />}
              <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
                KU/KG = jalur sponsor terbesar vs sisa jalur pada periode ini · AKG = akumulasi sisa jalur · ikon api = status Tupo
              </p>
            </div>

            <div className="rounded-xl border bg-card p-4 lg:sticky lg:top-16 lg:self-start">
              <h3 className="font-display text-base font-semibold">Detail Node</h3>
              {!sel ? <p className="mt-2 text-sm text-muted-foreground">Klik salah satu member pada pohon untuk melihat detail.</p> : (
                <div className="mt-3 grid gap-3" data-testid="network-node-detail">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{sel.member_id}</p>
                    <p className="font-display text-lg font-semibold">{sel.name}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <RankBadge rank={sel.rank} icon /><MembershipBadge membership={sel.membership} />
                    <TupoBadge ok={sel.tupo_ok} required={sel.tupo_required} manual={sel.tupo_manual} />
                  </div>
                  <dl className="grid gap-2 text-sm">
                    {[['PPV periode', `${num(sel.ppv, 2)} PV`], ['PPV perkembangan', `${num(sel.ppv_perkembangan, 2)} PV`],
                      ['PPV penjualan', `${num(sel.ppv_penjualan, 2)} PV`], ['KU (jalur terbesar)', `${num(sel.ku, 2)} PV`],
                      ['KG (sisa jalur)', `${num(sel.kg, 2)} PV`], ['AKU (akumulasi)', `${num(sel.aku, 2)} PV`],
                      ['AKG (akumulasi)', `${num(sel.akg, 2)} PV`], ['TNPV', `${num(sel.tnpv, 2)} PV`],
                      ['ATNPV', `${num(sel.atnpv, 2)} PV`], ['APPV', `${num(sel.appv, 2)} PV`],
                      ['Bonus periode', `${num(sel.total_bonus_bv)} BV`], ['Sponsor', sel.sponsor_id || '-'],
                      ['Placement', sel.placement_id || '-'], ['Frontline', num(sel.child_count)]].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2"><dt className="text-muted-foreground">{k}</dt><dd className="font-mono">{v}</dd></div>
                    ))}
                  </dl>
                  <Button variant="outline" onClick={() => setRoot(sel.member_id)} data-testid="network-set-root">Jadikan titik awal</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
