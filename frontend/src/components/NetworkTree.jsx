import React, { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, User } from 'lucide-react';
import { MembershipBadge, RankBadge, TupoFlame } from './Badges';
import { dec, num } from '../lib/format';

/** Ubah pohon menjadi baris datar sesuai state buka/tutup tiap node. */
function flatten(root, open) {
  const rows = [];
  const walk = (node, level, guides, isLast) => {
    rows.push({ node, level, guides, isLast });
    if (!open.has(node.member_id)) return;
    const kids = node.children || [];
    kids.forEach((c, i) => walk(c, level + 1, [...guides, !isLast], i === kids.length - 1));
  };
  walk(root, 0, [], true);
  return rows;
}

function collectOpen(node, depth, level = 0, acc = new Set()) {
  if (level < depth) acc.add(node.member_id);
  (node.children || []).forEach((c) => collectOpen(c, depth, level + 1, acc));
  return acc;
}

const ROW_INDENT = 22;

export default function NetworkTree({ node, onSelect, defaultOpen = 2, selectedId }) {
  const [open, setOpen] = useState(() => new Set());

  useEffect(() => {
    if (node) setOpen(collectOpen(node, defaultOpen));
  }, [node, defaultOpen]);

  const rows = useMemo(() => (node ? flatten(node, open) : []), [node, open]);

  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!node) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Belum ada data jaringan.</p>;
  }

  return (
    <div className="overflow-x-auto py-2" data-testid="network-tree">
      <div className="min-w-[520px]">
        {rows.map(({ node: n, level, guides, isLast }) => {
          const hasKids = (n.child_count || 0) > 0 && (n.children || []).length > 0;
          const isOpen = open.has(n.member_id);
          const selected = selectedId === n.member_id;
          return (
            <div
              key={`${n.member_id}-${level}`}
              className="relative flex items-stretch"
              data-testid={`tree-node-${n.member_id}`}
            >
              {/* garis panduan vertikal untuk tiap level di atasnya */}
              {guides.map((show, i) => (
                <span
                  key={i}
                  style={{ width: ROW_INDENT }}
                  className={`flex-shrink-0 ${show ? 'border-l border-[#D4CFC7]' : ''}`}
                />
              ))}

              {/* siku penghubung + tombol buka/tutup */}
              {level > 0 ? (
                <span style={{ width: ROW_INDENT }} className="relative flex-shrink-0">
                  <span
                    className={`absolute left-0 top-0 w-px bg-[#D4CFC7] ${isLast ? 'h-[26px]' : 'h-full'}`}
                  />
                  <span className="absolute left-0 top-[26px] h-px w-full bg-[#D4CFC7]" />
                </span>
              ) : null}

              <div className="flex flex-1 items-start gap-2 py-1.5">
                <button
                  type="button"
                  onClick={() => hasKids && toggle(n.member_id)}
                  disabled={!hasKids}
                  data-testid={`tree-toggle-${n.member_id}`}
                  title={hasKids ? (isOpen ? 'Tutup cabang' : 'Buka cabang') : 'Tidak ada downline'}
                  className={`mt-3.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[3px] border text-[10px] ${
                    hasKids
                      ? 'border-[#B9B2A8] bg-card text-foreground hover:bg-muted'
                      : 'border-transparent bg-transparent text-transparent'
                  }`}
                >
                  {hasKids ? (
                    isOpen ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />
                  ) : null}
                </button>

                <button
                  type="button"
                  onClick={() => onSelect && onSelect(n)}
                  data-testid={`tree-select-${n.member_id}`}
                  className={`flex flex-1 items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    selected ? 'border-primary bg-accent' : 'border-transparent hover:bg-muted/70'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
                      n.active ? 'bg-[#DCEBFB] text-[#2E6FA7]' : 'bg-[#F1EFEC] text-muted-foreground'
                    }`}
                  >
                    <User className="h-5 w-5" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[15px] font-semibold leading-tight text-foreground">
                      {n.name || '-'}
                    </span>
                    <span className="block font-mono text-[13px] leading-tight text-foreground/80">
                      {n.member_id}
                    </span>
                    <span className="block font-mono text-[13px] font-semibold leading-tight text-foreground">
                      APPV: {dec(n.appv)}
                    </span>

                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <RankBadge rank={n.rank} icon />
                      <MembershipBadge membership={n.membership} />
                      <TupoFlame ok={n.tupo_ok} manual={n.tupo_manual} required={n.tupo_required} />
                      {n.child_count ? (
                        <span className="rounded-full border border-[#F6CFCE] bg-[#FDECEC] px-1.5 py-0.5 text-[10px] font-medium text-[#B4322F]">
                          {n.child_count} frontline
                        </span>
                      ) : null}
                      {!n.active ? (
                        <span className="rounded-full border border-[#F6CFCE] bg-[#FDECEC] px-1.5 py-0.5 text-[10px] text-[#B4322F]">
                          Nonaktif
                        </span>
                      ) : null}
                    </span>

                    <span className="mt-1 block font-mono text-[12px] text-muted-foreground">
                      {`PPV ${dec(n.ppv)} / KG ${dec(n.kg)} / AKG ${dec(n.akg)} / TNPV ${dec(n.tnpv)} / ATNPV ${dec(n.atnpv)}`}
                    </span>
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
