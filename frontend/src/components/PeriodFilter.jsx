import React, { useEffect, useMemo, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { api } from '../lib/api';
import { bulanID } from '../lib/format';

const MODES = [
  { id: 'period', label: 'Per Periode' },
  { id: 'month', label: '1 Bulan Penuh' },
  { id: 'year', label: '1 Tahun Penuh' },
];

const SELECT = 'h-10 rounded-md border bg-background px-2 text-sm text-foreground';

/**
 * Filter tanggalan bersama: Periode 1 / Periode 2 tertentu, 1 bulan penuh,
 * atau 1 tahun penuh. Memanggil onChange({ mode, key }).
 */
export default function PeriodFilter({ value, onChange, testid = 'period-filter' }) {
  const [periods, setPeriods] = useState([]);
  const mode = value?.mode || 'period';
  const key = value?.key || '';

  useEffect(() => {
    api
      .get('/periods')
      .then(({ data }) => {
        setPeriods(data);
        if (!value?.key) {
          const cur = data.find((p) => p.is_current) || data[0];
          if (cur) onChange({ mode: 'period', key: cur.key });
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const years = useMemo(() => {
    const set = new Set(periods.map((p) => String(p.year)));
    set.add(String(new Date().getFullYear()));
    return [...set].sort().reverse();
  }, [periods]);

  const now = new Date();
  const [yy, mm] = (key.match(/^(\d{4})-(\d{2})/) || [null, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0')]).slice(1);

  const switchMode = (m) => {
    if (m === mode) return;
    if (m === 'period') {
      const cur = periods.find((p) => p.is_current) || periods[0];
      onChange({ mode: 'period', key: cur?.key || '' });
    } else if (m === 'month') {
      onChange({ mode: 'month', key: `${yy}-${mm}` });
    } else {
      onChange({ mode: 'year', key: String(yy) });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid={testid}>
      <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <CalendarRange className="h-3.5 w-3.5" /> Rentang
      </span>
      <div className="flex rounded-lg border bg-background p-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => switchMode(m.id)}
            data-testid={`${testid}-mode-${m.id}`}
            className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
              mode === m.id ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'period' ? (
        <select
          className={SELECT}
          value={key}
          onChange={(e) => onChange({ mode: 'period', key: e.target.value })}
          data-testid={`${testid}-period-select`}
        >
          {periods.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label} {p.status === 'closed' ? '(ditutup)' : '(berjalan)'}
            </option>
          ))}
        </select>
      ) : null}

      {mode === 'month' ? (
        <>
          <select
            className={SELECT}
            value={String(Number(mm))}
            onChange={(e) => onChange({ mode: 'month', key: `${yy}-${String(e.target.value).padStart(2, '0')}` })}
            data-testid={`${testid}-month-select`}
          >
            {bulanID.map((b, i) => (
              <option key={b} value={i + 1}>
                {b}
              </option>
            ))}
          </select>
          <select
            className={SELECT}
            value={yy}
            onChange={(e) => onChange({ mode: 'month', key: `${e.target.value}-${mm}` })}
            data-testid={`${testid}-month-year-select`}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </>
      ) : null}

      {mode === 'year' ? (
        <select
          className={SELECT}
          value={key}
          onChange={(e) => onChange({ mode: 'year', key: e.target.value })}
          data-testid={`${testid}-year-select`}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              Tahun {y}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
