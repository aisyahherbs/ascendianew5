"""Auth, user/member management, products, settings, network tree."""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

import core
import mlm_service as svc
from core import (assert_can_manage, clean, current_user, db, get_settings,
                  hash_pw, make_token, new_id, next_member_id, now_iso,
                  require_roles, scope_query, verify_pw, ROLE_LABEL)
from engine import (MEMBERSHIPS, MEMBERSHIP_ORDER, PRESTASI_RATE, RANK_ORDER,
                    RANK_RULES, TUPO_REQ, build_config)
from models import (AnnouncementIn, AccessIn, BulkIdsIn, BulkStatusIn, GradeIn, LoginIn, PasswordIn,
                    ProductIn, ProfileIn, SettingsIn, StatusIn, TupoIn, UserCreate, UserUpdate)
import regions

router = APIRouter()


# ============================================================== AUTH
@router.post("/auth/login")
async def login(body: LoginIn):
    u = await db.users.find_one({"member_id": body.member_id.strip().upper(), "deleted": {"$ne": True}})
    if not u or not verify_pw(body.password, u.get("password_hash", "")):
        raise HTTPException(401, "ID Member atau sandi salah")
    if not u.get("active", True):
        raise HTTPException(403, "Akun Anda dinonaktifkan. Hubungi admin.")
    st = await get_settings()
    return {"token": make_token(u["member_id"], u["role"]),
            "user": core.strip_secrets(clean(u), u["role"]),
            "blocked_pages": core.effective_blocked_pages(u, st)}


@router.get("/auth/me")
async def me(user=Depends(current_user)):
    st = await get_settings()
    return {"user": core.strip_secrets(clean(user), user["role"]),
            "role_label": ROLE_LABEL.get(user["role"], user["role"]),
            "blocked_pages": core.effective_blocked_pages(user, st)}


@router.post("/auth/change-password")
async def change_own_password(body: Dict[str, str], user=Depends(current_user)):
    if not verify_pw(body.get("old_password", ""), user.get("password_hash", "")):
        raise HTTPException(400, "Sandi lama salah")
    if len(body.get("new_password", "")) < 6:
        raise HTTPException(400, "Sandi baru minimal 6 karakter")
    await db.users.update_one({"member_id": user["member_id"]},
                              {"$set": {"password_hash": hash_pw(body["new_password"])}})
    return {"ok": True}


# ============================================================== MEMBERS
@router.get("/members")
async def list_members(q: Optional[str] = None, role: Optional[str] = None,
                      status: Optional[str] = None, province: Optional[str] = None,
                      stokis_id: Optional[str] = None, limit: int = 500,
                      user=Depends(current_user)):
    await core.assert_page(user, "members")
    query: Dict[str, Any] = {"deleted": {"$ne": True}}
    query.update(await scope_query(user))
    if role:
        query["role"] = role
    if status == "active":
        query["active"] = True
    elif status == "inactive":
        query["active"] = False
    if province:
        query["province"] = province
    if stokis_id:
        query["stokis_id"] = stokis_id
    if q:
        query["$and"] = [{"$or": [{"member_id": {"$regex": q, "$options": "i"}},
                                  {"name": {"$regex": q, "$options": "i"}},
                                  {"phone": {"$regex": q, "$options": "i"}}]}]
    rows = await db.users.find(query).sort("member_id", 1).to_list(limit)
    return [core.strip_secrets(clean(r), user["role"]) for r in rows]


@router.get("/members/options")
async def member_options(q: Optional[str] = None, role: Optional[str] = None,
                        limit: int = 30, user=Depends(current_user)):
    query: Dict[str, Any] = {"deleted": {"$ne": True}}
    if role:
        roles = [r.strip() for r in role.split(",") if r.strip()]
        query["role"] = {"$in": roles} if len(roles) > 1 else roles[0]
    if q:
        query["$or"] = [{"member_id": {"$regex": q, "$options": "i"}},
                        {"name": {"$regex": q, "$options": "i"}}]
    rows = await db.users.find(query, {"member_id": 1, "name": 1, "role": 1, "stat_rank": 1,
                                       "province": 1, "city": 1,
                                       "stat_membership": 1}).sort("member_id", 1).to_list(limit)
    return [clean(r) for r in rows]


# ============================================================== BULK ACTIONS
@router.post("/members/bulk/status")
async def bulk_status(body: BulkStatusIn,
                      user=Depends(require_roles("admin_pusat", "admin_provinsi", "stokis"))):
    ids = [i.strip().upper() for i in (body.member_ids or []) if i and i.strip()]
    if not ids:
        raise HTTPException(400, "Pilih minimal satu member")
    ok, failed = [], []
    for mid in ids:
        target = await db.users.find_one({"member_id": mid, "deleted": {"$ne": True}})
        if not target:
            failed.append({"member_id": mid, "reason": "Tidak ditemukan"})
            continue
        if mid == user["member_id"]:
            failed.append({"member_id": mid, "reason": "Tidak bisa mengubah akun sendiri"})
            continue
        try:
            await assert_can_manage(user, target)
        except HTTPException as e:
            failed.append({"member_id": mid, "reason": e.detail})
            continue
        await db.users.update_one({"member_id": mid}, {"$set": {"active": bool(body.active)}})
        ok.append(mid)
    if ok:
        await svc.recompute(persist=True)
    return {"ok_ids": ok, "failed": failed, "active": bool(body.active),
            "message": f"{len(ok)} pengguna {'diaktifkan' if body.active else 'dinonaktifkan'}"}


