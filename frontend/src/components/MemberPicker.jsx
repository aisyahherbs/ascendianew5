import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Input } from './ui/input';

/**
 * Pemilih pengguna dengan pencarian (ID + nama).
 * Prop `role` membatasi hasil ke peran tertentu, mis. "member" atau "stokis",
 * supaya admin/stokis tidak pernah muncul sebagai sponsor / placement.
 */
export default function MemberPicker({
  value, onChange, role, placeholder = 'Cari ID atau nama...',
  testid = 'member-picker', invalid = false, disabled = false,
}) {
  const [q, setQ] = useState(value || '');
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => { setQ(value || ''); }, [value]);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      if (!open) return;
      try {
        const { data } = await api.get('/members/options', {
          params: { q: q || undefined, role: role || undefined, limit: 20 },
        });
        if (alive) setRows(data);
      } catch (e) { /* ignore */ }
    }, 200);
    return () => { alive = false; clearTimeout(t); };
  }, [q, open, role]);

  return (
    <div className="relative">
      <Input
        className={`h-9 font-mono text-[13px] ${invalid ? 'input-err' : ''}`}
        value={q}
        disabled={disabled}
        placeholder={placeholder}
        data-testid={`${testid}-input`}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value.toUpperCase());
          onChange(e.target.value.toUpperCase());
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {open && rows.length > 0 ? (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-card shadow-lg">
          {rows.map((r) => (
            <button
              type="button"
              key={r.member_id}
              data-testid={`${testid}-option-${r.member_id}`}
              className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[13px] hover:bg-accent/60"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(r.member_id);
                setQ(r.member_id);
                setOpen(false);
              }}
            >
              <span className="font-mono text-[11px] text-primary">{r.member_id}</span>
              <span className="flex-1 truncate">{r.name}</span>
              <span className="text-[10.5px] text-muted-foreground">{r.stat_rank || r.role}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
