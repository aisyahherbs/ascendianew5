# Ascendia — Hybrid MLM Backoffice

## STATUS: Restored from GitHub & running on Emergent live preview (31 Aug 2026)

- Source: `github.com/aisyahherbs/ascendianew` (branch `main`, HEAD `48ba364`)
- Commits restored: `48ba364` Auto-generated changes, `fae0cb8` Katalog Produk Bergambar + Stok, `af7b987` Website MLM Hybrid MVP, `da741b2` Initial commit
- Dependencies installed: pip (`backend/requirements.txt`) + yarn (`frontend/package.json`)
- Services: backend + frontend RUNNING under supervisor; MongoDB fresh (data is NOT stored in git)
- Verified: `backend_test.py` 56/56 pass, all 13 admin pages + all member pages render, RBAC enforced, 0 console errors
- Fixed during restore: `backend_test.py` BASE_URL now reads `TEST_BASE_URL` env (was hardcoded to old preview URL); hid `Omset` menu from member role in `AppShell.jsx`
- Credentials: see `/app/memory/test_credentials.md` (ADMIN/admin123, MB00001/123456)

---

## PHASE: Pengelolaan Massal, Pohon Baru, Tupo Manual, Payout (SELESAI 31 Agu 2026)

Semua 8 permintaan terpasang & lulus uji (backend 75/75, frontend 100%, 0 bug):
1. **Checkbox massal** — `Member` & `Admin & Stokis`: pilih banyak baris → Aktifkan / Nonaktifkan / Hapus / Tandai Tupo / Batalkan Tupo. API: `POST /api/members/bulk/status`, `POST /api/members/bulk/delete` (per-ID hasil sukses/gagal + alasan).
2. **Pohon jaringan baru** (`components/NetworkTree.jsx`) — garis panduan vertikal, tombol [+]/[−], avatar, NAMA, ID, `APPV: x,xx`, badge peringkat + membership + ikon api Tupo + chip frontline, baris `PPV / KG / AKG / TNPV / ATNPV`. Engine kini mengekspos `ku, kg, aku, akg`.
3. **Tupo manual** — koleksi `tupo_overrides` + `MemberIn.tupo_override`; TIDAK menambah omset. API `GET/POST /api/tupo`.
4. **Dropdown wilayah** — `backend/regions.py`: 38 provinsi + 514 kabupaten/kota; `GET /api/regions`; komponen `RegionSelect` bertingkat dipakai di form tambah, form ubah, dan profil di Pengaturan.
5. **Hirarki diperbaiki** — `scope_query`/`assert_can_manage`: Admin Provinsi membawahi Stokis di provinsinya (+ member stokis tsb); Stokis hanya member sendiri, tidak boleh hapus/tutup buku/ubah pengaturan. Tab **Struktur Organisasi** (`GET /api/hierarchy`).
6. **Halaman Payout & Omset** (`/payout`) — omset masuk, bonus per jenis, `% payout = bonus/omset x 100`, `% sisa perusahaan`, fee stokis, rincian per periode/produk/penerima, tanggal + bulan + tahun + periode. API `GET /api/payout?mode=&key=`.
7. **Edit nama** — `PUT /api/me` (nama sendiri), dialog ubah data member, nama + tagline perusahaan di Pengaturan (tampil di sidebar & halaman login via `GET /api/public/company`).
8. **Filter tanggalan** — komponen `PeriodFilter`: Per Periode (P1/P2), 1 Bulan Penuh, 1 Tahun Penuh — dipakai di Payout, Laporan Bonus, dan Omset. Backend `core.resolve_range()`.

---

# STATUS (update terakhir)