@router.post("/members/bulk/delete")
async def bulk_delete(body: BulkIdsIn, user=Depends(require_roles("admin_pusat"))):
    ids = [i.strip().upper() for i in (body.member_ids or []) if i and i.strip()]
    if not ids:
        raise HTTPException(400, "Pilih minimal satu member")
    selected = set(ids)
    ok, failed = [], []
    for mid in ids:
        target = await db.users.find_one({"member_id": mid, "deleted": {"$ne": True}})
        if not target:
            failed.append({"member_id": mid, "reason": "Tidak ditemukan"})
            continue
        if mid == user["member_id"]:
            failed.append({"member_id": mid, "reason": "Tidak bisa menghapus akun sendiri"})
            continue
        kids = await db.users.find(
            {"$or": [{"sponsor_id": mid}, {"placement_id": mid}], "deleted": {"$ne": True}},
            {"member_id": 1}).to_list(100000)
        outside = [k["member_id"] for k in kids if k["member_id"] not in selected]
        if outside:
            failed.append({"member_id": mid,
                           "reason": f"Masih punya {len(outside)} downline aktif ({', '.join(outside[:3])}...)"})
            continue
        await db.users.update_one({"member_id": mid}, {"$set": {
            "deleted": True, "active": False, "deleted_at": now_iso(),
            "deleted_by": user["member_id"]}})
        await db.transactions.delete_many({"member_id": mid})
        ok.append(mid)
        selected.discard(mid)
    if ok:
        await svc.recompute(persist=True)
    return {"ok_ids": ok, "failed": failed, "message": f"{len(ok)} pengguna dihapus"}


@router.get("/placement-audit")
async def placement_audit(user=Depends(require_roles("admin_pusat"))):
    """Periksa pelanggaran aturan biner (member dengan lebih dari 2 kaki placement).

    Hanya PRATINJAU — tidak mengubah apa pun. Menghasilkan rencana pemindahan
    member berlebih ke titik kosong terdekat yang paling seimbang.
    """
    rows = await db.users.find(
        {"role": "member", "deleted": {"$ne": True}},
        {"member_id": 1, "name": 1, "placement_id": 1, "sponsor_id": 1,
         "join_date": 1, "created_at": 1, "_id": 0},
    ).to_list(200000)
    doc = {r["member_id"]: r for r in rows}
    kids = core.placement_kids_from_rows(rows)

    def urut(mid: str):
        d = doc.get(mid, {})
        return (str(d.get("join_date") or ""), str(d.get("created_at") or ""), mid)

    pelanggaran = [{"member_id": p, "name": doc.get(p, {}).get("name", ""),
                    "kaki": len(c), "anak": sorted(c, key=urut)}
                   for p, c in kids.items() if p in doc and len(c) > core.BINARY_WIDTH]
    pelanggaran.sort(key=lambda x: -x["kaki"])

    rencana: List[Dict[str, Any]] = []
    putar = 0
    while putar < 200:
        putar += 1
        rusak = [p for p, c in kids.items() if p in doc and len(c) > core.BINARY_WIDTH]
        if not rusak:
            break
        for p in sorted(rusak):
            anak = sorted(kids.get(p, []), key=urut)
            berlebih = anak[core.BINARY_WIDTH:]
            kids[p] = anak[:core.BINARY_WIDTH]
            for c in berlebih:
                slot = core.pick_balanced_slot(p, kids)
                if slot == c or slot in core.placement_descendants(c, kids):
                    slot = p
                kids.setdefault(slot, []).append(c)
                rencana.append({
                    "member_id": c, "name": doc.get(c, {}).get("name", ""),
                    "sponsor_id": doc.get(c, {}).get("sponsor_id"),
                    "placement_lama": p, "placement_lama_nama": doc.get(p, {}).get("name", ""),
                    "placement_baru": slot, "placement_baru_nama": doc.get(slot, {}).get("name", ""),
                })

    return {
        "total_member": len(rows),
        "kaki_maksimal": core.BINARY_WIDTH,
        "pelanggaran": pelanggaran,
        "jumlah_pelanggaran": len(pelanggaran),
        "rencana": rencana,
        "jumlah_dipindah": len(rencana),
        "pesan": ("Struktur placement sudah sesuai aturan biner." if not rencana else
                  f"{len(pelanggaran)} member punya lebih dari {core.BINARY_WIDTH} kaki. "
                  f"{len(rencana)} member perlu dipindah agar jaringan seimbang. "
                  f"Sponsor tidak diubah sama sekali."),
    }


@router.post("/placement-audit/fix")
async def placement_audit_fix(user=Depends(require_roles("admin_pusat"))):
    """Terapkan rencana perbaikan struktur placement. Sponsor TIDAK diubah."""
    audit = await placement_audit(user)
    if not audit["rencana"]:
        return {"dipindah": 0, "changes": [], "message": audit["pesan"]}
    for c in audit["rencana"]:
        await db.users.update_one(
            {"member_id": c["member_id"]},
            {"$set": {"placement_id": c["placement_baru"], "updated_at": now_iso()}})
    await svc.recompute(persist=True)
    return {"dipindah": len(audit["rencana"]), "changes": audit["rencana"],
            "message": f"{len(audit['rencana'])} member dipindah. "
                       f"Struktur placement kini maksimal {core.BINARY_WIDTH} kaki per member."}


@router.get("/placement-slot")
async def placement_slot(sponsor_id: str = Query(...),
                         placement_id: Optional[str] = Query(None),
                         user=Depends(current_user)):
    """Saran penempatan otomatis seimbang (aturan biner maks 2 kaki).

    Dipakai form pendaftaran agar admin/stokis tahu member baru akan masuk ke
    mana — baik ketika kolom Placement dibiarkan kosong, maupun ketika
    placement yang dipilih ternyata kakinya sudah penuh (otomatis turun).
    """
    sid = (sponsor_id or "").strip().upper()
    if not sid:
        raise HTTPException(400, "Sponsor wajib diisi")
    sp = await db.users.find_one({"member_id": sid, "deleted": {"$ne": True}})
    if not sp or sp.get("role") != "member":
        raise HTTPException(400, f"Sponsor {sid} tidak ditemukan atau bukan Member")
    pid = (placement_id or "").strip().upper() or None
    if pid:
        pl = await db.users.find_one({"member_id": pid, "deleted": {"$ne": True}})
        if not pl or pl.get("role") != "member":
            raise HTTPException(400, f"Placement {pid} tidak ditemukan atau bukan Member")
    kids = await core.placement_kids_map()
    info = core.resolve_placement(kids, sid, pid)
    slot = info["placement_id"]
    target = sp if slot == sid else await db.users.find_one(
        {"member_id": slot, "deleted": {"$ne": True}})
    jalur = info.get("jalur") or []
    nama = {}
    if jalur:
        for row in await db.users.find(
                {"member_id": {"$in": jalur}}, {"member_id": 1, "name": 1, "_id": 0}).to_list(1000):
            nama[row["member_id"]] = row.get("name", "")
    return {
        "sponsor_id": sid, "sponsor_name": sp.get("name", ""),
        "requested_placement_id": pid,
        "placement_id": slot, "placement_name": (target or {}).get("name", ""),
        "kaki_terpakai": info["kaki_terpakai"], "kaki_maksimal": core.BINARY_WIDTH,
        "sponsor_kaki_terpakai": len(kids.get(sid, [])),
        "langsung_di_sponsor": slot == sid,
        "turun_otomatis": info["turun"],
        "jalur": jalur,
        "jalur_nama": [{"member_id": m, "name": nama.get(m, "")} for m in jalur],
        "alasan": info["reason"],
    }


