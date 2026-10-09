"""Core infrastructure: db, auth, permissions, period helpers."""
import os
import uuid
import datetime as dt
from typing import Any, Dict, List, Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
JWT_SECRET = os.environ.get("JWT_SECRET", "mlm-hybrid-dev-secret")
JWT_ALG = "HS256"
TOKEN_HOURS = 24 * 7

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

ROLES = ["admin_pusat", "admin_provinsi", "stokis", "member"]
ROLE_LABEL = {
    "admin_pusat": "Admin Pusat",
    "admin_provinsi": "Admin Provinsi",
    "stokis": "Stokis",
    "member": "Member",
}
ID_PREFIX = {"admin_pusat": "ADM", "admin_provinsi": "APR", "stokis": "STK", "member": "MB"}

DEFAULT_SETTINGS: Dict[str, Any] = {
    "period1_end_day": 11,
    "period1_close_day": 11,
    "period2_close_day": 27,
    "stokis_fee_percent": 0.0,
    "company_name": "Hybrid MLM",
    "company_tagline": "Backoffice & Perhitungan Bonus",
    "engine": {},  # overrides passed to engine.build_config
    # Jenis bonus yang dinonaktifkan untuk SELURUH member (rahasia, hanya Admin Pusat)
    "bonus_disabled_global": [],
    # Halaman yang ditutup per peran: {"member": ["statement", ...], ...}
    "pages_blocked_global": {},
}

# ------------------------------------------------------- akses & penonaktifan
# Jenis bonus yang bisa dinonaktifkan. Key harus sama dengan field bonus_* di engine.
BONUS_TYPES: List[Dict[str, str]] = [
    {"key": "sponsor", "label": "Bonus Sponsor"},
    {"key": "pasangan", "label": "Bonus Pasangan"},
    {"key": "bimbingan", "label": "Bonus Bimbingan"},
    {"key": "prestasi", "label": "Bonus Prestasi"},
    {"key": "kepemimpinan", "label": "Bonus Kepemimpinan"},
    {"key": "sharing_profit", "label": "Bonus Sharing Profit"},
    {"key": "reward", "label": "Special Reward"},
]
BONUS_KEYS = [b["key"] for b in BONUS_TYPES]

# Halaman yang bisa ditutup untuk bawahan. Dashboard & Pengaturan tidak bisa ditutup
# supaya pengguna tidak terjebak tanpa halaman apa pun.
PAGES: List[Dict[str, Any]] = [
    {"key": "announcements", "label": "Pengumuman", "path": "/announcements",
     "roles": ["admin_provinsi", "stokis", "member"]},
    {"key": "members", "label": "Member", "path": "/members",
     "roles": ["admin_provinsi", "stokis"]},
    {"key": "network", "label": "Jaringan", "path": "/network",
     "roles": ["admin_provinsi", "stokis", "member"]},
    {"key": "transactions", "label": "Omset", "path": "/transactions",
     "roles": ["admin_provinsi", "stokis"]},
    {"key": "periods", "label": "Tutup Buku", "path": "/periods",
     "roles": ["admin_provinsi"]},
    {"key": "bonus", "label": "Laporan Bonus", "path": "/bonus",
     "roles": ["admin_provinsi", "stokis"]},
    {"key": "payout", "label": "Payout & Omset", "path": "/payout",
     "roles": ["admin_provinsi", "stokis"]},
    {"key": "statement", "label": "Slip Bonus", "path": "/statement",
     "roles": ["admin_provinsi", "stokis", "member"]},
    {"key": "products", "label": "Katalog Produk", "path": "/products",
     "roles": ["admin_provinsi", "stokis", "member"]},
    {"key": "stock", "label": "Stok", "path": "/stock",
     "roles": ["admin_provinsi", "stokis"]},
    {"key": "simulator", "label": "Simulator Bonus", "path": "/simulator",
     "roles": ["admin_provinsi", "stokis", "member"]},
    {"key": "plan", "label": "Marketing Plan", "path": "/plan",
     "roles": ["admin_provinsi", "stokis", "member"]},
]
PAGE_KEYS = [p["key"] for p in PAGES]
SECRET_FIELDS = ("bonus_disabled", "access_set_by", "access_set_at")


def effective_bonus_disabled(user_doc: Dict[str, Any], settings: Dict[str, Any]) -> List[str]:
    """Gabungan penonaktifan global + per member (khusus peran member)."""
    if (user_doc.get("role") or "member") != "member":
        return []
    g = [k for k in (settings.get("bonus_disabled_global") or []) if k in BONUS_KEYS]
    own = [k for k in (user_doc.get("bonus_disabled") or []) if k in BONUS_KEYS]
    return sorted(set(g) | set(own))


