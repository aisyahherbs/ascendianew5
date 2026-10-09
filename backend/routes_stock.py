"""Stok produk per gudang pusat / stokis + riwayat mutasi."""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException

import core
from core import clean, current_user, db, new_id, now_iso, require_roles
from models import StockAdjustIn, StockTransferIn

router = APIRouter()

PUSAT = "PUSAT"


async def owner_label(owner_id: str) -> str:
    if owner_id == PUSAT:
        return "Gudang Pusat"
    u = await db.users.find_one({"member_id": owner_id}, {"name": 1})
    return (u or {}).get("name", owner_id)


async def _assert_owner_access(user: Dict[str, Any], owner_id: str, write: bool = False):
    role = user["role"]
    if role == "admin_pusat":
        return
    if role == "admin_provinsi":
        if owner_id == PUSAT:
            return
        u = await db.users.find_one({"member_id": owner_id}, {"province": 1})
        if not u or u.get("province") != user.get("province"):
            raise HTTPException(403, "Stokis di luar provinsi Anda")
        return
    if role == "stokis":
        if owner_id != user["member_id"]:
            raise HTTPException(403, "Hanya bisa melihat stok stokis Anda")
        return
    raise HTTPException(403, "Tidak diizinkan")


async def get_qty(product_id: str, owner_id: str) -> Optional[float]:
    row = await db.stocks.find_one({"product_id": product_id, "owner_id": owner_id})
    return None if not row else float(row.get("qty", 0))


async def apply_stock(product_id: str, owner_id: str, delta: float, mtype: str,
                      note: str, created_by: str, ref_member_id: Optional[str] = None,
                      absolute: Optional[float] = None, allow_negative: bool = False) -> float:
    row = await db.stocks.find_one({"product_id": product_id, "owner_id": owner_id})
    current = float(row.get("qty", 0)) if row else 0.0
    after = float(absolute) if absolute is not None else current + delta
    if after < 0 and not allow_negative:
        raise HTTPException(400, f"Stok tidak cukup (tersedia {current:g})")
    if row:
        await db.stocks.update_one({"id": row["id"]}, {"$set": {"qty": after, "updated_at": now_iso()}})
    else:
        await db.stocks.insert_one({"id": new_id(), "product_id": product_id, "owner_id": owner_id,
                                    "qty": after, "updated_at": now_iso()})
    await db.stock_movements.insert_one({
        "id": new_id(), "product_id": product_id, "owner_id": owner_id, "type": mtype,
        "qty": (after - current) if absolute is not None else delta, "qty_after": after,
        "note": note or "", "ref_member_id": ref_member_id, "created_by": created_by,
        "created_at": now_iso(),
    })
    return after


@router.get("/stock/owners")
async def stock_owners(user=Depends(current_user)):
    await core.assert_any_page(user, ["stock", "products", "transactions"])
    role = user["role"]
    out: List[Dict[str, Any]] = []
    if role in ("admin_pusat", "admin_provinsi"):
        out.append({"owner_id": PUSAT, "name": "Gudang Pusat", "role": "pusat"})
        q: Dict[str, Any] = {"role": "stokis", "deleted": {"$ne": True}}
        if role == "admin_provinsi":
            q["province"] = user.get("province")
        for s in await db.users.find(q, {"member_id": 1, "name": 1, "province": 1}).sort("member_id", 1).to_list(1000):
            out.append({"owner_id": s["member_id"], "name": s.get("name", ""),
                        "role": "stokis", "province": s.get("province", "")})
    elif role == "stokis":
        out.append({"owner_id": user["member_id"], "name": user.get("name", ""), "role": "stokis"})
    return out