@router.get("/members/{member_id}")
async def get_member(member_id: str, user=Depends(current_user)):
    u = await db.users.find_one({"member_id": member_id, "deleted": {"$ne": True}})
    if not u:
        raise HTTPException(404, "Member tidak ditemukan")
    if user["role"] == "member" and user["member_id"] != member_id:
        raise HTTPException(403, "Tidak diizinkan")
    sponsor_kids = await db.users.count_documents({"sponsor_id": member_id, "deleted": {"$ne": True}})
    placement_kids = await db.users.count_documents({"placement_id": member_id, "deleted": {"$ne": True}})
    txs = await db.transactions.find({"member_id": member_id}).sort("date", -1).to_list(50)
    return {"member": core.strip_secrets(clean(u), user["role"]),
            "frontline_sponsor": sponsor_kids,
            "frontline_placement": placement_kids,
            "transactions": [clean(t) for t in txs]}


@router.post("/members")
async def create_member(body: UserCreate,
                        user=Depends(require_roles("admin_pusat", "admin_provinsi", "stokis"))):
    role = body.role or "member"
    if role not in core.ROLES:
        raise HTTPException(400, "Role tidak valid")
    if user["role"] == "stokis" and role != "member":
        raise HTTPException(403, "Stokis hanya bisa mendaftarkan member")
    if user["role"] == "admin_provinsi" and role in ("admin_pusat", "admin_provinsi"):
        raise HTTPException(403, "Admin Provinsi tidak bisa membuat admin")

    label = ROLE_LABEL.get(role, role)

    # ---------------------------------------------------- validasi kolom wajib
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(400, "Nama lengkap wajib diisi")
    if len(name) < 3:
        raise HTTPException(400, "Nama lengkap minimal 3 karakter")
    if body.password and len(body.password) < 6:
        raise HTTPException(400, "Sandi awal minimal 6 karakter")

    phone = (body.phone or "").strip()
    province = (body.province or "").strip()
    city = (body.city or "").strip()

    # provinsi diwarisi otomatis dari pembuat bila pembuat terikat wilayah
    if user["role"] == "stokis":
        province = user.get("province", "") or province
        city = city or user.get("city", "")
    elif user["role"] == "admin_provinsi":
        province = user.get("province", "") or province

    if role != "admin_pusat":
        if not phone:
            raise HTTPException(400, f"No. HP wajib diisi untuk {label}")
        if not province:
            raise HTTPException(400, f"Provinsi wajib diisi untuk {label}")
        if role in ("stokis", "member") and not city:
            raise HTTPException(400, f"Kabupaten / Kota wajib diisi untuk {label}")
        if province not in regions.PROVINCE_NAMES:
            raise HTTPException(400, f"Provinsi '{province}' tidak dikenali")
        if city and not regions.is_valid_city(province, city):
            raise HTTPException(400, f"Kabupaten / Kota '{city}' bukan bagian dari {province}")

    mid = (body.member_id or "").strip().upper() or await next_member_id(role)
    if await db.users.find_one({"member_id": mid}):
        raise HTTPException(400, f"ID {mid} sudah dipakai")

    sponsor_id = (body.sponsor_id or "").strip().upper() or None
    placement_id = (body.placement_id or "").strip().upper() or None
    stokis_id = (body.stokis_id or "").strip().upper() or None
    initial_pv = float(body.initial_pv or 0)
    placement_info: Optional[Dict[str, Any]] = None

    if role == "member":
        member_total = await db.users.count_documents({"role": "member", "deleted": {"$ne": True}})
        if not sponsor_id:
            if member_total > 0:
                raise HTTPException(400, "Sponsor wajib diisi untuk member")
            # member pertama = akar jaringan, belum ada sponsor yang bisa dipilih
            placement_id = None
        if sponsor_id:
            sp = await db.users.find_one({"member_id": sponsor_id, "deleted": {"$ne": True}})
            if not sp:
                raise HTTPException(400, f"Sponsor {sponsor_id} tidak ditemukan")
            if sp.get("role") != "member":
                raise HTTPException(400, "Sponsor harus berperan Member. Admin & Stokis tidak masuk struktur jaringan.")
        if placement_id:
            pl = await db.users.find_one({"member_id": placement_id, "deleted": {"$ne": True}})
            if not pl:
                raise HTTPException(400, f"Upline placement {placement_id} tidak ditemukan")
            if pl.get("role") != "member":
                raise HTTPException(400, "Placement harus berperan Member. Admin & Stokis tidak masuk struktur jaringan.")
        # ---- aturan BINER: maksimal 2 kaki placement.
        # Kosong ATAU sudah penuh -> otomatis turun ke binary di bawahnya (seimbang).
        # Sponsor tidak dibatasi: berapa pun frontline sponsor tetap diterima.
        if sponsor_id:
            kids = await core.placement_kids_map()
            placement_info = core.resolve_placement(kids, sponsor_id, placement_id)
            placement_id = placement_info["placement_id"]
        if user["role"] == "stokis":
            stokis_id = user["member_id"]
        elif stokis_id:
            stk = await db.users.find_one({"member_id": stokis_id, "deleted": {"$ne": True}})
            if not stk or stk.get("role") != "stokis":
                raise HTTPException(400, f"{stokis_id} bukan Stokis yang valid")
    else:
        # Admin Pusat / Admin Provinsi / Stokis = peran operasional.
        # Tidak punya sponsor, placement, stokis pengelola, maupun omset pendaftaran.
        sponsor_id = None
        placement_id = None
        stokis_id = None
        initial_pv = 0.0

    pwd = body.password or "123456"
    doc = {
        "id": new_id(), "member_id": mid, "name": name, "role": role,
        "password_hash": hash_pw(pwd), "active": True, "deleted": False,
        "phone": phone, "email": body.email or "", "address": body.address or "",
        "province": province, "city": city,
        "bank_name": body.bank_name or "", "bank_account": body.bank_account or "",
        "sponsor_id": sponsor_id, "placement_id": placement_id, "stokis_id": stokis_id,
        "join_date": body.join_date or now_iso()[:10],
        "created_by": user["member_id"], "created_at": now_iso(),
        "stat_rank": "Member", "stat_membership": "None",
        "override_membership": None, "override_rank": None,
        "stat_appv": 0, "stat_appv_perkembangan": 0, "stat_atnpv": 0, "stat_carry": {},
    }
    await db.users.insert_one(dict(doc))

    if initial_pv > 0:
        st = await get_settings()
        date = doc["join_date"]
        key = core.period_key_for_date(date, st["period1_end_day"])
        await core.ensure_period(key)
        await db.transactions.insert_one({
            "id": new_id(), "member_id": mid, "member_name": name,
            "kind": body.initial_pv_kind or "perkembangan",
            "pv": initial_pv, "date": date, "period_key": key,
            "note": "Belanja pendaftaran", "created_by": user["member_id"], "created_at": now_iso(),
        })
    await svc.recompute(persist=True)
    return {"member": clean(doc), "initial_password": pwd,
            "placement_info": placement_info}