- Phase 1 (POC mesin bonus): **SELESAI** - /app/poc_bonus_engine.py, 43/43 assertion PASS (semua contoh di spesifikasi: sponsor 1.900/3.800 BV, pasangan 45.000 BV + sisa 200.000 PV, prestasi 62.500 BV, bimbingan kompresi, kepemimpinan generasi, tupo, placement, peringkat, membership).
- Phase 2 (Aplikasi penuh): **SELESAI** - backend (core.py, engine.py, mlm_service.py, routes_people.py, routes_ops.py, server.py) + frontend (14 halaman). Testing agent: backend 36/36 lulus, frontend semua halaman lulus, tanpa bug.
- Phase 3a (Katalog Produk Bergambar + Stok): **SELESAI** - foto produk (unggah terkompres/URL), kategori, satuan, batas stok minimum; halaman Stok per gudang pusat & stokis (masuk/keluar/opname/transfer + riwayat mutasi); stok otomatis berkurang saat input omset berbasis produk dan kembali saat transaksi dihapus. Testing agent: backend 56/56 lulus, frontend semua lulus, 0 bug.
- Phase 3 lanjutan: belum dimulai. Kandidat: export Excel, notifikasi WhatsApp, riwayat audit, pembayaran bonus/withdraw, upload bukti transfer, dashboard provinsi lebih detail, laporan pajak.

---

# plan.md

## 1) Objectives
- Prove the **bonus calculation engine** is correct in isolation (all 7 bonuses, 2 trees, caps, carry, compression, tupo, membership/rank rules) **before** building the web app.
- Build a **FastAPI + MongoDB (motor)** backend with roles: **admin_pusat, admin_provinsi, stokis, member**, plus member portal and admin backoffice.
- Build a **React + Tailwind + shadcn/ui** frontend: admin dashboards, member dashboards, network viewer (sponsor/placement), tutup buku workflow, bonus reports, and a simulator.

## 2) Implementation Steps

### Phase 1 — Core Engine POC (single Python file, no DB/web)
**User stories (POC)**
1. As an operator, I can define members, sponsor links, and placement links so I can simulate real network structures.
2. As an operator, I can input transactions with PV + type (Perkembangan/Penjualan) per period so I can reproduce cases.
3. As an operator, I can run “close period” and get per-member bonus breakdown so I can validate calculations.
4. As an operator, I can verify carry-over and carry reset rules for Bonus Pasangan across periods.
5. As an operator, I can verify tupo blocks all bonuses except Bonus Sponsor.

**Steps**
- Web search quick references for: rank-differential roll-up patterns, leadership generation compression patterns, and best practices for deterministic bonus engines.
- Create `poc_bonus_engine.py` (single file) implementing:
  - Data model (in-memory): Member, SponsorTree, PlacementTree, Transactions, Period.
  - Metrics: PPV, APPV, TNPV, ATNPV, KU/KG, GPV.
  - Membership logic: Bronze/Silver/Gold/Platinum; include Platinum via **(a)** APPV 19k, **(b)** single 19k, **(c)** Gold + 2 frontline Gold (placement allowed).
  - Rank logic: Member→VIP→Royal Star→Crown Star→Leader Ambassador→Leader Majestic→Director→Executive Director using APPV/ATNPV/KG + 3 legs rules.
  - Tupo logic from **Penjualan personal PV** only; enforce on all bonuses except Sponsor.
  - Bonus Sponsor: sponsor-tree, no pass-up.
  - Bonus Pasangan: placement-tree legs; sort legs by perkembangan PV; pair top-2; remainder carry by leg; carry reset to 0 if no pairing bonus that period; apply membership caps and Majestic+ 50jt cap.
  - Bonus Bimbingan: 3% of downline pairing bonus with **generation compression** (skip nodes without pairing bonus); depth by membership; requires own pairing bonus.
  - Bonus Prestasi: sponsor-tree **rank differential** on Penjualan TNPV with roll-up/compression; ensure example yields **62,500 BV**.
  - Bonus Kepemimpinan: for Crown Star+; generation rates to 10 gens with Crown Star compression (only count qualified crown-star nodes; skip non-qualified).
  - Sharing Profit pool (3% of total PV/BV omzet): Director share pool 2%, Exec Director pool 1%, split equally among qualifiers.
  - Special Reward pool (2%): compute pool amount and allocate via simple equal split among configured qualifier ranks (keep configurable in POC).
