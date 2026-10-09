import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { MembershipBadge, RankBadge } from './Badges';
import { num, rp } from '../lib/format';

/**
 * Pohon jaringan hasil simulasi (sponsor atau placement).
 * Setiap simpul menampilkan bonus member tersebut supaya bonus per member langsung terlihat.
 */
function buildTree(nodes, parentKey) {
  const byId = new Map();
  nodes.forEach((n) => byId.set(n.member_id, n));
  const kids = new Map();
  const roots = [];
  nodes.forEach((n) => {
    const p = n[parentKey];
    if (p && byId.has(p) && p !== n.member_id) {
      const arr = kids.get(p) || [];
      arr.push(n);
      kids.set(p, arr);
    } else {
      roots.push(n);
    }
  });
  kids.forEach((arr) => arr.sort((a, b) => String(a.member_id).localeCompare(String(b.member_id))));
  roots.sort((a, b) => String(a.member_id).localeCompare(String(b.member_id)));
  return { kids, roots };
}

const TONE_NEW = 'border-[hsl(var(--success)/0.55)] bg-[hsl(var(--success)/0.1)]';
const TONE_OLD = 'border-[hsl(var(--info)/0.5)] bg-[hsl(var(--info)/0.08)]';
const TONE_REAL = 'border-border bg-muted';

function toneOf(node) {
  if (node.is_batch_baru) return TONE_NEW;
  if (node.is_simulasi) return TONE_OLD;
  return TONE_REAL;
}

function deltaClass(v) {
  if (v > 0) return 'font-mono font-semibold text-[hsl(var(--success))]';
  if (v < 0) return 'font-mono font-semibold text-[hsl(var(--danger))]';
  return 'font-mono';
}

function flatten(roots, kids, collapsed) {
  const out = [];
  const walk = (list, depth) => {
    list.forEach((n) => {
      const children = kids.get(n.member_id) || [];
      out.push({ node: n, depth, childCount: children.length });
      if (children.length && !collapsed.has(n.member_id)) walk(children, depth + 1);
    });
  };
  walk(roots, 0);
  return out;
}

export default function SimTree({
  nodes = [], parentKey = 'placement_id', onSelect, selected, testid,
}) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const { kids, roots } = useMemo(() => buildTree(nodes, parentKey), [nodes, parentKey]);
  const flat = useMemo(() => flatten(roots, kids, collapsed), [roots, kids, collapsed]);

  const toggle = (id) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsed(next);
  };

  if (!nodes.length) {
    return (
      <p className="p-4 text-[12.5px] text-muted-foreground">
        Belum ada struktur untuk ditampilkan.
      </p>
    );
  }

  return (
    <div className="grid gap-1 p-2.5" data-testid={testid}>
      <div className="mb-1 flex flex-wrap gap-3 text-[10.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <i className={'inline-block h-2.5 w-2.5 rounded border ' + TONE_NEW} />
          Batch terakhir
        </span>
        <span className="inline-flex items-center gap-1">
          <i className={'inline-block h-2.5 w-2.5 rounded border ' + TONE_OLD} />
          Batch sebelumnya
        </span>
        <span className="inline-flex items-center gap-1">
          <i className={'inline-block h-2.5 w-2.5 rounded border ' + TONE_REAL} />
          Member nyata
        </span>
        <span>Klik simpul untuk melihat rincian rumus bonusnya.</span>
      </div>

      {flat.map((item) => {
        const n = item.node;
        const open = !collapsed.has(n.member_id);
        const ring = selected === n.member_id ? ' ring-2 ring-[hsl(var(--primary))]' : '';
        const arrowCls = 'mt-2 h-4 w-4 shrink-0 text-muted-foreground'
          + (item.childCount ? '' : ' invisible');
        return (
          <div key={n.member_id} className="flex items-start gap-1"
            style={{ paddingLeft: item.depth * 18 }}>
            <button type="button" className={arrowCls} onClick={() => toggle(n.member_id)}
              data-testid={'simtree-toggle-' + n.member_id}>
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => onSelect && onSelect(n.member_id)}
              className={'flex-1 rounded-lg border px-2.5 py-1.5 text-left ' + toneOf(n) + ring}
              data-testid={'simtree-node-' + n.member_id}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-mono text-[11.5px] font-semibold">{n.member_id}</span>
                {n.is_simulasi ? (
                  <span className="rounded bg-[hsl(var(--info)/0.2)] px-1.5 py-[1px] text-[9.5px] font-semibold uppercase tracking-wide">
                    Batch {n.batch || 1}
                  </span>
                ) : (
                  <span className="rounded bg-[hsl(var(--warning)/0.25)] px-1.5 py-[1px] text-[9.5px] font-semibold uppercase tracking-wide">
                    Member nyata
                  </span>
                )}
                <MembershipBadge membership={n.membership} />
                <RankBadge rank={n.rank} />
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] text-muted-foreground">
                <span>Omset {num(n.ppv)} PV</span>
                <span className="font-mono font-semibold text-foreground">
                  Bonus {num(n.total_bonus_bv)} BV
                </span>
                <span className="font-mono">{rp(n.total_bonus_rp)}</span>
                {n.delta_bv ? (
                  <span className={deltaClass(n.delta_bv)}>
                    {n.delta_bv > 0 ? '+' : ''}{num(n.delta_bv)} BV
                  </span>
                ) : null}
                <span>{item.childCount} kaki langsung</span>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