@router.put("/members/{member_id}")
async def update_member(member_id: str, body: UserUpdate,
                        user=Depends(require_roles("admin_pusat", "admin_provinsi", "stokis"))):
    target = await db.users.find_one({"member_id": member_id, "deleted": {"$ne": True}})
    if not target:
        raise HTTPException(404, "Member tidak ditemukan")
    await assert_can_manage(user, target)
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if "role" in patch and user["role"] != "admin_pusat":
        patch.pop("role")

    new_role = patch.get("role", target.get("role", "member"))
    move_info: Optional[Dict[str, Any]] = None
    if new_role not in core.ROLES:
        raise HTTPException(400, "Role tidak valid")
    label = ROLE_LABEL.get(new_role, new_role)

    if "name" in patch and len(str(patch["name"]).strip()) < 3:
        raise HTTPException(400, "Nama lengkap minimal 3 karakter")

    province = patch.get("province", target.get("province", "")) or ""
    city = patch.get("city", target.get("city", "")) or ""
    if new_role != "admin_pusat":
        if not province:
            raise HTTPException(400, f"Provinsi wajib diisi untuk {label}")
        if new_role in ("stokis", "member") and not city:
            raise HTTPException(400, f"Kabupaten / Kota wajib diisi untuk {label}")
        if province not in regions.PROVINCE_NAMES:
            raise HTTPException(400, f"Provinsi '{province}' tidak dikenali")
        if city and not regions.is_valid_city(province, city):
            raise HTTPException(400, f"Kabupaten / Kota '{city}' bukan bagian dari {province}")

    if new_role == "member":
        for f in ("sponsor_id", "placement_id", "stokis_id"):
            if f in patch:
                patch[f] = (patch[f] or "").strip().upper() or None
                if patch[f] == member_id:
                    raise HTTPException(400, "Tidak boleh menunjuk diri sendiri")
                if patch[f]:
                    ref = await db.users.find_one({"member_id": patch[f], "deleted": {"$ne": True}})
                    if not ref:
                        raise HTTPException(400, f"ID {patch[f]} tidak ditemukan")
                    want = "stokis" if f == "stokis_id" else "member"
                    if ref.get("role") != want:
                        raise HTTPException(
                            400, f"{patch[f]} harus berperan {ROLE_LABEL[want]}")
        # ---- aturan BINER saat pindah placement: maksimal 2 kaki.
        # Bila tujuan sudah penuh, member otomatis turun ke binary di bawahnya
        # (bukan ditolak). Tidak boleh melingkar (turun ke bawah dirinya sendiri).
        if "placement_id" in patch:
            kids = await core.placement_kids_map()
            baru = patch["placement_id"]
            if baru:
                if baru in core.placement_descendants(member_id, kids):
                    raise HTTPException(
                        400,
                        f"{baru} berada di bawah {member_id}, jadi tidak bisa dijadikan "
                        f"upline placement (struktur akan melingkar).")
                info = core.resolve_placement(kids, target.get("sponsor_id"), baru,
                                              skip=member_id)
                patch["placement_id"] = info["placement_id"]
                move_info = info
        # sponsor boleh kosong hanya untuk member akar jaringan (member pertama)
    else:
        # peran operasional keluar dari struktur jaringan sponsor / placement
        patch["sponsor_id"] = None
        patch["placement_id"] = None
        patch["stokis_id"] = None
        patch["override_membership"] = None
        patch["override_rank"] = None

    patch["updated_at"] = now_iso()
    await db.users.update_one({"member_id": member_id}, {"$set": patch})
    if any(f in patch for f in ("sponsor_id", "placement_id", "role", "stokis_id")):
        await svc.recompute(persist=True)
    out = core.strip_secrets(clean(await db.users.find_one({"member_id": member_id})),
                             user["role"])
    if out is not None and move_info:
        out["placement_info"] = move_info
    return out


