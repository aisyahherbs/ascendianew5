# PRD — Ascendia MLM Backoffice

## Problem Statement (asli, bahasa Indonesia)
Import project dari GitHub `https://github.com/aisyahherbs/ascendianew4.git` (branch main),
setup + install dependencies, lalu lanjutkan pekerjaan yang terpotong:

> "coba tolong perbaiki lagi untuk placement jika sudah ada member dengan 2 placement,
> tapi rekrut member ke tiga tanpa menulis placement maka otomatis masuk binary bawah nya
> karena maksimal placement itu cuma 2 (otomatis menyeimbangkan), kecuali sponsor bisa
> sebanyak nya."

Pilihan user: auto-placement = **turun ke kaki terlemah** (member paling sedikit),
mulai dari **sponsor yang merekrut**, placement manual yang penuh **tidak ditolak**
melainkan otomatis turun, sponsor **tidak dibatasi**.

## Arsitektur
- Frontend: React (CRA + craco) + Tailwind + shadcn/ui, `/app/frontend`
- Backend: FastAPI, `/app/backend` (`server.py`, `core.py`, `engine.py`, `mlm_service.py`,
  `routes_people.py`, `routes_ops.py`, `routes_stock.py`, `regions.py`, `models.py`)
- DB: MongoDB (`MONGO_URL`, `DB_NAME`)
- Semua route backend diawali `/api`

## Persona
- **Admin Pusat** — akses penuh, audit placement, simulator bonus
- **Admin Provinsi** — kelola member di provinsinya
- **Stokis** — daftarkan member, kelola stok
- **Member** — lihat jaringan, omset, bonus

## Core Requirements (statis)
- Pohon **Sponsor** dan pohon **Placement** terpisah
- Placement **BINER**: maksimal 2 kaki per member (`core.BINARY_WIDTH = 2`)
- Sponsor tidak dibatasi jumlahnya
- 7 bonus: Sponsor, Pasangan, Bimbingan, Prestasi, Kepemimpinan, Sharing Profit, Reward
- Tutup buku 2x sebulan (tanggal 11 & 27)

## Sudah diimplementasikan
### 2026-06 (turn ini)
- Project diimport dari GitHub, dependencies backend (`pip install -r requirements.txt`)
  dan frontend (`yarn install`) terpasang, services jalan via supervisor.
- `core.pick_balanced_slot()` **ditulis ulang**: dari BFS level-per-level menjadi
  **descent ke kaki terlemah** berdasarkan ukuran subtree (`placement_subtree_size()`),
  tie-break ID terkecil, aman terhadap `skip` (member yang dipindah) dan siklus.
- `core.resolve_placement()` kini mengembalikan field `jalur` (jalur penurunan) dan
  alasan berbahasa Indonesia yang menjelaskan penurunan ke kaki terlemah.
- `core.placement_path()` baru — menyusun jalur root → slot untuk penjelasan user.
- `GET /api/placement-slot` kini mengembalikan `jalur` dan `jalur_nama`.
- `PlacementHint.jsx` menampilkan "otomatis turun ke kaki terlemah" + jalur penurunan.
- Uji: `/app/test_placement_unit.py` (7/7 lulus), `/app/test_placement_e2e.py` (lulus),
  `/app/backend/tests/test_placement_binary.py` (10/10 lulus dari testing agent).
- Database preview dibersihkan dari data uji.

### 2026-06 (turn ketiga)
- **Payout & Omset kini KHUSUS Admin Pusat**: entri `payout` dihapus dari `core.PAGES`,
  `GET /api/payout` memakai `require_roles("admin_pusat")`, route & menu frontend
  dibatasi ke Admin Pusat. Halaman Laporan Bonus memakai endpoint baru
  `GET /api/bonus/report` (tanpa persentase payout / sisa perusahaan / pool reward).
- **Dashboard Admin Provinsi** tidak lagi memuat data nasional: grafik tren dan KPI
  Fee Perantara Stokis hanya untuk Admin Pusat; ditambah `scope_note` bahwa angka
  hanya mencakup wilayah wewenangnya.
- **Special Reward tidak transparan**: pool 2% tetap dihitung otomatis agar pusat tahu
  dana tersedia dan tidak melebihi payout, TAPI tidak lagi masuk `total_bonus_bv`,
  tidak ada baris rumus di rincian member, dan field `bonus_reward` dihapus dari hasil.
  `core.strip_reward()` menghapus semua data reward dari respons untuk peran non-pusat
  (`/bonus/runs`, `/bonus/preview`, `/bonus/run/{key}`, `/simulator`, `/plan`).
- Halaman baru **`/special-reward`** (Admin Pusat): dana reward, omset, sisa perusahaan,
  sisa setelah reward dibagikan, dana per periode, daftar member yang memenuhi
  kualifikasi + alokasi rata sebagai acuan, dan catatan bahwa pembagian bisa BV/non-BV.
- Diverifikasi: `/app/test_akses_payout_reward.py` lulus semua + testing agent 100%
  (backend 18/18, frontend 32/32).

### 2026-06 (turn kedua)
- **Crash `insertBefore` / NotFoundError diperbaiki**: penyebabnya fitur Terjemahkan
  otomatis Chrome yang mengubah text node sehingga React gagal commit. Ditambahkan
  `<html lang="id" translate="no">`, `<meta name="google" content="notranslate">`,
  dan `#root.notranslate` pada `public/index.html`.
- `components/ErrorBoundary.jsx` baru — menangkap error render, memberi pesan khusus
  bila penyebabnya penerjemah browser, plus tombol "Muat ulang". Dipasang di `App.js`.
- **Typing normal (tidak lagi selalu HURUF BESAR)**: `.toUpperCase()` dihapus dari semua
  `onChange` di `Login.jsx`, `Members.jsx` (ID Member), `MemberPicker.jsx` (Sponsor /
  Placement), `Simulator.jsx` (ID / Sponsor / Placement). Normalisasi uppercase kini
  hanya saat submit (frontend) dan di server (`routes_people.py` sudah `.strip().upper()`).
- Diverifikasi: login dengan `admin` huruf kecil berhasil, pendaftaran member dengan
  sponsor huruf kecil berhasil, 15 halaman load tanpa error (testing agent 100% lulus).

### Sebelumnya (dari repo)
- Auth + RBAC 4 peran, CRUD member, wilayah Indonesia, stok/stokis,
  engine bonus 7 jenis, simulator bertingkat (levels) dengan verifikasi biner,
  audit & perbaikan struktur placement, pohon sponsor & placement.

## Backlog
### P0
- Tidak ada blocker yang diketahui.
### P1
- Ganti sandi admin default `admin123` sebelum dipakai produksi.
- Pencarian/paginasi member untuk jaringan besar (>10k) pada pohon placement.
### P2
- Ekspor laporan bonus ke Excel/PDF.
- Notifikasi otomatis saat member baru masuk di kaki seseorang.

## Next tasks
1. Input data member nyata (atau import massal) lalu jalankan tutup buku pertama.
2. Audit placement setelah import massal (`GET /api/placement-audit`).
3. Verifikasi angka bonus terhadap perhitungan manual perusahaan.
