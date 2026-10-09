import React, { useState } from 'react';
import { Building2, ChevronDown, ChevronRight, MapPin, ShieldCheck, Store, User, Users } from 'lucide-react';
import { RankBadge, StatusBadge } from './Badges';
import { num } from '../lib/format';

/**
 * Struktur organisasi berjenjang:
 * Admin Pusat > Admin Provinsi (per provinsi) > Stokis > Member.
 */
export default function OrgTree({ data, loading }) {
  const [openProv, setOpenProv] = useState({});
  const [openStokis, setOpenStokis] = useState({});

  if (loading) return <p className="p-8 text-center text-sm text-muted-foreground">Memuat struktur...</p>;
  if (!data) return <p className="p-8 text-center text-sm text-muted-foreground">Belum ada data struktur.</p>;

  const t = data.totals || {};

  return (
    <div className="grid gap-3 p-3 md:p-4" data-testid="org-tree">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Admin Pusat', t.admin_pusat, ShieldCheck],
          ['Admin Provinsi', t.admin_provinsi, MapPin],
          ['Stokis', t.stokis, Store],
          ['Member', t.member, Users],
        ].map(([label, val, Icon]) => (
          <div key={label} className="rounded-lg border bg-background px-3 py-2">
            <p className="flex items-center gap-1.5 text-[11px] uppercase text-muted-foreground">
              <Icon className="h-3.5 w-3.5" /> {label}
            </p>
            <p className="font-mono text-lg font-semibold">{num(val || 0)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-background">
        <div className="flex items-center gap-2 border-b bg-primary px-3 py-2.5 text-primary-foreground">
          <Building2 className="h-4 w-4" />
          <div>
            <p className="font-display text-sm font-semibold">{data.company_name || 'Pusat'}</p>
            <p className="text-[11px] opacity-80">
              {(data.admin_pusat || []).map((a) => `${a.member_id} · ${a.name}`).join(' | ') || 'Admin Pusat'}
            </p>
          </div>
        </div>

        <div className="grid gap-1 p-2">
          {(data.provinces || []).length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Belum ada Admin Provinsi atau Stokis. Tambahkan dari menu Admin &amp; Stokis.
            </p>
          ) : null}

          {(data.provinces || []).map((p) => {
            const isOpen = !!openProv[p.province];
            return (
              <div key={p.province} className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => setOpenProv((s) => ({ ...s, [p.province]: !s[p.province] }))
                  }
                  data-testid={`org-province-${p.province}`}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/60"
                >
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <MapPin className="h-4 w-4 text-[#2E6FA7]" />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{p.province}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {p.admins.length ? p.admins.map((a) => `${a.member_id} · ${a.name}`).join(', ') : 'Belum ada Admin Provinsi'}
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {p.stokis_count} stokis · {p.member_count} member
                  </span>
                </button>

                {isOpen ? (
                  <div className="grid gap-1 border-t bg-muted/30 p-2">
                    {p.stokis.length === 0 ? (
                      <p className="px-2 py-3 text-xs text-muted-foreground">Belum ada stokis di provinsi ini.</p>
                    ) : null}
                    {p.stokis.map((s) => {
                      const so = !!openStokis[s.member_id];
                      return (
                        <div key={s.member_id} className="rounded-lg border bg-card">
                          <button
                            type="button"
                            onClick={() => setOpenStokis((x) => ({ ...x, [s.member_id]: !x[s.member_id] }))}
                            data-testid={`org-stokis-${s.member_id}`}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/60"
                          >
                            {so ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            <Store className="h-4 w-4 text-[#8A5B00]" />
                            <span className="flex-1">
                              <span className="block text-sm font-medium">
                                <span className="font-mono text-xs text-muted-foreground">{s.member_id}</span> {s.name}
                              </span>
                              <span className="block text-[11px] text-muted-foreground">
                                {s.city || '-'} · APPV {num(s.appv)} PV
                              </span>
                            </span>
                            <StatusBadge active={s.active} />
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {s.active_member_count}/{s.member_count} member aktif
                            </span>
                          </button>

                          {so ? (
                            <div className="grid gap-1 border-t p-2">
                              {s.members.length === 0 ? (
                                <p className="px-2 py-2 text-xs text-muted-foreground">Belum ada member di stokis ini.</p>
                              ) : null}
                              {s.members.map((m) => (
                                <div
                                  key={m.member_id}
                                  className="flex flex-wrap items-center gap-2 rounded-md bg-background px-2.5 py-1.5"
                                  data-testid={`org-member-${m.member_id}`}
                                >
                                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="font-mono text-[11px] text-muted-foreground">{m.member_id}</span>
                                  <span className="text-sm">{m.name}</span>
                                  <RankBadge rank={m.rank} />
                                  <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                                    APPV {num(m.appv)} PV
                                  </span>
                                  {!m.active ? (
                                    <span className="rounded bg-[#FDECEC] px-1.5 py-0.5 text-[10px] text-[#B4322F]">Nonaktif</span>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}

          {(data.unassigned_members || []).length ? (
            <div className="rounded-lg border border-dashed">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">Member tanpa stokis ({data.unassigned_members.length})</p>
                <p className="text-[11px] text-muted-foreground">
                  Tetapkan stokis pada data member agar masuk struktur provinsi.
                </p>
              </div>
              <div className="grid gap-1 border-t p-2">
                {data.unassigned_members.slice(0, 50).map((m) => (
                  <div key={m.member_id} className="flex flex-wrap items-center gap-2 rounded-md bg-background px-2.5 py-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-mono text-[11px] text-muted-foreground">{m.member_id}</span>
                    <span className="text-sm">{m.name}</span>
                    <RankBadge rank={m.rank} />
                    <span className="ml-auto text-[11px] text-muted-foreground">{m.province || 'tanpa provinsi'}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