@router.post("/members/{member_id}/grade")
async def set_grade(member_id: str, body: GradeIn, user=Depends(require_roles("admin_pusat"))):
    """Admin Pusat mengubah membership & peringkat member tanpa menambah PV."""
    target = await db.users.find_one({"member_id": member_id.upper(), "deleted": {"$ne": True}})
    if not target:
        raise HTTPException(404, "Member tidak ditemukan")
    if target.get("role") != "member":
        raise HTTPException(400, "Membership & peringkat hanya berlaku untuk peran Member")
    if body.clear:
        patch = {"override_membership": None, "override_rank": None}
    else:
        patch = {}
        if body.membership is not None:
            if body.membership and body.membership not in MEMBERSHIP_ORDER:
                raise HTTPException(400, f"Membership '{body.membership}' tidak dikenali")
            patch["override_membership"] = body.membership or None
        if body.rank is not None:
            if body.rank and body.rank not in RANK_ORDER:
                raise HTTPException(400, f"Peringkat '{body.rank}' tidak dikenali")
            patch["override_rank"] = body.rank or None
        if not patch:
            raise HTTPException(400, "Pilih membership atau peringkat yang ingin ditetapkan")
    patch["grade_set_by"] = user["member_id"]
    patch["grade_set_at"] = now_iso()
    await db.users.update_one({"member_id": target["member_id"]}, {"$set": patch})
    await svc.recompute(persist=True)
    fresh = await db.users.find_one({"member_id": target["member_id"]})
    return {"ok": True, "member": clean(fresh),
            "message": ("Membership & peringkat dikembalikan ke perhitungan otomatis"
                        if body.clear else
                        f"{target['member_id']} ditetapkan "
                        f"{fresh.get('override_membership') or 'otomatis'} / "
                        f"{fresh.get('override_rank') or 'otomatis'}")}


@router.get("/grades")
async def grade_options(user=Depends(current_user)):
    return {"memberships": MEMBERSHIP_ORDER, "ranks": RANK_ORDER}


# ============================================= AKSES: BONUS & HALAMAN (Admin Pusat)
@router.get("/access/options")
async def access_options(user=Depends(require_roles("admin_pusat"))):
    """Daftar jenis bonus yang bisa dinonaktifkan & halaman yang bisa ditutup."""
    st = await get_settings()
    return {
        "bonus_types": core.BONUS_TYPES,
        "pages": core.PAGES,
        "roles": [{"key": r, "label": ROLE_LABEL[r]} for r in core.ROLES if r != "admin_pusat"],
        "bonus_disabled_global": [k for k in (st.get("bonus_disabled_global") or [])
                                 if k in core.BONUS_KEYS],
        "pages_blocked_global": {r: [p for p in (v or []) if p in core.PAGE_KEYS]
                                 for r, v in (st.get("pages_blocked_global") or {}).items()},
    }


@router.get("/access/member/{member_id}")
async def access_of_member(member_id: str, user=Depends(require_roles("admin_pusat"))):
    target = await db.users.find_one({"member_id": member_id.upper(), "deleted": {"$ne": True}})
    if not target:
        raise HTTPException(404, "Pengguna tidak ditemukan")
    st = await get_settings()
    return {
        "member_id": target["member_id"], "name": target.get("name", ""),
        "role": target.get("role", "member"),
        "bonus_disabled": [k for k in (target.get("bonus_disabled") or []) if k in core.BONUS_KEYS],
        "blocked_pages": [p for p in (target.get("blocked_pages") or []) if p in core.PAGE_KEYS],
        "effective_bonus_disabled": core.effective_bonus_disabled(target, st),
        "effective_blocked_pages": core.effective_blocked_pages(target, st),
    }


@router.post("/members/bulk/access")
async def bulk_access(body: AccessIn, user=Depends(require_roles("admin_pusat"))):
    """Nonaktifkan jenis bonus dan/atau tutup halaman untuk pengguna terpilih.

    Bersifat senyap: member tidak diberi tahu dan tidak bisa melihat konfigurasi ini.
    """
    ids = [i.strip().upper() for i in (body.member_ids or []) if i and i.strip()]
    if not ids:
        raise HTTPException(400, "Pilih minimal satu pengguna")

    bonus: Optional[List[str]] = None
    if body.clear_bonus:
        bonus = []
    elif body.bonus_disabled is not None:
        bad = [k for k in body.bonus_disabled if k not in core.BONUS_KEYS]
        if bad:
            raise HTTPException(400, f"Jenis bonus tidak dikenali: {', '.join(bad)}")
        bonus = sorted(set(body.bonus_disabled))

    pages: Optional[List[str]] = None
    if body.clear_pages:
        pages = []
    elif body.blocked_pages is not None:
        bad = [p for p in body.blocked_pages if p not in core.PAGE_KEYS]
        if bad:
            raise HTTPException(400, f"Halaman tidak dikenali: {', '.join(bad)}")
        pages = sorted(set(body.blocked_pages))

    if bonus is None and pages is None:
        raise HTTPException(400, "Tidak ada perubahan yang dikirim")

    ok, failed = [], []
    for mid in ids:
        target = await db.users.find_one({"member_id": mid, "deleted": {"$ne": True}})
        if not target:
            failed.append({"member_id": mid, "reason": "Tidak ditemukan"})
            continue
        if mid == user["member_id"]:
            failed.append({"member_id": mid, "reason": "Tidak bisa mengatur akun sendiri"})
            continue
        if target.get("role") == "admin_pusat":
            failed.append({"member_id": mid, "reason": "Admin Pusat tidak bisa dibatasi"})
            continue
        patch: Dict[str, Any] = {"access_set_by": user["member_id"], "access_set_at": now_iso()}
        if bonus is not None:
            if target.get("role") != "member":
                if bonus:
                    failed.append({"member_id": mid,
                                   "reason": "Bonus hanya berlaku untuk peran Member"})
                    continue
                patch["bonus_disabled"] = []
            else:
                patch["bonus_disabled"] = list(bonus)
        if pages is not None:
            role_pages = [p["key"] for p in core.PAGES
                          if target.get("role", "member") in p["roles"]]
            invalid = [p for p in pages if p not in role_pages]
            if invalid:
                failed.append({"member_id": mid,
                               "reason": f"Halaman tidak berlaku untuk perannya: {', '.join(invalid)}"})
                continue
            patch["blocked_pages"] = list(pages)
        await db.users.update_one({"member_id": mid}, {"$set": patch})
        ok.append(mid)

    if ok and bonus is not None:
        await svc.recompute(persist=True)

    parts = []
    if bonus is not None:
        parts.append("semua bonus diaktifkan kembali" if not bonus
                     else f"{len(bonus)} jenis bonus dinonaktifkan")
    if pages is not None:
        parts.append("semua halaman dibuka kembali" if not pages
                     else f"{len(pages)} halaman ditutup")
    return {"ok_ids": ok, "failed": failed,
            "message": f"{len(ok)} pengguna diperbarui: {' & '.join(parts)}"}


