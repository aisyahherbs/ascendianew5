import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Label } from './ui/label';
import { useRegions } from '../lib/regions';

const SELECT =
  'h-9 w-full rounded-md border bg-background px-2.5 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

/**
 * Dropdown wilayah bertingkat: Provinsi -> Kabupaten/Kota.
 * Tidak perlu mengetik manual; daftar kota otomatis mengikuti provinsi.
 */
export default function RegionSelect({
  province = '',
  city = '',
  onChange,
  testid = 'region',
  labels = true,
  disabled = false,
  required = false,
  showCity = true,
  errProvince = '',
  errCity = '',
}) {
  const { provinces, regions } = useRegions();
  const cities = regions?.[province] || [];

  const setProvince = (v) => onChange({ province: v, city: '' });
  const setCity = (v) => onChange({ province, city: v });

  return (
    <>
      <div className="grid gap-1">
        {labels ? (
          <Label className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            Provinsi {required ? <span className="text-[hsl(var(--danger))]">*</span> : null}
          </Label>
        ) : null}
        <select
          className={`${SELECT} ${errProvince ? 'input-err' : ''}`}
          value={province || ''}
          disabled={disabled}
          onChange={(e) => setProvince(e.target.value)}
          data-testid={`${testid}-province`}
        >
          <option value="">- Pilih provinsi -</option>
          {(provinces || []).map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {errProvince ? (
          <p className="field-err" data-testid={`${testid}-province-error`}>
            <AlertCircle className="h-3 w-3" /> {errProvince}
          </p>
        ) : null}
      </div>
      {showCity ? (
        <div className="grid gap-1">
          {labels ? (
            <Label className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
              Kabupaten / Kota {required ? <span className="text-[hsl(var(--danger))]">*</span> : null}
            </Label>
          ) : null}
          <select
            className={`${SELECT} ${errCity ? 'input-err' : ''}`}
            value={city || ''}
            disabled={disabled || !province}
            onChange={(e) => setCity(e.target.value)}
            data-testid={`${testid}-city`}
          >
            <option value="">{province ? '- Pilih kabupaten/kota -' : 'Pilih provinsi dulu'}</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {errCity ? (
            <p className="field-err" data-testid={`${testid}-city-error`}>
              <AlertCircle className="h-3 w-3" /> {errCity}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/** Filter provinsi tunggal (untuk toolbar daftar). */
export function ProvinceFilter({ value = '', onChange, testid = 'filter-province' }) {
  const { provinces } = useRegions();
  return (
    <select
      className="h-9 rounded-md border bg-background px-2.5 text-[13px]"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testid}
    >
      <option value="">Semua provinsi</option>
      {(provinces || []).map((p) => (
        <option key={p} value={p}>{p}</option>
      ))}
    </select>
  );
}