- Add deterministic fixtures to validate worked examples:
  - Sponsor example: Bronze recruits Platinum → 1.9jt; Platinum recruits Platinum → 3.8jt.
  - Pasangan example: Platinum legs 500k & 300k perkembangan → 45,000 BV, carry 200k.
  - Prestasi example: Leader Ambassador with 2 Crown Star legs 500k + 2 Royal Star legs 150k/100k → 62,500 BV.
  - Additional fixtures: bimbingan compression, kepemimpinan gens, tupo blocking, placement note (C placed under A: counts for A pairing only, not A rank/prestasi).
- Output: console report (per member) + assertion checks; do not proceed until all assertions pass.

**Success criteria (Phase 1)**
- POC script runs clean with assertions passing for all examples + edge cases (carry reset, caps, compression, tupo).

### Phase 2 — V1 App (backend + frontend around proven engine; minimal but complete flow)
**User stories (V1)**
1. As admin_pusat, I can create/disable/delete users (admin provinsi/stokis/member) and reset their passwords.
2. As stokis, I can register a member (sponsor + placement + stokis assignment) and set an initial password.
3. As admin_provinsi/stokis, I can input omzet transactions with type (Perkembangan/Penjualan) and date/period.
4. As admin_pusat, I can run tutup buku for a period and generate immutable bonus results + per-member statements.
5. As a member, I can log in and view my bonuses, tupo status, and trees (sponsor vs placement).

**Backend (FastAPI + MongoDB)**
- Project setup: FastAPI, motor, pydantic v2, JWT auth; all routes under `/api`.
- Collections:
  - `users` (id, role, password_hash, status, province, stokis_id)
  - `members` (profile, sponsor_id, placement_parent_id, placement_frontline_of, join_date)
  - `products` (optional catalog; name, price, pv, type)
  - `transactions` (member_id, pv, type, date, period_id, created_by)
  - `periods` (start/end, close_at, status)
  - `bonus_runs` (period_id, run_at, config_snapshot, results)
  - `pairing_carry` (member_id, leg_id, carry_pv) (or embedded in member)
  - `settings` (rates, caps, dates, reward allocation)
- Services:
  - Engine module ported from POC (pure functions) + adapter reading/writing Mongo.
  - Period closing endpoint: validate not closed → compute → store results snapshot → lock period.
- RBAC:
  - admin_pusat: all endpoints.
  - admin_provinsi: CRUD within province, cannot delete admin_pusat.
  - stokis: create members under own stokis; input transactions for own scope.
  - member: read-only own data + network views.

**Frontend (React)**
- Auth screens: login by ID+sandi; role-based routing.
- Admin backoffice:
  - Member management (create, deactivate/reactivate, reset password).
  - Transaction entry (manual PV + type; optional product pick).
  - Period management + “Run Tutup Buku”.
  - Bonus reports (table + drilldown statement).
- Member portal:
  - Dashboard: rank, membership, PPV/APPV, tupo, bonus summary.
  - Network viewer toggle: Sponsor tree vs Placement tree.
- Minimal simulator page: input a small scenario JSON/form → run engine in backend → show computed bonuses (no DB write).

**Testing (end of Phase 2)**
- One end-to-end pass: create users → create members with sponsor/placement → input tx → close period → member views statement.

**Success criteria (Phase 2)**
- Period close produces stable, repeatable results matching engine; role restrictions enforced; member can view correct statements and trees.

### Phase 3 — Expansion + hardening
**User stories (Expansion)**
1. As admin_pusat, I can export bonus statements and summaries to CSV/Excel.
2. As admin_pusat, I can edit settings (rates/caps/tupo thresholds/period dates) with versioned snapshots.
3. As stokis, I can see bonuses payable to me as intermediary for my registered members.
4. As a member, I can see historical periods and carry-over history for pairing.
5. As admin_provinsi, I can audit all transactions created by stokis in my province.

**Steps**
- Add statement documents per period (line items per bonus, with formulas/inputs shown).
- Add settings UI + config snapshotting per bonus_run.
- Add intermediary payout logic for stokis (define rules: %/fixed/override; implement configurable).
- Improve tree visualization (lazy loading, search by ID/name).
- Add automated test suite for engine + API (pytest) and seed data.

**Success criteria (Phase 3)**
- Exports, settings versioning, intermediary payouts, and history views work without breaking Phase 2 flows.