@router.get("/stock")
async def stock_list(owner_id: str = PUSAT, user=Depends(current_user)):
    await core.assert_any_page(user, ["stock", "products", "transactions"])
    if user["role"] == "stokis":
        owner_id = user["member_id"]
    await _assert_owner_access(user, owner_id)
    products = await db.products.find({}).sort("name", 1).to_list(2000)
    rows = {r["product_id"]: r for r in await db.stocks.find({"owner_id": owner_id}).to_list(5000)}
    out = []
    for p in products:
        s = rows.get(p["id"])
        out.append({
            "product_id": p["id"], "name": p["name"], "code": p.get("code", ""),
            "image": p.get("image", ""), "kind": p.get("kind", "penjualan"),
            "category": p.get("category", ""), "unit": p.get("unit", "pcs"),
            "pv": p.get("pv", 0), "price": p.get("price", 0),
            "min_stock": p.get("min_stock", 0), "active": p.get("active", True),
            "qty": float(s.get("qty", 0)) if s else 0.0,
            "tracked": bool(s), "updated_at": (s or {}).get("updated_at"),
        })
    return {"owner_id": owner_id, "owner_name": await owner_label(owner_id), "rows": out}


@router.post("/stock/adjust")
async def stock_adjust(body: StockAdjustIn,
                       user=Depends(require_roles("admin_pusat", "admin_provinsi", "stokis"))):
    owner_id = user["member_id"] if user["role"] == "stokis" else body.owner_id
    await _assert_owner_access(user, owner_id, write=True)
    p = await db.products.find_one({"id": body.product_id})
    if not p:
        raise HTTPException(404, "Produk tidak ditemukan")
    if body.qty < 0:
        raise HTTPException(400, "Jumlah tidak boleh negatif")
    if body.type == "in":
        after = await apply_stock(body.product_id, owner_id, body.qty, "in",
                                  body.note or "Stok masuk", user["member_id"])
    elif body.type == "out":
        after = await apply_stock(body.product_id, owner_id, -body.qty, "out",
                                  body.note or "Stok keluar", user["member_id"])
    elif body.type == "set":
        after = await apply_stock(body.product_id, owner_id, 0, "set",
                                  body.note or "Stok opname", user["member_id"], absolute=body.qty)
    else:
        raise HTTPException(400, "Tipe harus in, out, atau set")
    return {"ok": True, "product_id": body.product_id, "owner_id": owner_id, "qty": after}


@router.post("/stock/transfer")
async def stock_transfer(body: StockTransferIn,
                         user=Depends(require_roles("admin_pusat", "admin_provinsi"))):
    if body.from_owner == body.to_owner:
        raise HTTPException(400, "Gudang asal dan tujuan tidak boleh sama")
    if body.qty <= 0:
        raise HTTPException(400, "Jumlah harus lebih dari 0")
    await _assert_owner_access(user, body.from_owner, write=True)
    await _assert_owner_access(user, body.to_owner, write=True)
    p = await db.products.find_one({"id": body.product_id})
    if not p:
        raise HTTPException(404, "Produk tidak ditemukan")
    note = body.note or f"Transfer {body.from_owner} -> {body.to_owner}"
    await apply_stock(body.product_id, body.from_owner, -body.qty, "transfer_out", note, user["member_id"])
    after = await apply_stock(body.product_id, body.to_owner, body.qty, "transfer_in", note, user["member_id"])
    return {"ok": True, "qty_to": after}


@router.get("/stock/movements")
async def stock_movements(owner_id: Optional[str] = None, product_id: Optional[str] = None,
                          limit: int = 100, user=Depends(current_user)):
    if user["role"] == "stokis":
        owner_id = user["member_id"]
    q: Dict[str, Any] = {}
    if owner_id:
        await _assert_owner_access(user, owner_id)
        q["owner_id"] = owner_id
    elif user["role"] not in ("admin_pusat", "admin_provinsi"):
        raise HTTPException(403, "Tidak diizinkan")
    if product_id:
        q["product_id"] = product_id
    rows = await db.stock_movements.find(q).sort("created_at", -1).to_list(limit)
    names = {p["id"]: p["name"] for p in await db.products.find({}, {"name": 1, "id": 1}).to_list(2000)}
    return [{**clean(r), "product_name": names.get(r["product_id"], "-")} for r in rows]
