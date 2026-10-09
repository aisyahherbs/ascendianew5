import React from 'react';
import { AlertTriangle, Award, Flame, Gift, Lock, Medal, Megaphone, Newspaper, ShieldOff, Tag } from 'lucide-react';

/* Catatan: semua kelas warna dituliskan literal (bukan template string) agar
   Tailwind JIT bisa mendeteksi dan menghasilkan CSS-nya. */

const C = {
  neutral: 'bg-muted text-muted-foreground border-border',
  info: 'bg-[hsl(var(--info)/0.14)] text-[hsl(var(--info))] border-[hsl(var(--info)/0.28)]',
  success: 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.3)]',
  warning: 'bg-[hsl(var(--warning)/0.18)] text-[hsl(var(--warning-soft-foreground))] border-[hsl(var(--warning)/0.32)]',
  danger: 'bg-[hsl(var(--danger)/0.14)] text-[hsl(var(--danger))] border-[hsl(var(--danger)/0.28)]',
  orange: 'bg-[hsl(var(--bonus-5)/0.14)] text-[hsl(var(--bonus-5))] border-[hsl(var(--bonus-5)/0.28)]',
  indigo: 'bg-[hsl(var(--bonus-6)/0.14)] text-[hsl(var(--bonus-6))] border-[hsl(var(--bonus-6)/0.28)]',
  plum: 'bg-[hsl(var(--bonus-7)/0.14)] text-[hsl(var(--bonus-7))] border-[hsl(var(--bonus-7)/0.28)]',
  teal: 'bg-[hsl(var(--primary)/0.14)] text-[hsl(var(--primary))] border-[hsl(var(--primary)/0.3)]',
  solidTeal: 'bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]',
};

const RANK_STYLE = {
  Member: C.neutral,
  VIP: C.info,
  'Royal Star': C.success,
  'Crown Star': C.orange,
  'Leader Ambassador': C.indigo,
  'Leader Majestic': C.plum,
  Director: C.warning,
  'Executive Director': C.solidTeal,
};

const MEMBERSHIP_STYLE = {
  None: C.neutral,
  Bronze: 'bg-[#F6E7DA] text-[#7A4322] border-[#E7CBB2]',
  Silver: 'bg-[#EBEFF4] text-[#31465C] border-[#D3DDE8]',
  Gold: C.warning,
  Platinum: C.teal,
};

const base =
  'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold leading-none whitespace-nowrap';

export const RankBadge = ({ rank, className = '', icon = false }) => (
  <span className={`${base} ${RANK_STYLE[rank] || RANK_STYLE.Member} ${className}`} data-testid="rank-badge">
    {icon ? <Medal className="h-3 w-3" /> : null}
    {rank || 'Member'}
  </span>
);

export const MembershipBadge = ({ membership, className = '' }) => (
  <span
    className={`${base} ${MEMBERSHIP_STYLE[membership] || MEMBERSHIP_STYLE.None} ${className}`}
    data-testid="membership-badge"
  >
    {membership === 'None' || !membership ? 'Belum Membership' : membership}
  </span>
);

export const StatusBadge = ({ active }) => (
  <span className={`${base} ${active ? C.success : C.danger}`} data-testid="status-badge">
    {active ? 'Aktif' : 'Nonaktif'}
  </span>
);

export const TupoBadge = ({ ok, required, manual }) => (
  <span className={`${base} ${ok ? C.success : C.warning}`} data-testid="tupo-badge">
    <Flame className="h-3 w-3" />
    {ok ? `Tupo OK${manual ? ' (manual)' : ''}` : `Tupo belum (${required || 0} PV)`}
  </span>
);

/** Ikon api ringkas untuk pohon jaringan: menyala = Tupo terpenuhi. */
export const TupoFlame = ({ ok, manual, required }) => (
  <span
    title={ok ? (manual ? 'Tupo ditandai manual oleh admin' : 'Tupo terpenuhi') : `Tupo belum terpenuhi (butuh ${required || 0} PV penjualan)`}
    className={`inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 ${
      ok ? 'text-[hsl(var(--bonus-5))]' : 'text-muted-foreground/45'
    }`}
    data-testid="tupo-flame"
  >
    <Flame className="h-4 w-4" fill={ok ? 'currentColor' : 'none'} />
    {manual ? <span className="text-[9px] font-semibold uppercase">M</span> : null}
  </span>
);

export const RoleBadge = ({ role }) => {
  const map = {
    admin_pusat: ['Admin Pusat', C.solidTeal],
    admin_provinsi: ['Admin Provinsi', C.info],
    stokis: ['Stokis', C.warning],
    member: ['Member', 'bg-muted text-foreground border-border'],
  };
  const [label, cls] = map[role] || map.member;
  return <span className={`${base} ${cls}`} data-testid="role-badge">{label}</span>;
};

/** Warna khas untuk 7 jenis bonus (dipakai di grafik & tabel). */
export const BONUS_COLORS = [
  'hsl(var(--bonus-1))', 'hsl(var(--bonus-2))', 'hsl(var(--bonus-3))', 'hsl(var(--bonus-4))',
  'hsl(var(--bonus-5))', 'hsl(var(--bonus-6))', 'hsl(var(--bonus-7))',
];

export const BonusDot = ({ index = 0, className = '' }) => (
  <span
    className={`inline-block h-2 w-2 shrink-0 rounded-full ${className}`}
    style={{ backgroundColor: BONUS_COLORS[index % BONUS_COLORS.length] }}
  />
);

export const CATEGORY_META = {
  pengumuman: { label: 'Pengumuman', icon: Megaphone, cls: C.info, dot: 'hsl(var(--announce-pengumuman))' },
  promo: { label: 'Promo', icon: Tag, cls: C.orange, dot: 'hsl(var(--announce-promo))' },
  reward: { label: 'Reward', icon: Gift, cls: C.warning, dot: 'hsl(var(--announce-reward))' },
  penting: { label: 'Penting', icon: AlertTriangle, cls: C.danger, dot: 'hsl(var(--announce-penting))' },
  berita: { label: 'Berita', icon: Newspaper, cls: C.indigo, dot: 'hsl(var(--announce-berita))' },
};

export const CategoryBadge = ({ category = 'pengumuman', className = '' }) => {
  const meta = CATEGORY_META[category] || CATEGORY_META.pengumuman;
  const Icon = meta.icon;
  return (
    <span
      className={`${base} ${meta.cls} ${className}`}
      data-testid={`announcement-category-badge-${category}`}
    >
      <Icon className="h-3 w-3" /> {meta.label}
    </span>
  );
};

export const OverrideBadge = ({ children = 'Manual' }) => (
  <span className={`${base} ${C.indigo}`} data-testid="override-badge" title="Ditetapkan manual oleh Admin Pusat">
    <Award className="h-3 w-3" /> {children}
  </span>
);

/** Jumlah jenis bonus yang dinonaktifkan untuk member (hanya terlihat Admin Pusat). */
export const BonusOffBadge = ({ count = 0, titleText = '' }) => (
  <span className={`${base} ${C.danger}`} data-testid="bonus-off-badge" title={titleText || `${count} jenis bonus dinonaktifkan`}>
    <ShieldOff className="h-3 w-3" /> {count} bonus off
  </span>
);

/** Jumlah halaman yang ditutup untuk pengguna (hanya terlihat Admin Pusat). */
export const PageLockBadge = ({ count = 0, titleText = '' }) => (
  <span className={`${base} ${C.warning}`} data-testid="page-lock-badge" title={titleText || `${count} halaman ditutup`}>
    <Lock className="h-3 w-3" /> {count} halaman
  </span>
);