## 3) Next Actions
1. Implement Phase 1 `poc_bonus_engine.py` with fixtures + assertions for all worked examples.
2. Confirm any ambiguous rules during POC (Prestasi roll-up details, Kepemimpinan base value, Reward allocation qualifiers).
3. After POC passes: scaffold FastAPI+React repos and port engine into backend service.

## 4) Success Criteria
- Engine correctness proven in isolation (examples + edge cases) and remains deterministic when integrated.
- App supports all roles with correct permissions, can run tutup buku twice monthly, and produces auditable bonus statements.
- Member portal accurately displays sponsor vs placement effects (pairing vs rank/prestasi) and tupo gating.
---

## Status Update — Penyesuaian Peran, Pengumuman & Tampilan (selesai)

### Selesai & lulus uji (testing agent: backend 33/33, frontend 100%, 0 bug)
1. **Form tambah/ubah pengguna adaptif per peran**
   - `member`: sponsor*, placement, stokis, provinsi*, kota*, PV & jenis omset pendaftaran
   - `stokis`: hanya nama*, no HP*, provinsi*, kota* (otomatis di bawah Admin Provinsi wilayah tsb)
   - `admin_provinsi`: nama*, no HP*, provinsi* (tanpa kota, tanpa PV, tanpa stokis)
   - `admin_pusat`: nama*, no HP*
2. **Validasi ketat** — backend menolak (400) bila kolom wajib kosong / provinsi-kota tidak valid;
   frontend memblok submit + error inline + toast.
3. **Peran non-member keluar dari jaringan** — `sponsor_id/placement_id/stokis_id` dipaksa null,
   mesin bonus (`mlm_service._members_in`) hanya memproses `role == "member"`.
   Sponsor/placement wajib berperan member. Member pertama boleh tanpa sponsor (akar jaringan).
4. **Fee stokis masuk total payout** — `GET /api/payout` menambah `total_payout_bv`,
   `total_payout_percent`; `company_bv = omset - (bonus + fee)`. Per periode ada `stokis_fee_bv`
   dan `total_payout_bv`. UI Payout punya kartu Fee Stokis + Total Dikeluarkan + baris rumus.
5. **Halaman Pengumuman & Berita** (`/announcements`) — kategori pengumuman/promo/reward/penting/berita,
   sematkan, terbitkan/draf, target peran, gambar opsional. Widget "Pengumuman Terbaru" di Dashboard.
   Endpoint: `GET/POST/PUT/DELETE /api/announcements`.
6. **Ubah membership & peringkat tanpa PV** — `POST /api/members/{id}/grade` + `GET /api/grades`
   (khusus Admin Pusat). Disimpan sebagai `override_membership` / `override_rank`, dipakai
   `engine.MemberIn.membership_force / rank_force`. APPV tidak berubah. Bisa direset ke otomatis.
7. **Tampilan lebih berwarna & compact** — token warna baru (info/success/warning/danger,
   7 warna bonus, 5 warna kategori), sidebar gelap dengan grup menu, kartu KPI bertint + strip warna,
   tabel zebra + header sticky, tinggi kontrol h-9, radius 0.625rem.

### Catatan
- Sponsor/placement lama yang menunjuk ke akun admin sudah dibersihkan menjadi null.
- Login uji: `ADMIN / admin123` (lihat `/app/memory/test_credentials.md`).

---

## Status Update — Nonaktifkan Jenis Bonus & Tutup Halaman (selesai, diuji 37/37 backend + 100% frontend)

### Keputusan user
- "Nonaktifkan jenis bonus" = **tidak dihitung sama sekali** (0 BV, tanpa baris rincian) dan **member tidak tahu** admin menonaktifkannya (senyap/rahasia).
- Cakupan penonaktifan bonus: **dua-duanya** — global untuk semua member + per member (bisa massal).
- Penutupan halaman: **halaman tertentu**, bisa **massal** (per peran / banyak pengguna sekaligus) dan **khusus pengguna yang dipilih**.