def effective_blocked_pages(user_doc: Dict[str, Any], settings: Dict[str, Any]) -> List[str]:
    """Halaman yang ditutup untuk pengguna ini (global per peran + per pengguna)."""
    role = user_doc.get("role") or "member"
    if role == "admin_pusat":
        return []
    g = (settings.get("pages_blocked_global") or {}).get(role) or []
    own = user_doc.get("blocked_pages") or []
    return sorted({k for k in list(g) + list(own) if k in PAGE_KEYS})


async def assert_page(user_doc: Dict[str, Any], page_key: str):
    """Tolak akses bila halaman ditutup oleh Admin Pusat."""
    await assert_any_page(user_doc, [page_key])


async def assert_any_page(user_doc: Dict[str, Any], page_keys: List[str]):
    """Tolak akses hanya bila SEMUA halaman yang memakai endpoint ini ditutup.

    Hanya halaman yang relevan untuk peran pengguna yang diperhitungkan, supaya
    endpoint bersama (mis. slip bonus dipakai halaman Slip Bonus & Member) tetap
    tertutup dengan benar untuk peran yang hanya punya salah satu halaman itu.
    """
    role = user_doc.get("role") or "member"
    if role == "admin_pusat":
        return
    relevant = [k for k in page_keys
                if any(p["key"] == k and role in p["roles"] for p in PAGES)]
    if not relevant:
        return
    st = await get_settings()
    blocked = set(effective_blocked_pages(user_doc, st))
    if all(k in blocked for k in relevant):
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "Halaman ini tidak tersedia untuk akun Anda")


def strip_secrets(doc: Optional[Dict[str, Any]], viewer_role: str) -> Optional[Dict[str, Any]]:
    """Sembunyikan konfigurasi penonaktifan bonus dari siapa pun selain Admin Pusat."""
    if doc is None or viewer_role == "admin_pusat":
        return doc
    return {k: v for k, v in doc.items() if k not in SECRET_FIELDS}

bearer = HTTPBearer(auto_error=False)


# ------------------------------------------------------------------ helpers
# Struktur placement Ascendia bersifat BINER: setiap member maksimal 2 kaki placement.
# Sponsor tidak dibatasi (boleh sebanyak-banyaknya).
BINARY_WIDTH = 2


def placement_subtree_size(root: str, kids: Dict[str, List[str]],
                           terlarang: Optional[set] = None,
                           cache: Optional[Dict[str, int]] = None) -> int:
    """Jumlah member pada satu kaki placement (termasuk `root` itu sendiri)."""
    terlarang = terlarang or set()
    cache = cache if cache is not None else {}
    if root in cache:
        return cache[root]
    total, stack, seen = 0, [root], set()
    while stack:
        n = stack.pop()
        if n in seen or n in terlarang:
            continue
        seen.add(n)
        total += 1
        for c in (kids.get(n, []) or []):
            if c not in seen and c not in terlarang:
                stack.append(c)
    cache[root] = total
    return total


def pick_balanced_slot(root: str, kids: Dict[str, List[str]],
                       width: int = BINARY_WIDTH,
                       skip: Optional[str] = None) -> str:
    """Cari titik placement kosong di bawah `root` dengan TURUN KE KAKI TERLEMAH.

    Aturan yang dipakai Ascendia:
    1. Pencarian selalu dimulai dari `root` (biasanya sponsor yang merekrut).
    2. Kalau `root` masih punya kaki kosong (< 2), member langsung ditempatkan di situ.
    3. Kalau kedua kaki `root` sudah penuh, member TURUN ke kaki TERLEMAH —
       yaitu kaki dengan jumlah member paling sedikit (bila jumlahnya sama,
       dipilih ID terkecil supaya hasilnya konsisten). Proses ini diulang terus
       sampai menemukan node yang masih punya kaki kosong.

    Dengan cara ini jaringan menyeimbangkan dirinya sendiri: kaki yang paling
    sepi akan selalu diisi lebih dulu.

    `skip` = member yang sedang dipindah. Member itu beserta seluruh
    keturunannya tidak boleh dipakai sebagai titik placement (mencegah struktur
    melingkar), dan kaki miliknya tidak dihitung sebagai kaki terpakai.
    """
    if not root:
        return root
    terlarang: set = set()
    if skip:
        terlarang = {skip} | placement_descendants(skip, kids)
    if root in terlarang:
        return root

    def kaki(n: str) -> List[str]:
        return [c for c in (kids.get(n, []) or [])
                if c != skip and c not in terlarang]

    cache: Dict[str, int] = {}
    cur = root
    dilewati = {root}
    for _ in range(2000):
        anak = kaki(cur)
        if len(anak) < width:
            return cur
        kandidat = [c for c in anak if c not in dilewati]
        if not kandidat:
            return cur
        cur = min(kandidat, key=lambda c: (
            placement_subtree_size(c, kids, terlarang | {skip} if skip else terlarang, cache),
            str(c)))
        dilewati.add(cur)
    return cur


