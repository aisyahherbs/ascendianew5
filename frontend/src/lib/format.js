export const rp = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
    .format(Math.round(Number(v || 0)));

export const num = (v, digits = 0) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(Number(v || 0));

/** Selalu 2 angka desimal, gaya Indonesia: 8.381,00 */
export const dec = (v) =>
  new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(v || 0));

export const pv = (v) => `${num(v)} PV`;
export const bv = (v) => `${num(v)} BV`;
export const pct = (v) => `${num(Number(v || 0) * 100, 2)}%`;

export const bulanID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const tanggal = (s) => {
  if (!s) return '-';
  const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s);
  if (isNaN(d)) return s;
  return `${d.getDate()} ${bulanID[d.getMonth()]} ${d.getFullYear()}`;
};

export const periodLabel = (key) => {
  if (!key) return '-';
  const [y, m, p] = key.split('-');
  return `${bulanID[Number(m) - 1]} ${y} · Periode ${String(p).replace('P', '')}`;
};

export const ROLE_LABEL = {
  admin_pusat: 'Admin Pusat',
  admin_provinsi: 'Admin Provinsi',
  stokis: 'Stokis',
  member: 'Member',
};

export const BONUS_LIST = [
  { key: 'bonus_sponsor', label: 'Bonus Sponsor', group: 'Omset Perkembangan' },
  { key: 'bonus_pasangan', label: 'Bonus Pasangan', group: 'Omset Perkembangan' },
  { key: 'bonus_bimbingan', label: 'Bonus Bimbingan', group: 'Omset Perkembangan' },
  { key: 'bonus_prestasi', label: 'Bonus Prestasi', group: 'Omset Penjualan' },
  { key: 'bonus_kepemimpinan', label: 'Bonus Kepemimpinan', group: 'Omset Penjualan' },
  { key: 'bonus_sharing_profit', label: 'Bonus Sharing Profit', group: 'Perusahaan' },
];