### Implementasi backend
- `core.py`: `BONUS_TYPES` (7 jenis), `PAGES` (12 halaman; Dashboard & Pengaturan tidak bisa ditutup),
  `effective_bonus_disabled()`, `effective_blocked_pages()`, `assert_page()/assert_any_page()` (role-aware),
  `strip_secrets()` (menyembunyikan `bonus_disabled`, `access_set_by`, `access_set_at`).
  Setting baru: `bonus_disabled_global`, `pages_blocked_global` (hanya terbaca Admin Pusat).
- `engine.py`: `MemberIn.bonus_disabled` + fungsi `off()`; dipakai di 7 blok bonus.
  Pada Prestasi selisih peringkat tetap "terpakai" (upline lain tidak kebagian porsi ekstra);
  pada Sharing Profit & Reward pembagi pool tidak berubah, hanya yang dinonaktifkan tidak dibayar.
- `mlm_service.py`: gabungkan global + per member ke setiap `MemberIn`.
- Endpoint baru: `GET /api/access/options`, `GET /api/access/member/{id}`, `POST /api/members/bulk/access`
  (`bonus_disabled`, `blocked_pages`, `clear_bonus`, `clear_pages`) — khusus Admin Pusat.
- Enforcement 403 pada: members, announcements, network/hierarchy, transactions, bonus (runs/preview),
  payout, statement/history, products, stock, simulator, plan. `/api/dashboard` & `/api/periods` selalu terbuka.

### Implementasi frontend
- `lib/auth.jsx` menyimpan `blockedPages` dari login/`/auth/me`; `App.js` route guard (redirect senyap ke Dashboard);
  `AppShell` menyembunyikan menu yang ditutup.
- `components/AccessDialog.jsx`: dialog satu pengguna & massal (bonus + halaman, badge "Global" untuk yang dikunci pengaturan).
- `pages/Members.jsx`: ikon perisai per baris + tombol massal "Bonus & Akses" + badge `x bonus off` / `x halaman`.
- `pages/Users.jsx`: penutupan halaman untuk Admin Provinsi & Stokis.
- `pages/SettingsPage.jsx`: kartu "Nonaktifkan Jenis Bonus (semua member)" + matriks "Tutup Halaman per Peran".

### Uji
- `python3 /app/test_access_bonus.py` -> 37/37 lulus (termasuk uji kerahasiaan & 403).
- Testing agent: backend 100%, frontend 100%, 0 bug. Data uji sudah dihapus, pengaturan global dikembalikan kosong.

---

## Status Update — Repo Dipulihkan & App Berjalan (1 Sep 2026)

- Repo GitHub `aisyahherbs/ascendianew3` (private) berhasil dihubungkan & di-clone.
- Commit terakhir: `31c08c4 Auto-generated changes` — berisi fitur **Simulasi Tambah Member**
  (`backend/routes_ops.py` POST /api/simulator/add-members, `frontend/src/pages/SimAddMembers.jsx`,
  tab baru di `Simulator.jsx`, `backend/models.py`). Commit ini **belum sempat diringkas**
  (proses terpotong), tetapi laporan uji `test_reports/iteration_7.json` menunjukkan
  **backend 18/18 lulus, frontend 11/12, 0 bug kritis** — fitur berfungsi & tidak menyimpan data apa pun.
- Seluruh kode dipulihkan ke `/app` (kecuali `.env` yang dipertahankan), dependencies backend (pip)
  & frontend (yarn) terinstal, supervisor backend+frontend RUNNING.
- Verifikasi manual: `/api/` 200, login ADMIN/admin123 sukses, Dashboard & halaman Simulator
  (2 tab: Simulasi Tambah Member + Skenario Manual) tampil normal di live preview.
- Database saat ini hanya berisi akun `ADMIN` (data uji dihapus pada commit sebelumnya).

### Backlog berikutnya (dari Next Action Items commit terakhir)
1. Pulihkan data awal (member MB00001 + transaksi 19.000 PV) untuk uji perhitungan bonus.
2. Riwayat perubahan (audit log) untuk penonaktifan bonus & penutupan halaman.
3. Jadwal otomatis (rentang tanggal) untuk bonus off / halaman tertutup.
4. Impor data massal Excel/CSV untuk member & omset.