@router.post("/members/{member_id}/password")
async def set_password(member_id: str, body: PasswordIn,
                       user=Depends(require_roles("admin_pusat", "admin_provinsi", "stokis"))):
    target = await db.users.find_one({"member_id": member_id, "deleted": {"$ne": True}})
    if not target:
        raise HTTPException(404, "Member tidak ditemukan")
    await assert_can_manage(user, target)
    if len(body.password) < 6:
        raise HTTPException(400, "Sandi minimal 6 karakter")
    await db.users.update_one({"member_id": member_id},
                              {"$set": {"password_hash": hash_pw(body.password)}})
    return {"ok": True}


@router.post("/members/{member_id}/status")
async def set_status(member_id: str, body: StatusIn,
                     user=Depends(require_roles("admin_pusat", "admin_provinsi", "stokis"))):
    target = await db.users.find_one({"member_id": member_id, "deleted": {"$ne": True}})
    if not target:
        raise HTTPException(404, "Member tidak ditemukan")
    await assert_can_manage(user, target)
    if target["member_id"] == user["member_id"]:
        raise HTTPException(400, "Tidak bisa menonaktifkan akun sendiri")
    await db.users.update_one({"member_id": member_id}, {"$set": {"active": bool(body.active)}})
    await svc.recompute(persist=True)
    return {"ok": True, "active": bool(body.active)}


# ============================================================== TUPO MANUAL
@router.get("/tupo")
async def list_tupo(period_key: Optional[str] = None, user=Depends(current_user)):
    key = period_key or await core.current_period_key()
    rows = await db.tupo_overrides.find({"period_key": key}).sort("member_id", 1).to_list(100000)
    return {"period_key": key, "label": core.period_label(key), "rows": [clean(r) for r in rows]}


@router.post("/tupo")
async def set_tupo(body: TupoIn, user=Depends(require_roles("admin_pusat", "admin_provinsi"))):
    ids = [i.strip().upper() for i in (body.member_ids or []) if i and i.strip()]
    if not ids:
        raise HTTPException(400, "Pilih minimal satu member")
    key = body.period_key or await core.current_period_key()
    await core.ensure_period(key)
    ok, failed = [], []
    for mid in ids:
        target = await db.users.find_one({"member_id": mid, "deleted": {"$ne": True}})
        if not target:
            failed.append({"member_id": mid, "reason": "Tidak ditemukan"})
            continue
        try:
            await assert_can_manage(user, target)
        except HTTPException as e:
            failed.append({"member_id": mid, "reason": e.detail})
            continue
        if body.clear:
            await db.tupo_overrides.delete_one({"period_key": key, "member_id": mid})
        else:
            await db.tupo_overrides.update_one(
                {"period_key": key, "member_id": mid},
                {"$set": {"id": new_id(), "period_key": key, "member_id": mid,
                          "member_name": target.get("name", ""), "ok": bool(body.ok),
                          "note": body.note or "", "set_by": user["member_id"],
                          "set_by_name": user.get("name", ""), "set_at": now_iso()}},
                upsert=True)
        ok.append(mid)
    await svc.recompute(persist=True)
    action = ("dihapus penandaannya" if body.clear
              else ("ditandai Tupo terpenuhi" if body.ok else "ditandai Tupo TIDAK terpenuhi"))
    return {"ok_ids": ok, "failed": failed, "period_key": key,
            "message": f"{len(ok)} member {action} untuk {core.period_label(key)}"}


# ============================================================== PROFILE / REGIONS
@router.put("/me")
async def update_me(body: ProfileIn, user=Depends(current_user)):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(400, "Tidak ada perubahan")
    if "name" in patch and not str(patch["name"]).strip():
        raise HTTPException(400, "Nama tidak boleh kosong")
    patch["updated_at"] = now_iso()
    await db.users.update_one({"member_id": user["member_id"]}, {"$set": patch})
    fresh = await db.users.find_one({"member_id": user["member_id"]})
    return {"user": core.strip_secrets(clean(fresh), user["role"])}


@router.get("/regions")
async def list_regions():
    return regions.payload()


@router.get("/public/company")
async def public_company():
    st = await get_settings()
    return {"company_name": st.get("company_name") or "Hybrid MLM",
            "company_tagline": st.get("company_tagline") or "Backoffice & Perhitungan Bonus"}


# ============================================================== HIERARCHY
@router.get("/hierarchy")
async def hierarchy(user=Depends(current_user)):
    """Struktur organisasi: Admin Pusat > Admin Provinsi > Stokis > Member."""
    await core.assert_page(user, "network")
    q: Dict[str, Any] = {"deleted": {"$ne": True}}
    q.update(await scope_query(user))
    rows = await db.users.find(q).to_list(100000)
    st = await get_settings()

    pusat = [clean(r) for r in rows if r["role"] == "admin_pusat"]
    provinsi = [r for r in rows if r["role"] == "admin_provinsi"]
    stokis = [r for r in rows if r["role"] == "stokis"]
    members = [r for r in rows if r["role"] == "member"]

    def m_of_stokis(sid):
        return [m for m in members if m.get("stokis_id") == sid]

    def stokis_node(s):
        mine = m_of_stokis(s["member_id"])
        return {"member_id": s["member_id"], "name": s.get("name", ""),
                "province": s.get("province", ""), "city": s.get("city", ""),
                "active": s.get("active", True),
                "member_count": len(mine),
                "active_member_count": sum(1 for m in mine if m.get("active", True)),
                "appv": s.get("stat_appv", 0),
                "members": [{"member_id": m["member_id"], "name": m.get("name", ""),
                             "rank": m.get("stat_rank", "Member"),
                             "membership": m.get("stat_membership", "None"),
                             "appv": m.get("stat_appv", 0),
                             "active": m.get("active", True)} for m in mine]}

    prov_names = sorted({(p.get("province") or "") for p in provinsi}
                        | {(s.get("province") or "") for s in stokis})
    provinces = []
    for pn in prov_names:
        admins = [{"member_id": p["member_id"], "name": p.get("name", ""),
                   "active": p.get("active", True)} for p in provinsi
                  if (p.get("province") or "") == pn]
        sts = [stokis_node(s) for s in stokis if (s.get("province") or "") == pn]
        provinces.append({"province": pn or "(Tanpa provinsi)", "admins": admins,
                          "stokis": sts, "stokis_count": len(sts),
                          "member_count": sum(x["member_count"] for x in sts)})

    orphan = [{"member_id": m["member_id"], "name": m.get("name", ""),
               "province": m.get("province", ""), "rank": m.get("stat_rank", "Member"),
               "active": m.get("active", True)}
              for m in members if not m.get("stokis_id")]

    return {"company_name": st.get("company_name"), "admin_pusat": pusat,
            "provinces": provinces, "unassigned_members": orphan,
            "totals": {"admin_pusat": len(pusat), "admin_provinsi": len(provinsi),
                       "stokis": len(stokis), "member": len(members)}}


