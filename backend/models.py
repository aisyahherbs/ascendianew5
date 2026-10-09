from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    member_id: str
    password: str


class UserCreate(BaseModel):
    name: str
    role: str = "member"
    member_id: Optional[str] = None
    password: Optional[str] = None
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    province: Optional[str] = ""
    city: Optional[str] = ""
    bank_name: Optional[str] = ""
    bank_account: Optional[str] = ""
    sponsor_id: Optional[str] = None
    placement_id: Optional[str] = None
    stokis_id: Optional[str] = None
    join_date: Optional[str] = None
    # optional initial purchase recorded on registration
    initial_pv: Optional[float] = 0
    initial_pv_kind: Optional[str] = "perkembangan"


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    province: Optional[str] = None
    city: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    sponsor_id: Optional[str] = None
    placement_id: Optional[str] = None
    stokis_id: Optional[str] = None
    role: Optional[str] = None


class PasswordIn(BaseModel):
    password: str


class StatusIn(BaseModel):
    active: bool


class BulkIdsIn(BaseModel):
    member_ids: List[str] = Field(default_factory=list)


class BulkStatusIn(BaseModel):
    member_ids: List[str] = Field(default_factory=list)
    active: bool = True


class TupoIn(BaseModel):
    member_ids: List[str] = Field(default_factory=list)
    period_key: Optional[str] = None
    ok: bool = True            # True = tandai Tupo terpenuhi manual
    clear: bool = False        # True = hapus penandaan, balik ke otomatis
    note: Optional[str] = ""


class ProfileIn(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    province: Optional[str] = None
    city: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None


class ProductIn(BaseModel):
    name: str
    code: Optional[str] = ""
    price: float = 0
    pv: float = 0
    kind: str = "penjualan"  # perkembangan | penjualan
    description: Optional[str] = ""
    active: bool = True
    image: Optional[str] = ""       # data URL atau URL gambar
    category: Optional[str] = ""
    unit: Optional[str] = "pcs"
    min_stock: Optional[float] = 0


class StockAdjustIn(BaseModel):
    product_id: str
    owner_id: str = "PUSAT"
    type: str = "in"               # in | out | set
    qty: float = 0
    note: Optional[str] = ""


class StockTransferIn(BaseModel):
    product_id: str
    from_owner: str = "PUSAT"
    to_owner: str
    qty: float
    note: Optional[str] = ""


class TxIn(BaseModel):
    member_id: str
    kind: str = "penjualan"
    pv: Optional[float] = None
    date: Optional[str] = None
    product_id: Optional[str] = None
    qty: Optional[float] = 1
    note: Optional[str] = ""


class SettingsIn(BaseModel):
    period1_end_day: Optional[int] = None
    period1_close_day: Optional[int] = None
    period2_close_day: Optional[int] = None
    stokis_fee_percent: Optional[float] = None
    company_name: Optional[str] = None
    company_tagline: Optional[str] = None
    engine: Optional[Dict[str, Any]] = None
    # Penonaktifan bonus untuk seluruh member (rahasia dari member)
    bonus_disabled_global: Optional[List[str]] = None
    # Halaman yang ditutup per peran, mis. {"member": ["statement", "network"]}
    pages_blocked_global: Optional[Dict[str, List[str]]] = None


class AccessIn(BaseModel):
    """Admin Pusat mengatur penonaktifan bonus & penutupan halaman per pengguna."""
    member_ids: List[str] = Field(default_factory=list)
    bonus_disabled: Optional[List[str]] = None     # None = tidak diubah
    blocked_pages: Optional[List[str]] = None      # None = tidak diubah
    clear_bonus: bool = False                      # True = aktifkan semua bonus lagi
    clear_pages: bool = False                      # True = buka semua halaman lagi


class SimMember(BaseModel):
    id: str
    name: Optional[str] = ""
    sponsor_id: Optional[str] = None
    placement_id: Optional[str] = None
    membership: Optional[str] = "None"
    rank: Optional[str] = "Member"
    appv_perkembangan: float = 0
    appv: float = 0
    atnpv: float = 0
    carry: Dict[str, float] = Field(default_factory=dict)
    perkembangan_pv: float = 0
    penjualan_pv: float = 0


class SimIn(BaseModel):
    members: List[SimMember]
    period_label: Optional[str] = "Simulasi"


class SimExistingMember(BaseModel):
    """Member simulasi dari batch sebelumnya (dikirim ulang oleh frontend, tidak pernah disimpan)."""
    member_id: str
    name: Optional[str] = None
    sponsor_id: Optional[str] = None
    placement_id: Optional[str] = None
    pv_perkembangan: float = 0
    pv_penjualan: float = 0
    membership: Optional[str] = None
    rank: Optional[str] = None
    tupo_ok: bool = True
    batch: int = 1
    level: int = 1                         # level berantai saat member ini dibuat


class SimAddMembersIn(BaseModel):
    """Simulasi menambah sejumlah member baru TANPA menyimpan data apa pun."""
    sponsor_id: Optional[str] = None       # kosong = member simulasi pertama jadi akar
    placement_id: Optional[str] = None     # kosong = otomatis seimbang (biner)
    count: int = 10
    pv_perkembangan: float = 0
    pv_penjualan: float = 0
    membership: Optional[str] = None       # ditetapkan manual ke semua member simulasi
    rank: Optional[str] = None             # ditetapkan manual ke semua member simulasi
    tupo_ok: bool = True                   # anggap Tupo terpenuhi untuk member simulasi
    include_current_omset: bool = True     # sertakan omset periode berjalan yang sudah ada
    spread_sponsor: bool = False           # True = sponsor juga disebar biner, bukan semua frontline
    # ---------------- simulasi bertingkat (bukan sekali pakai) ----------------
    existing_sim: List[SimExistingMember] = Field(default_factory=list)
    mode: str = "single"                   # "single" = 1 induk | "per_member" = tiap induk dapat N anak
    targets: List[str] = Field(default_factory=list)   # induk untuk mode per_member (ID nyata atau SIM*)
    batch: int = 1                         # nomor batch penambahan ini
    levels: int = 1                        # kedalaman berantai: tiap member baru diberi N anak lagi
    include_unchanged: bool = False         # tampilkan juga member nyata yang bonusnya tidak berubah


class GradeIn(BaseModel):
    """Admin Pusat menetapkan membership / peringkat member secara manual."""
    membership: Optional[str] = None
    rank: Optional[str] = None
    clear: bool = False


class AnnouncementIn(BaseModel):
    title: str
    body: str = ""
    category: str = "pengumuman"   # pengumuman | promo | reward | penting | berita
    pinned: bool = False
    published: bool = True
    image: Optional[str] = ""
    target_roles: List[str] = Field(default_factory=list)  # kosong = semua peran