def resolve_placement(kids: Dict[str, List[str]],
                      sponsor_id: Optional[str],
                      placement_id: Optional[str] = None,
                      skip: Optional[str] = None,
                      width: int = BINARY_WIDTH) -> Dict[str, Any]:
    """Tentukan titik placement FINAL sesuai aturan biner (maksimal 2 kaki).

    - Placement dikosongkan  -> mulai dari sponsor, lalu TURUN KE KAKI TERLEMAH
      (kaki dengan member paling sedikit) sampai menemukan slot kosong.
    - Placement ditulis tapi kakinya sudah penuh (2 dari 2) -> TIDAK ditolak,
      member baru otomatis turun ke kaki terlemah di bawahnya.
    - Sponsor tidak dibatasi, jadi berapa pun frontline sponsor tetap boleh.
    """
    diminta = placement_id or None
    root = diminta or sponsor_id or None
    if not root:
        return {"placement_id": None, "requested": diminta, "root": None,
                "auto": False, "turun": False, "kaki_terpakai": 0,
                "kaki_maksimal": width, "jalur": [],
                "reason": "Member ini menjadi akar jaringan (belum punya upline placement)."}

    terpakai = len([c for c in (kids.get(root, []) or []) if c != skip])
    if terpakai < width and not (skip and root == skip):
        return {"placement_id": root, "requested": diminta, "root": root,
                "auto": diminta is None, "turun": False,
                "kaki_terpakai": terpakai, "kaki_maksimal": width, "jalur": [root],
                "reason": (f"{root} masih punya {width - terpakai} kaki kosong "
                           f"({terpakai}/{width} terpakai), member ditempatkan langsung di situ.")}

    slot = pick_balanced_slot(root, kids, width, skip=skip)
    slot_terpakai = len([c for c in (kids.get(slot, []) or []) if c != skip])
    jalur = placement_path(root, slot, kids)
    return {"placement_id": slot, "requested": diminta, "root": root,
            "auto": True, "turun": slot != root,
            "kaki_terpakai": slot_terpakai, "kaki_maksimal": width,
            "jalur": jalur,
            "reason": (f"Kedua kaki placement {root} sudah penuh ({terpakai}/{width}). "
                       f"Member otomatis TURUN KE KAKI TERLEMAH (jumlah member paling sedikit) "
                       f"dan berhenti di {slot} (kaki terpakai {slot_terpakai}/{width}). "
                       f"Jalur penurunan: {' -> '.join(jalur)}. "
                       f"Sponsor tetap {sponsor_id or root} dan jumlah sponsor tidak dibatasi.")}


def placement_path(root: str, slot: str, kids: Dict[str, List[str]]) -> List[str]:
    """Jalur penurunan dari `root` sampai `slot` (untuk penjelasan ke pengguna)."""
    if not root or not slot:
        return [x for x in (root, slot) if x]
    parent: Dict[str, str] = {}
    stack = [root]
    while stack:
        n = stack.pop()
        for c in (kids.get(n, []) or []):
            if c not in parent and c != root:
                parent[c] = n
                stack.append(c)
    jalur, cur = [slot], slot
    while cur != root and cur in parent:
        cur = parent[cur]
        jalur.append(cur)
    return list(reversed(jalur))