@router.delete("/members/{member_id}")
async def delete_member(member_id: str, user=Depends(require_roles("admin_pusat"))):
    target = await db.users.find_one({"member_id": member_id, "deleted": {"$ne": True}})
    if not target:
        raise HTTPException(404, "Member tidak ditemukan")
    if target["member_id"] == user["member_id"]:
        raise HTTPException(400, "Tidak bisa menghapus akun sendiri")
    kids = await db.users.count_documents({"$or": [{"sponsor_id": member_id}, {"placement_id": member_id}],
                                           "deleted": {"$ne": True}})
    if kids:
        raise HTTPException(400, f"Member masih punya {kids} downline. Pindahkan downline terlebih dahulu.")
    await db.users.update_one({"member_id": member_id},
                              {"$set": {"deleted": True, "active": False, "deleted_at": now_iso()}})
    await db.transactions.delete_many({"member_id": member_id})
    await svc.recompute(persist=True)
    return {"ok": True}


# ============================================================== ANNOUNCEMENTS
CATEGORIES = ["pengumuman", "promo", "reward", "penting", "berita"]


@router.get("/announcements")
async def list_announcements(category: Optional[str] = None, limit: int = 100,
                            user=Depends(current_user)):
    await core.assert_page(user, "announcements")
    q: Dict[str, Any] = {}
    if category:
        q["category"] = category
    if user["role"] != "admin_pusat":
        q["published"] = True
        q["$or"] = [{"target_roles": {"$size": 0}}, {"target_roles": user["role"]}]
    rows = await db.announcements.find(q).sort([("pinned", -1), ("created_at", -1)]).to_list(limit)
    return [clean(r) for r in rows]


@router.post("/announcements")
async def create_announcement(body: AnnouncementIn, user=Depends(require_roles("admin_pusat"))):
    title = (body.title or "").strip()
    if len(title) < 3:
        raise HTTPException(400, "Judul pengumuman minimal 3 karakter")
    if not (body.body or "").strip():
        raise HTTPException(400, "Isi pengumuman wajib diisi")
    if body.category not in CATEGORIES:
        raise HTTPException(400, f"Kategori harus salah satu dari: {', '.join(CATEGORIES)}")
    bad = [r for r in (body.target_roles or []) if r not in core.ROLES]
    if bad:
        raise HTTPException(400, f"Peran tujuan tidak dikenali: {', '.join(bad)}")
    doc = {"id": new_id(), "title": title, "body": body.body.strip(),
           "category": body.category, "pinned": bool(body.pinned),
           "published": bool(body.published), "image": body.image or "",
           "target_roles": list(body.target_roles or []),
           "author_id": user["member_id"], "author_name": user.get("name", ""),
           "created_at": now_iso(), "updated_at": now_iso()}
    await db.announcements.insert_one(dict(doc))
    return clean(doc)


@router.put("/announcements/{aid}")
async def update_announcement(aid: str, body: AnnouncementIn,
                              user=Depends(require_roles("admin_pusat"))):
    if len((body.title or "").strip()) < 3:
        raise HTTPException(400, "Judul pengumuman minimal 3 karakter")
    if not (body.body or "").strip():
        raise HTTPException(400, "Isi pengumuman wajib diisi")
    if body.category not in CATEGORIES:
        raise HTTPException(400, f"Kategori harus salah satu dari: {', '.join(CATEGORIES)}")
    patch = {"title": body.title.strip(), "body": body.body.strip(),
             "category": body.category, "pinned": bool(body.pinned),
             "published": bool(body.published), "image": body.image or "",
             "target_roles": list(body.target_roles or []), "updated_at": now_iso()}
    r = await db.announcements.update_one({"id": aid}, {"$set": patch})
    if not r.matched_count:
        raise HTTPException(404, "Pengumuman tidak ditemukan")
    return clean(await db.announcements.find_one({"id": aid}))


@router.delete("/announcements/{aid}")
async def delete_announcement(aid: str, user=Depends(require_roles("admin_pusat"))):
    r = await db.announcements.delete_one({"id": aid})
    if not r.deleted_count:
        raise HTTPException(404, "Pengumuman tidak ditemukan")
    return {"ok": True}


# ============================================================== PRODUCTS
@router.get("/products")
async def list_products(user=Depends(current_user)):
    await core.assert_any_page(user, ["products", "transactions"])
    rows = await db.products.find({}).sort("name", 1).to_list(1000)
    return [clean(r) for r in rows]


@router.post("/products")
async def create_product(body: ProductIn, user=Depends(require_roles("admin_pusat", "admin_provinsi"))):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.products.insert_one(dict(doc))
    return clean(doc)


@router.put("/products/{pid}")
async def update_product(pid: str, body: ProductIn,
                         user=Depends(require_roles("admin_pusat", "admin_provinsi"))):
    r = await db.products.update_one({"id": pid}, {"$set": body.model_dump()})
    if not r.matched_count:
        raise HTTPException(404, "Produk tidak ditemukan")
    return clean(await db.products.find_one({"id": pid}))