### Fitur "Simulasi Tambah Member" — SELESAI & lulus uji pada DB kosong (iteration_8)
- Backend 28/28 lulus, Frontend 20/21, **0 bug**.
- Terverifikasi: sponsor kosong -> SIM0001 akar; penempatan biner maks 2 kaki rata dari atas;
  dua kolom omset (perkembangan + penjualan); membership & peringkat ditetapkan manual (override);
  validasi 400 (count 0/501, PV negatif, membership/rank tak dikenal, sponsor tak ada); non-admin 403;
  **tidak ada data tersimpan** (users tetap 1, transactions tetap 0, tidak ada member_id SIM*).
- UI: 4 kartu KPI, tabel Dampak per Member, Komposisi Bonus, Rincian Rumus per baris,
  tabel Struktur Penempatan Member Simulasi, tombol Reset, tab Skenario Manual (lama) tetap normal.

---

## Status Update — Simulasi Bertingkat, Bonus per Member & Pohon Jaringan (selesai, 100% lulus uji)

### Permintaan user
"Untuk simulasi saya mau bisa menampilkan bonus masing-masing member juga, serta struktur sponsor
dan placement-nya, dan tidak sekali pakai — habis buat 1 simulasi dengan 4 new member, lalu mau
buat 4 new member lagi untuk masing-masing new member sebelumnya, dan seterusnya."

### Backend (`models.py`, `routes_ops.py`)
- Model baru `SimExistingMember`; `SimAddMembersIn` menambah `existing_sim`, `mode`
  (`single` | `per_member`), `targets`, `batch`, `include_unchanged`.
- `POST /api/simulator/add-members` ditulis ulang:
  - **Baseline = jaringan nyata + SELURUH member simulasi batch sebelumnya**, sehingga
    "kenaikan bonus" yang ditampilkan adalah dampak batch ini saja.
  - Mode `per_member`: setiap induk terpilih mendapat `count` downline baru (total dibatasi 500).
  - ID berlanjut otomatis (SIM0001, SIM0005, SIM0021, ...) tanpa tabrakan antar batch.
  - Penempatan biner seimbang (maks 2 kaki) tetap dijaga di setiap batch.
  - `count = 0` diizinkan bila `existing_sim` terisi -> **hitung ulang** tanpa menambah member.
  - Respons baru: `sim_members` (akumulasi untuk batch berikutnya), `nodes` (simpul pohon +
    bonus/omset/membership/peringkat per member), `prior_sim_count`, `total_sim_count`,
    `per_induk`, `mode`, `targets`; `assignments` menambah `induk`; `results` menambah
    `sponsor_id`, `placement_id`, `batch`, `is_batch_baru`.
- Tetap **nol penyimpanan**: users tetap 1 (ADMIN), transactions tetap 0, tidak ada `SIM*` di DB.

### Frontend (`pages/SimAddMembers.jsx`, `components/SimTree.jsx` baru)
- Pemilih **cara menambah**: "Satu induk" / "Untuk masing-masing member".
- Pemilih **induk**: member batch terakhir / semua member simulasi / pilih sendiri (centang,
  bisa menambah member nyata sebagai induk).
- **Riwayat batch** (chip per batch + total member simulasi) dengan tombol
  **Hapus batch terakhir** dan **Hitung ulang**.
- **Struktur Jaringan & Bonus per Member**: pohon bisa dilipat, dua tab **Pohon Placement** /
  **Pohon Sponsor**, tiap simpul menampilkan ID, batch, membership, peringkat, omset,
  bonus BV + Rupiah, selisih, dan jumlah kaki langsung; klik simpul -> Rincian Rumus.
- Tabel **Bonus per Member** menambah kolom Sponsor & Placement, badge batch, dan opsi
  "Tampilkan semua member nyata".
- Sponsor/Placement pada mode "Satu induk" bisa menunjuk member simulasi batch sebelumnya.

### Uji
- Testing agent iteration_9: **backend 39/39, frontend 17/17, 0 bug (100%)**.
  Alur terverifikasi: batch 1 (4) -> batch 2 (16 = 4x4) -> batch 3 (32 = 16x2) = 52 member simulasi.
