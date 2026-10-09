import React from 'react';
import { CheckSquare, Flame, ShieldOff, Trash2, UserCheck, UserX, X } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Toolbar aksi massal yang muncul saat ada baris tercentang.
 */
export default function BulkBar({
  count,
  onClear,
  onActivate,
  onDeactivate,
  onDelete,
  onTupo,
  onTupoClear,
  onAccess,
  busy,
  testid = 'bulk-bar',
}) {
  if (!count) return null;
  return (
    <div
      className="sticky top-16 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-accent px-3 py-2.5 shadow-sm"
      data-testid={testid}
    >
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <CheckSquare className="h-4 w-4 text-primary" />
        <span data-testid={`${testid}-count`}>{count} dipilih</span>
      </span>

      <div className="ml-auto flex flex-wrap gap-2">
        {onActivate ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={onActivate} data-testid={`${testid}-activate`}>
            <UserCheck className="mr-1 h-3.5 w-3.5" /> Aktifkan
          </Button>
        ) : null}
        {onDeactivate ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={onDeactivate} data-testid={`${testid}-deactivate`}>
            <UserX className="mr-1 h-3.5 w-3.5" /> Nonaktifkan
          </Button>
        ) : null}
        {onTupo ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={onTupo} data-testid={`${testid}-tupo`}>
            <Flame className="mr-1 h-3.5 w-3.5" /> Tandai Tupo
          </Button>
        ) : null}
        {onTupoClear ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={onTupoClear} data-testid={`${testid}-tupo-clear`}>
            <Flame className="mr-1 h-3.5 w-3.5" /> Batalkan Tupo
          </Button>
        ) : null}
        {onAccess ? (
          <Button size="sm" variant="outline" className="border-[hsl(var(--danger)/0.4)] text-[hsl(var(--danger))]"
            disabled={busy} onClick={onAccess} data-testid={`${testid}-access`}>
            <ShieldOff className="mr-1 h-3.5 w-3.5" /> Bonus & Akses
          </Button>
        ) : null}
        {onDelete ? (
          <Button
            size="sm"
            variant="outline"
            className="border-destructive/40 text-destructive"
            disabled={busy}
            onClick={onDelete}
            data-testid={`${testid}-delete`}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Hapus
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onClear} data-testid={`${testid}-clear`}>
          <X className="mr-1 h-3.5 w-3.5" /> Bersihkan
        </Button>
      </div>
    </div>
  );
}

export function Checkbox({ checked, onChange, testid, indeterminate = false, title }) {
  return (
    <input
      type="checkbox"
      title={title}
      checked={!!checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate && !checked;
      }}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      data-testid={testid}
      className="h-4 w-4 cursor-pointer accent-[#0F766E]"
    />
  );
}