@router.delete("/products/{pid}")
async def delete_product(pid: str, user=Depends(require_roles("admin_pusat"))):
    await db.products.delete_one({"id": pid})
    return {"ok": True}


# ============================================================== SETTINGS / PLAN
@router.get("/settings")
async def read_settings(user=Depends(current_user)):
    st = await get_settings()
    if user["role"] != "admin_pusat":
        st = {k: v for k, v in st.items()
              if k not in ("bonus_disabled_global", "pages_blocked_global")}
    return {"settings": st, "engine_config": build_config(st.get("engine") or {})}


@router.put("/settings")
async def write_settings(body: SettingsIn, user=Depends(require_roles("admin_pusat"))):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if "bonus_disabled_global" in patch:
        bad = [k for k in patch["bonus_disabled_global"] if k not in core.BONUS_KEYS]
        if bad:
            raise HTTPException(400, f"Jenis bonus tidak dikenali: {', '.join(bad)}")
        patch["bonus_disabled_global"] = sorted(set(patch["bonus_disabled_global"]))
    if "pages_blocked_global" in patch:
        cleaned: Dict[str, List[str]] = {}
        for role, keys in (patch["pages_blocked_global"] or {}).items():
            if role not in core.ROLES or role == "admin_pusat":
                raise HTTPException(400, f"Peran tidak dikenali: {role}")
            allowed = [p["key"] for p in core.PAGES if role in p["roles"]]
            bad = [k for k in (keys or []) if k not in allowed]
            if bad:
                raise HTTPException(
                    400, f"Halaman {', '.join(bad)} tidak berlaku untuk {ROLE_LABEL[role]}")
            cleaned[role] = sorted(set(keys or []))
        patch["pages_blocked_global"] = cleaned
    await db.settings.update_one({"id": "global"}, {"$set": patch}, upsert=True)
    await svc.recompute(persist=True)
    st = await get_settings()
    return {"settings": st, "engine_config": build_config(st.get("engine") or {})}


@router.get("/plan")
async def marketing_plan(user=Depends(current_user)):
    """Reference data for the UI: membership table, rank table, bonus rules."""
    await core.assert_page(user, "plan")
    st = await get_settings()
    cfg = build_config(st.get("engine") or {})
    return {
        "memberships": cfg["memberships"], "ranks": RANK_ORDER,
        "prestasi_rate": cfg["prestasi_rate"], "tupo": cfg["tupo"],
        "rank_rules": cfg["rank_rules"], "gen_rates": cfg["gen_rates"],
        "leadership_depth": cfg["leadership_depth"],
        "bimbingan_rate": cfg["bimbingan_rate"],
        "sharing_profit": cfg["sharing_profit"],
        **({"reward_pool_rate": cfg["reward_pool_rate"],
            "reward_qualify_rank": cfg["reward_qualify_rank"]}
           if user["role"] == "admin_pusat" else {}),
        "pairing_cap_majestic": cfg["pairing_cap_majestic"],
    }


# ============================================================== NETWORK TREE
@router.get("/network")
async def network(root: Optional[str] = None, tree: str = "sponsor", depth: int = 4,
                  user=Depends(current_user)):
    await core.assert_page(user, "network")
    if tree not in ("sponsor", "placement"):
        raise HTTPException(400, "tree harus sponsor atau placement")
    parent_field = "sponsor_id" if tree == "sponsor" else "placement_id"
    root_id = (root or user["member_id"]).upper()
    if user["role"] == "member":
        allowed = await _in_subtree(user["member_id"], root_id, parent_field)
        if not allowed:
            root_id = user["member_id"]

    users = {u["member_id"]: u for u in await svc.all_users()}
    snap = await svc.live_snapshot()
    res_map = {r["member_id"]: r for r in (snap["run"]["results"] if snap["run"] else [])}
    kids: Dict[str, List[str]] = {}
    for u in users.values():
        p = u.get(parent_field)
        if p:
            kids.setdefault(p, []).append(u["member_id"])

    def build(mid: str, level: int) -> Dict[str, Any]:
        u = users.get(mid, {})
        r = res_map.get(mid, {})
        node = {
            "member_id": mid, "name": u.get("name", "?"), "role": u.get("role", "member"),
            "active": u.get("active", True), "rank": r.get("rank", u.get("stat_rank", "Member")),
            "membership": r.get("membership", u.get("stat_membership", "None")),
            "ppv": r.get("ppv", 0), "ppv_perkembangan": r.get("ppv_perkembangan", 0),
            "ppv_penjualan": r.get("ppv_penjualan", 0),
            "appv": r.get("appv", u.get("stat_appv", 0)), "atnpv": r.get("atnpv", u.get("stat_atnpv", 0)),
            "tnpv": r.get("tnpv", 0), "tupo_ok": r.get("tupo_ok", False),
            "tupo_required": r.get("tupo_required", 0),
            "tupo_manual": r.get("tupo_manual", False),
            "ku": r.get("ku", 0), "kg": r.get("kg", 0),
            "aku": r.get("aku", 0), "akg": r.get("akg", 0),
            "total_bonus_bv": r.get("total_bonus_bv", 0),
            "sponsor_id": u.get("sponsor_id"), "placement_id": u.get("placement_id"),
            "child_count": len(kids.get(mid, [])), "children": [],
        }
        if level < depth:
            for c in sorted(kids.get(mid, [])):
                node["children"].append(build(c, level + 1))
        return node

    if root_id not in users:
        raise HTTPException(404, "Member tidak ditemukan")
    return {"tree": tree, "root": root_id, "period_key": snap["period_key"], "node": build(root_id, 0)}


async def _in_subtree(ancestor: str, node: str, parent_field: str) -> bool:
    cur, guard = node, 0
    while cur and guard < 200:
        if cur == ancestor:
            return True
        doc = await db.users.find_one({"member_id": cur}, {parent_field: 1})
        cur = (doc or {}).get(parent_field)
        guard += 1
    return False