def placement_kids_from_rows(rows: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    """Bangun peta anak placement dari daftar dokumen member."""
    kids: Dict[str, List[str]] = {r["member_id"]: [] for r in rows}
    for r in rows:
        p = r.get("placement_id") or r.get("sponsor_id")
        if p and p in kids:
            kids[p].append(r["member_id"])
    return kids


async def placement_kids_map() -> Dict[str, List[str]]:
    """Peta anak placement seluruh member aktif (dipakai untuk auto-balance)."""
    rows = await db.users.find(
        {"role": "member", "deleted": {"$ne": True}},
        {"member_id": 1, "placement_id": 1, "sponsor_id": 1, "_id": 0},
    ).to_list(200000)
    return placement_kids_from_rows(rows)


def placement_descendants(root: str, kids: Dict[str, List[str]]) -> set:
    """Semua keturunan placement dari `root` (untuk cegah lingkaran)."""
    out, stack = set(), [root]
    while stack:
        n = stack.pop()
        for c in kids.get(n, []) or []:
            if c not in out:
                out.add(c)
                stack.append(c)
    return out


def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_pw(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode("utf-8"), h.encode("utf-8"))
    except Exception:
        return False


def make_token(member_id: str, role: str) -> str:
    payload = {
        "sub": member_id,
        "role": role,
        "exp": dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=TOKEN_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def clean(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Remove mongo _id and make everything JSON serialisable."""
    if doc is None:
        return None
    out: Dict[str, Any] = {}
    for k, v in doc.items():
        if k in ("_id", "password_hash"):
            continue
        out[k] = _ser(v)
    return out


def _ser(v: Any) -> Any:
    if isinstance(v, (dt.datetime, dt.date)):
        return v.isoformat()
    if isinstance(v, dict):
        return {k: _ser(x) for k, x in v.items() if k != "_id"}
    if isinstance(v, list):
        return [_ser(x) for x in v]
    return v


async def get_settings() -> Dict[str, Any]:
    doc = await db.settings.find_one({"id": "global"})
    if not doc:
        doc = {"id": "global", **DEFAULT_SETTINGS}
        await db.settings.insert_one(dict(doc))
    merged = {**DEFAULT_SETTINGS, **{k: v for k, v in doc.items() if k not in ("_id",)}}
    return merged


# ------------------------------------------------------------------ periods
def period_key_for_date(date_str: str, p1_end_day: int = 11) -> str:
    d = dt.date.fromisoformat(date_str[:10])
    idx = 1 if d.day <= int(p1_end_day) else 2
    return f"{d.year}-{d.month:02d}-P{idx}"


def period_bounds(key: str, p1_end_day: int = 11) -> Dict[str, str]:
    year, month, p = key.split("-")
    year, month = int(year), int(month)
    idx = int(p[1])
    last = (dt.date(year + (month == 12), (month % 12) + 1, 1) - dt.timedelta(days=1)).day
    if idx == 1:
        return {"start": f"{year}-{month:02d}-01", "end": f"{year}-{month:02d}-{int(p1_end_day):02d}"}
    return {"start": f"{year}-{month:02d}-{int(p1_end_day) + 1:02d}", "end": f"{year}-{month:02d}-{last:02d}"}


def period_label(key: str) -> str:
    bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
    y, m, p = key.split("-")
    return f"{bulan[int(m) - 1]} {y} - Periode {p[1]}"


async def ensure_period(key: str) -> Dict[str, Any]:
    doc = await db.periods.find_one({"key": key})
    if doc:
        return doc
    st = await get_settings()
    b = period_bounds(key, st["period1_end_day"])
    y, m, p = key.split("-")
    close_day = st["period1_close_day"] if p == "P1" else st["period2_close_day"]
    doc = {
        "id": new_id(), "key": key, "year": int(y), "month": int(m), "index": int(p[1]),
        "label": period_label(key), "start": b["start"], "end": b["end"],
        "close_date": f"{y}-{m}-{int(close_day):02d}", "status": "open",
        "created_at": now_iso(),
    }
    await db.periods.insert_one(dict(doc))
    return doc


async def current_period_key() -> str:
    st = await get_settings()
    return period_key_for_date(dt.date.today().isoformat(), st["period1_end_day"])


# ------------------------------------------------------------------ auth deps
async def current_user(cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> Dict[str, Any]:
    if not cred:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token tidak ditemukan")
    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token tidak valid atau kedaluwarsa")
    user = await db.users.find_one({"member_id": payload.get("sub"), "deleted": {"$ne": True}})
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Pengguna tidak ditemukan")
    if not user.get("active", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Akun Anda dinonaktifkan")
    return user


def require_roles(*roles: str):
    async def dep(user: Dict[str, Any] = Depends(current_user)) -> Dict[str, Any]:
        if user["role"] not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Anda tidak punya akses ke fitur ini")
        return user
    return dep


async def next_member_id(role: str) -> str:
    prefix = ID_PREFIX.get(role, "MB")
    cursor = db.users.find({"member_id": {"$regex": f"^{prefix}\\d+$"}}, {"member_id": 1}).sort("member_id", -1).limit(1)
    docs = await cursor.to_list(1)
    n = 1
    if docs:
        try:
            n = int(docs[0]["member_id"][len(prefix):]) + 1
        except Exception:
            n = 1
    return f"{prefix}{n:05d}"


async def scope_query(user: Dict[str, Any]) -> Dict[str, Any]:
    """Which users can the caller see?

    Hirarki: Admin Pusat > Admin Provinsi (membawahi stokis di provinsinya)
    > Stokis (membawahi member yang bergabung lewat stokis tsb) > Member.
    """
    role = user["role"]
    if role == "admin_pusat":
        return {}
    if role == "admin_provinsi":
        prov = user.get("province") or ""
        stokis = await db.users.find(
            {"role": "stokis", "province": prov, "deleted": {"$ne": True}}, {"member_id": 1}
        ).to_list(100000)
        sids = [s["member_id"] for s in stokis]
        return {"$or": [{"province": prov}, {"stokis_id": {"$in": sids}},
                        {"member_id": user["member_id"]}]}
    if role == "stokis":
        return {"$or": [{"stokis_id": user["member_id"]}, {"member_id": user["member_id"]}]}
    return {"member_id": user["member_id"]}


async def assert_can_manage(user: Dict[str, Any], target: Dict[str, Any]):
    role = user["role"]
    if role == "admin_pusat":
        return
    if role == "admin_provinsi":
        if target.get("role") in ("admin_pusat", "admin_provinsi"):
            if target.get("member_id") != user.get("member_id"):
                raise HTTPException(403, "Di luar wewenang Admin Provinsi")
            return
        prov = user.get("province") or ""
        if target.get("province") == prov:
            return
        # member yang bergabung melalui stokis di provinsi ini
        sid = target.get("stokis_id")
        if sid:
            st = await db.users.find_one({"member_id": sid}, {"province": 1})
            if st and st.get("province") == prov:
                return
        raise HTTPException(403, "Di luar wewenang Admin Provinsi")
    if role == "stokis":
        if target.get("member_id") == user.get("member_id"):
            return
        if target.get("role") != "member" or target.get("stokis_id") != user["member_id"]:
            raise HTTPException(403, "Hanya bisa mengelola member stokis Anda")
        return
    raise HTTPException(403, "Tidak diizinkan")


# ------------------------------------------------------------------ date ranges
def month_periods(year: int, month: int) -> List[str]:
    return [f"{year}-{month:02d}-P1", f"{year}-{month:02d}-P2"]


def year_periods(year: int) -> List[str]:
    return [f"{year}-{m:02d}-P{i}" for m in range(1, 13) for i in (1, 2)]


async def resolve_range(mode: str, key: Optional[str]) -> Dict[str, Any]:
    """mode: period | month | year | all  ->  daftar period_key + label + rentang tanggal."""
    st = await get_settings()
    p1 = st["period1_end_day"]
    today = dt.date.today()
    mode = (mode or "period").lower()
    bulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
             "Agustus", "September", "Oktober", "November", "Desember"]

    if mode == "month":
        k = key or f"{today.year}-{today.month:02d}"
        y, m = int(k.split("-")[0]), int(k.split("-")[1])
        keys = month_periods(y, m)
        last = (dt.date(y + (m == 12), (m % 12) + 1, 1) - dt.timedelta(days=1)).day
        return {"mode": "month", "key": k, "keys": keys,
                "label": f"{bulan[m - 1]} {y} (1 bulan penuh)",
                "start": f"{y}-{m:02d}-01", "end": f"{y}-{m:02d}-{last:02d}",
                "year": y, "month": m}
    if mode == "year":
        y = int(key or today.year)
        return {"mode": "year", "key": str(y), "keys": year_periods(y),
                "label": f"Tahun {y} (1 tahun penuh)",
                "start": f"{y}-01-01", "end": f"{y}-12-31", "year": y, "month": None}
    if mode == "all":
        rows = await db.periods.find({}, {"key": 1}).sort("key", 1).to_list(10000)
        keys = [r["key"] for r in rows]
        return {"mode": "all", "key": "all", "keys": keys, "label": "Seluruh periode",
                "start": (period_bounds(keys[0], p1)["start"] if keys else None),
                "end": (period_bounds(keys[-1], p1)["end"] if keys else None),
                "year": None, "month": None}

    k = key or await current_period_key()
    b = period_bounds(k, p1)
    return {"mode": "period", "key": k, "keys": [k], "label": period_label(k),
            "start": b["start"], "end": b["end"],
            "year": int(k.split("-")[0]), "month": int(k.split("-")[1])}
