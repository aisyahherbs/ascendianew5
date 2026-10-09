"""Transactions, periods, tutup buku, bonus reports, dashboard, simulator."""
import csv
import io
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

import core
import mlm_service as svc
import routes_stock as stock_mod
from core import (clean, current_user, db, get_settings, new_id, now_iso,
                  require_roles, scope_query)
from engine import (MemberIn, TxIn as ETx, MEMBERSHIP_ORDER, RANK_ORDER, run_period,
                    build_config, PV_TO_RP)
from models import SimAddMembersIn, SimIn, TxIn

router = APIRouter()

BONUS_FIELDS = [
    ("bonus_sponsor", "Bonus Sponsor"),
    ("bonus_pasangan", "Bonus Pasangan"),
    ("bonus_bimbingan", "Bonus Bimbingan"),
    ("bonus_prestasi", "Bonus Prestasi"),
    ("bonus_kepemimpinan", "Bonus Kepemimpinan"),
    ("bonus_sharing_profit", "Bonus Sharing Profit"),
    ("bonus_reward", "Special Reward"),
]


async def _visible_ids(user: Dict[str, Any]) -> Optional[set]:
    if user["role"] == "admin_pusat":
        return None
    q: Dict[str, Any] = {"deleted": {"$ne": True}}
    q.update(await scope_query(user))
    rows = await db.users.find(q, {"member_id": 1}).to_list(100000)
    return {r["member_id"] for r in rows}


# ============================================================== TRANSACTIONS
@router.post("/transactions")
async def create_tx(body: TxIn, user=Depends(require_roles("admin_pusat", "admin_provinsi", "stokis"))):
    target = await db.users.find_one({"member_id": body.member_id.strip().upper(),
                                      "deleted": {"$ne": True}})
    if not target:
        raise HTTPException(404, "Member tidak ditemukan")
    if user["role"] != "admin_pusat":
        vis = await _visible_ids(user)
        if vis is not None and target["member_id"] not in vis:
            raise HTTPException(403, "Member di luar wewenang Anda")
    kind, pv = body.kind, float(body.pv or 0)
    product_name = ""
    product = None
    if body.product_id:
        p = await db.products.find_one({"id": body.product_id})
        if not p:
            raise HTTPException(404, "Produk tidak ditemukan")
        product = p
        kind = p["kind"]
        pv = float(p["pv"]) * float(body.qty or 1)
        product_name = p["name"]
    if kind not in ("perkembangan", "penjualan"):
        raise HTTPException(400, "Jenis omset harus perkembangan atau penjualan")
    if pv <= 0:
        raise HTTPException(400, "PV harus lebih dari 0")

    st = await get_settings()
    date = (body.date or now_iso()[:10])[:10]
    key = core.period_key_for_date(date, st["period1_end_day"])
    period = await core.ensure_period(key)
    if period.get("status") == "closed":
        raise HTTPException(400, f"Periode {period['label']} sudah ditutup. Buka kembali periode untuk mengubah data.")

    doc = {"id": new_id(), "member_id": target["member_id"], "member_name": target.get("name", ""),
           "kind": kind, "pv": pv, "date": date, "period_key": key,
           "product_id": body.product_id, "product_name": product_name, "qty": body.qty or 1,
           "note": body.note or "", "created_by": user["member_id"], "created_at": now_iso()}

    # kurangi stok bila produk dipilih dan stoknya memang dilacak
    stock_owner = None
    if product:
        stock_owner = (user["member_id"] if user["role"] == "stokis"
                       else target.get("stokis_id") or stock_mod.PUSAT)
        current = await stock_mod.get_qty(body.product_id, stock_owner)
        if current is not None:
            await stock_mod.apply_stock(body.product_id, stock_owner, -float(body.qty or 1), "sale",
                                        f"Penjualan ke {target['member_id']}", user["member_id"],
                                        ref_member_id=target["member_id"])
            doc["stock_owner"] = stock_owner
    await db.transactions.insert_one(dict(doc))
    await svc.recompute(persist=True)
    return clean(doc)


@router.get("/transactions")
async def list_tx(member_id: Optional[str] = None, period_key: Optional[str] = None,
                  kind: Optional[str] = None, mode: Optional[str] = None,
                  range_key: Optional[str] = None, q: Optional[str] = None,
                  limit: int = 500, user=Depends(current_user)):
    await core.assert_page(user, "transactions")
    query: Dict[str, Any] = {}
    vis = await _visible_ids(user)
    if vis is not None:
        query["member_id"] = {"$in": list(vis)}
    if member_id:
        if vis is not None and member_id.upper() not in vis:
            raise HTTPException(403, "Tidak diizinkan")
        query["member_id"] = member_id.upper()
    rng = None
    if mode:
        rng = await core.resolve_range(mode, range_key)
        if rng["mode"] == "period":
            query["period_key"] = rng["keys"][0]
        else:
            query["period_key"] = {"$in": rng["keys"]}
    elif period_key:
        query["period_key"] = period_key
    if kind:
        query["kind"] = kind
    if q:
        query["$or"] = [{"member_id": {"$regex": q, "$options": "i"}},
                        {"member_name": {"$regex": q, "$options": "i"}},
                        {"product_name": {"$regex": q, "$options": "i"}},
                        {"note": {"$regex": q, "$options": "i"}}]
    rows = await db.transactions.find(query).sort("created_at", -1).to_list(limit)
    return [clean(r) for r in rows]


@router.delete("/transactions/{tid}")
async def delete_tx(tid: str, user=Depends(require_roles("admin_pusat", "admin_provinsi", "stokis"))):
    t = await db.transactions.find_one({"id": tid})
    if not t:
        raise HTTPException(404, "Transaksi tidak ditemukan")
    p = await db.periods.find_one({"key": t["period_key"]})
    if p and p.get("status") == "closed" and user["role"] != "admin_pusat":
        raise HTTPException(400, "Periode sudah ditutup")
    if user["role"] != "admin_pusat":
        vis = await _visible_ids(user)
        if vis is not None and t["member_id"] not in vis:
            raise HTTPException(403, "Tidak diizinkan")
    await db.transactions.delete_one({"id": tid})
    if t.get("product_id") and t.get("stock_owner"):
        try:
            await stock_mod.apply_stock(t["product_id"], t["stock_owner"], float(t.get("qty") or 1),
                                        "in", f"Pembatalan transaksi {t['member_id']}",
                                        user["member_id"], ref_member_id=t["member_id"])
        except Exception:
            pass
    await svc.recompute(persist=True)
    return {"ok": True}


# ============================================================== PERIODS
@router.get("/periods")
async def list_periods(user=Depends(current_user)):
    key = await core.current_period_key()
    await core.ensure_period(key)
    rows = await db.periods.find({}).sort("key", -1).to_list(500)
    out = []
    for p in rows:
        agg = await db.transactions.aggregate([
            {"$match": {"period_key": p["key"]}},
            {"$group": {"_id": "$kind", "pv": {"$sum": "$pv"}, "n": {"$sum": 1}}},
        ]).to_list(10)
        perk = next((a["pv"] for a in agg if a["_id"] == "perkembangan"), 0)
        penj = next((a["pv"] for a in agg if a["_id"] == "penjualan"), 0)
        run = await db.bonus_runs.find_one({"period_key": p["key"]}, {"summary": 1})
        out.append({**clean(p), "omset_perkembangan": perk, "omset_penjualan": penj,
                    "omset_total": perk + penj, "tx_count": sum(a["n"] for a in agg),
                    "is_current": p["key"] == key,
                    "total_bonus_bv": (run or {}).get("summary", {}).get("total_bonus_bv", 0)})
    return out


@router.post("/periods/{key}/close")
async def close_period(key: str, user=Depends(require_roles("admin_pusat"))):
    p = await db.periods.find_one({"key": key})
    if not p:
        raise HTTPException(404, "Periode tidak ditemukan")
    if p.get("status") == "closed":
        raise HTTPException(400, "Periode sudah ditutup")
    await db.periods.update_one({"key": key}, {"$set": {"status": "closed", "closed_at": now_iso(),
                                                        "closed_by": user["member_id"]}})
    await svc.recompute(persist=True)
    run = await db.bonus_runs.find_one({"period_key": key})
    return {"ok": True, "summary": (clean(run) or {}).get("summary", {})}


@router.post("/periods/{key}/reopen")
async def reopen_period(key: str, user=Depends(require_roles("admin_pusat"))):
    p = await db.periods.find_one({"key": key})
    if not p:
        raise HTTPException(404, "Periode tidak ditemukan")
    await db.periods.update_one({"key": key}, {"$set": {"status": "open", "reopened_at": now_iso()}})
    await svc.recompute(persist=True)
    return {"ok": True}


# ============================================================== BONUS REPORTS
def _filter_results(run: Dict[str, Any], vis: Optional[set]) -> Dict[str, Any]:
    if not run or vis is None:
        return run
    out = dict(run)
    out["results"] = [r for r in run.get("results", []) if r["member_id"] in vis]
    return out


@router.get("/bonus/runs")
async def bonus_runs(user=Depends(current_user)):
    await core.assert_any_page(user, ["bonus"])
    rows = await db.bonus_runs.find({}, {"results": 0}).sort("period_key", -1).to_list(200)
    return [clean(r) for r in rows]


@router.get("/bonus/preview")
async def bonus_preview(user=Depends(current_user)):
    await core.assert_any_page(user, ["bonus"])
    vis = await _visible_ids(user)
    snap = await svc.live_snapshot()
    run = snap["run"] or {"summary": {}, "results": []}
    payload = {"period_key": snap["period_key"], "label": core.period_label(snap["period_key"]),
               "closed": snap["closed"], "summary": run.get("summary", {}),
               "results": run.get("results", []), "stokis_fees": run.get("stokis_fees", [])}
    return _filter_results(payload, vis)


@router.get("/bonus/statement/{member_id}")
async def statement(member_id: str, period_key: Optional[str] = None, user=Depends(current_user)):
    await core.assert_any_page(user, ["statement", "members"])
    member_id = member_id.upper()
    if user["role"] == "member" and user["member_id"] != member_id:
        raise HTTPException(403, "Tidak diizinkan")
    vis = await _visible_ids(user)
    if vis is not None and member_id not in vis:
        raise HTTPException(403, "Tidak diizinkan")
    key = period_key or await core.current_period_key()
    run = await db.bonus_runs.find_one({"period_key": key})
    closed = bool(run)
    if not run:
        data = await svc.recompute(persist=False, include_open=key)
        run = data["open_run"]
    if not run:
        raise HTTPException(404, "Data periode tidak tersedia")
    row = next((r for r in run["results"] if r["member_id"] == member_id), None)
    if not row:
        raise HTTPException(404, "Member tidak ada dalam periode ini")
    u = await db.users.find_one({"member_id": member_id})
    return {"period_key": key, "label": core.period_label(key), "closed": closed,
            "member": core.strip_secrets(clean(u), user["role"]),
            "result": clean(row)}


@router.get("/bonus/history/{member_id}")
async def bonus_history(member_id: str, user=Depends(current_user)):
    await core.assert_any_page(user, ["statement", "members"])
    member_id = member_id.upper()
    if user["role"] == "member" and user["member_id"] != member_id:
        raise HTTPException(403, "Tidak diizinkan")
    rows = await db.bonus_runs.find({}).sort("period_key", 1).to_list(200)
    out = []
    for r in rows:
        row = next((x for x in r.get("results", []) if x["member_id"] == member_id), None)
        if row:
            out.append({"period_key": r["period_key"], "label": r.get("label", r["period_key"]),
                        **{f: row.get(f, 0) for f, _ in BONUS_FIELDS},
                        "total_bonus_bv": row.get("total_bonus_bv", 0),
                        "rank": row.get("rank"), "membership": row.get("membership"),
                        "ppv": row.get("ppv", 0)})
    return out


@router.get("/bonus/run/{key}")
async def bonus_run(key: str, user=Depends(current_user)):
    vis = await _visible_ids(user)
    run = await db.bonus_runs.find_one({"period_key": key})
    closed = True
    if not run:
        snap = await svc.live_snapshot()
        if snap["period_key"] == key:
            live = snap["run"]
        else:
            data = await svc.recompute(persist=False, include_open=key)
            live = data["open_run"]
        closed = False
        if not live:
            raise HTTPException(404, "Belum ada perhitungan untuk periode ini")
        run = {"period_key": key, "label": core.period_label(key), "summary": live["summary"],
               "results": live["results"], "stokis_fees": live.get("stokis_fees", [])}
    payload = clean(run)
    payload["closed"] = closed
    return _filter_results(payload, vis)


# ============================================================== AGGREGATE / PAYOUT
async def _runs_for(keys: List[str]) -> List[Dict[str, Any]]:
    """Ambil bonus run untuk daftar period_key (yang sudah ditutup dari DB,
    yang masih terbuka dihitung langsung)."""
    out: List[Dict[str, Any]] = []
    period_docs = {p["key"]: p for p in
                   await db.periods.find({"key": {"$in": keys}}).to_list(10000)}
    closed = {r["period_key"]: r for r in
              await db.bonus_runs.find({"period_key": {"$in": keys}}).to_list(10000)}
    tx_keys = set()
    for k in keys:
        if k in closed:
            continue
        if await db.transactions.count_documents({"period_key": k}, limit=1):
            tx_keys.add(k)
    snap = None
    for k in keys:
        if k in closed:
            r = closed[k]
            out.append({"period_key": k, "label": r.get("label", core.period_label(k)),
                        "status": "closed", "summary": r.get("summary", {}),
                        "results": r.get("results", []),
                        "stokis_fees": r.get("stokis_fees", [])})
            continue
        if k not in period_docs and k not in tx_keys:
            continue
        if k not in tx_keys:
            out.append({"period_key": k, "label": core.period_label(k), "status": "open",
                        "summary": {}, "results": [], "stokis_fees": []})
            continue
        if snap is None:
            snap = await svc.live_snapshot()
        live = snap["run"] if snap["period_key"] == k else None
        if live is None:
            data = await svc.recompute(persist=False, include_open=k)
            live = data["open_run"]
        if not live:
            continue
        out.append({"period_key": k, "label": core.period_label(k), "status": "open",
                    "summary": live.get("summary", {}), "results": live.get("results", []),
                    "stokis_fees": live.get("stokis_fees", [])})
    return out


def _aggregate_results(runs: List[Dict[str, Any]], vis: Optional[set]) -> List[Dict[str, Any]]:
    """Gabungkan baris hasil per member dari beberapa periode."""
    agg: Dict[str, Dict[str, Any]] = {}
    for run in runs:
        for r in run.get("results", []):
            if vis is not None and r["member_id"] not in vis:
                continue
            cur = agg.get(r["member_id"])
            if cur is None:
                cur = {"member_id": r["member_id"], "name": r.get("name", ""),
                       "rank": r.get("rank", "Member"), "membership": r.get("membership", "None"),
                       "ppv": 0.0, "ppv_perkembangan": 0.0, "ppv_penjualan": 0.0,
                       "tnpv": 0.0, "atnpv": 0.0, "appv": 0.0, "ku": 0.0, "kg": 0.0,
                       "aku": 0.0, "akg": 0.0, "tupo_required": 0,
                       "tupo_ok": False, "tupo_manual": False,
                       "total_bonus_bv": 0.0, "total_bonus_rp": 0.0, "periods": 0,
                       "lines": [], "pairing_detail": {},
                       **{f: 0.0 for f, _ in BONUS_FIELDS}}
                agg[r["member_id"]] = cur
            for f in ("ppv", "ppv_perkembangan", "ppv_penjualan", "total_bonus_bv", "total_bonus_rp"):
                cur[f] = round(cur[f] + float(r.get(f, 0) or 0), 2)
            for f, _ in BONUS_FIELDS:
                cur[f] = round(cur[f] + float(r.get(f, 0) or 0), 2)
            cur["rank"] = r.get("rank", cur["rank"])
            cur["membership"] = r.get("membership", cur["membership"])
            for f in ("tnpv", "atnpv", "appv", "ku", "kg", "aku", "akg"):
                cur[f] = max(cur[f], float(r.get(f, 0) or 0))
            cur["tupo_required"] = r.get("tupo_required", cur["tupo_required"])
            cur["pairing_detail"] = r.get("pairing_detail") or cur["pairing_detail"]
            for ln in (r.get("lines") or []):
                cur["lines"].append({**ln, "period": run.get("label", run["period_key"])})
            cur["tupo_ok"] = cur["tupo_ok"] or bool(r.get("tupo_ok"))
            cur["tupo_manual"] = cur["tupo_manual"] or bool(r.get("tupo_manual"))
            cur["periods"] += 1
    return sorted(agg.values(), key=lambda x: -x["total_bonus_bv"])


@router.get("/payout")
async def payout(mode: str = "period", key: Optional[str] = None,
                 user=Depends(require_roles("admin_pusat", "admin_provinsi", "stokis"))):
    """Detail omset masuk, bonus yang dikeluarkan, persentase payout & sisa perusahaan."""
    await core.assert_any_page(user, ["payout", "bonus"])
    vis = await _visible_ids(user)
    rng = await core.resolve_range(mode, key)
    runs = await _runs_for(rng["keys"])
    results = _aggregate_results(runs, vis)

    omset_perk = round(sum(r["ppv_perkembangan"] for r in results), 2)
    omset_penj = round(sum(r["ppv_penjualan"] for r in results), 2)
    omset_total = round(omset_perk + omset_penj, 2)
    per_type = {label: round(sum(r.get(f, 0) for r in results), 2) for f, label in BONUS_FIELDS}
    bonus_total = round(sum(r["total_bonus_bv"] for r in results), 2)

    fees: Dict[str, Dict[str, Any]] = {}
    for run in runs:
        for f in run.get("stokis_fees", []):
            if vis is not None and f["stokis_id"] not in vis:
                continue
            cur = fees.setdefault(f["stokis_id"], {"stokis_id": f["stokis_id"],
                                                   "name": f.get("name", ""),
                                                   "province": f.get("province", ""),
                                                   "omset_pv": 0.0, "fee_bv": 0.0})
            cur["omset_pv"] = round(cur["omset_pv"] + float(f.get("omset_pv", 0) or 0), 2)
            cur["fee_bv"] = round(cur["fee_bv"] + float(f.get("fee_bv", 0) or 0), 2)
    fee_total = round(sum(f["fee_bv"] for f in fees.values()), 2)

    payout_pct = round(bonus_total / omset_total * 100, 2) if omset_total else 0.0
    fee_pct = round(fee_total / omset_total * 100, 2) if omset_total else 0.0
    total_payout = round(bonus_total + fee_total, 2)
    total_payout_pct = round(total_payout / omset_total * 100, 2) if omset_total else 0.0
    company_bv = round(omset_total - total_payout, 2)
    company_pct = round(100 - total_payout_pct, 2) if omset_total else 0.0

    # rincian per produk dari transaksi
    txq: Dict[str, Any] = {"period_key": {"$in": rng["keys"]}}
    if vis is not None:
        txq["member_id"] = {"$in": list(vis)}
    txs = await db.transactions.find(txq).to_list(200000)
    prod: Dict[str, Dict[str, Any]] = {}
    kind_split = {"perkembangan": 0.0, "penjualan": 0.0}
    for t in txs:
        kind_split[t.get("kind", "penjualan")] = round(
            kind_split.get(t.get("kind", "penjualan"), 0.0) + float(t.get("pv", 0) or 0), 2)
        name = t.get("product_name") or "(PV manual / tanpa produk)"
        cur = prod.setdefault(name, {"product_name": name, "qty": 0.0, "pv": 0.0, "tx_count": 0})
        cur["qty"] = round(cur["qty"] + float(t.get("qty") or 0), 2)
        cur["pv"] = round(cur["pv"] + float(t.get("pv") or 0), 2)
        cur["tx_count"] += 1

    period_rows = []
    for run in runs:
        s = run.get("summary", {})
        rres = [r for r in run.get("results", []) if vis is None or r["member_id"] in vis]
        o = round(sum(r.get("ppv", 0) for r in rres), 2)
        b = round(sum(r.get("total_bonus_bv", 0) for r in rres), 2)
        fp = round(sum(float(f.get("fee_bv", 0) or 0) for f in run.get("stokis_fees", [])
                       if vis is None or f["stokis_id"] in vis), 2)
        period_rows.append({
            "period_key": run["period_key"], "label": run["label"], "status": run["status"],
            "omset_pv": o, "omset_perkembangan": round(sum(r.get("ppv_perkembangan", 0) for r in rres), 2),
            "omset_penjualan": round(sum(r.get("ppv_penjualan", 0) for r in rres), 2),
            "bonus_bv": b, "stokis_fee_bv": fp,
            "total_payout_bv": round(b + fp, 2),
            "payout_percent": round((b + fp) / o * 100, 2) if o else 0.0,
            "bonus_percent": round(b / o * 100, 2) if o else 0.0,
            "sharing_pool": s.get("sharing_profit_pools", {}),
            "reward_pool_bv": s.get("reward_pool_bv", 0),
        })

    return {
        "mode": rng["mode"], "key": rng["key"], "label": rng["label"],
        "date_from": rng["start"], "date_to": rng["end"],
        "year": rng["year"], "month": rng["month"],
        "period_keys": rng["keys"], "periods": period_rows,
        "omset": {"perkembangan": omset_perk, "penjualan": omset_penj, "total": omset_total,
                  "total_rp": round(omset_total * PV_TO_RP, 2),
                  "by_tx_kind": kind_split, "tx_count": len(txs)},
        "bonus": {"per_type": per_type, "total_bv": bonus_total,
                  "total_rp": round(bonus_total * PV_TO_RP, 2)},
        "stokis_fee": {"total_bv": fee_total, "percent": fee_pct,
                       "total_rp": round(fee_total * PV_TO_RP, 2),
                       "rows": sorted(fees.values(), key=lambda x: -x["fee_bv"])},
        "total_payout_bv": total_payout,
        "total_payout_rp": round(total_payout * PV_TO_RP, 2),
        "total_payout_percent": total_payout_pct,
        "payout_percent": payout_pct, "company_percent": company_pct,
        "company_bv": company_bv, "company_rp": round(company_bv * PV_TO_RP, 2),
        "member_count": len(results),
        "earner_count": sum(1 for r in results if r["total_bonus_bv"] > 0),
        "results": results,
        "products": sorted(prod.values(), key=lambda x: -x["pv"]),
        "pv_to_rp": PV_TO_RP,
    }


@router.get("/bonus/export")
async def export_range_csv(mode: str = "period", key: Optional[str] = None,
                           user=Depends(require_roles("admin_pusat", "admin_provinsi", "stokis"))):
    vis = await _visible_ids(user)
    rng = await core.resolve_range(mode, key)
    runs = await _runs_for(rng["keys"])
    results = _aggregate_results(runs, vis)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([f"Laporan Bonus - {rng['label']}"])
    w.writerow([f"Rentang tanggal: {rng['start']} s/d {rng['end']}"])
    w.writerow([])
    w.writerow(["ID Member", "Nama", "Peringkat", "Membership", "PPV", "PPV Perkembangan",
                "PPV Penjualan", "Tupo"] +
               [label for _, label in BONUS_FIELDS] + ["Total BV", "Total Rupiah"])
    for r in results:
        w.writerow([r["member_id"], r["name"], r["rank"], r["membership"], r["ppv"],
                    r["ppv_perkembangan"], r["ppv_penjualan"],
                    "OK" if r["tupo_ok"] else "BELUM"] +
                   [r.get(f, 0) for f, _ in BONUS_FIELDS] +
                   [r["total_bonus_bv"], r["total_bonus_rp"]])
    buf.seek(0)
    fname = f"bonus-{rng['mode']}-{rng['key']}.csv"
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.get("/bonus/export/{key}")
async def export_csv(key: str, user=Depends(require_roles("admin_pusat", "admin_provinsi", "stokis"))):
    vis = await _visible_ids(user)
    run = await db.bonus_runs.find_one({"period_key": key})
    if not run:
        data = await svc.recompute(persist=False, include_open=key)
        run = data["open_run"]
    if not run:
        raise HTTPException(404, "Data tidak tersedia")
    results = [r for r in run["results"] if vis is None or r["member_id"] in vis]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["ID Member", "Nama", "Peringkat", "Membership", "PPV", "PPV Perkembangan",
                "PPV Penjualan", "TNPV", "ATNPV", "Tupo"] +
               [label for _, label in BONUS_FIELDS] + ["Total BV", "Total Rupiah"])
    for r in results:
        w.writerow([r["member_id"], r["name"], r["rank"], r["membership"], r["ppv"],
                    r["ppv_perkembangan"], r["ppv_penjualan"], r["tnpv"], r["atnpv"],
                    "OK" if r["tupo_ok"] else "BELUM"] +
                   [r.get(f, 0) for f, _ in BONUS_FIELDS] +
                   [r["total_bonus_bv"], r["total_bonus_rp"]])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="bonus-{key}.csv"'})


# ============================================================== DASHBOARD
@router.get("/dashboard")
async def dashboard(user=Depends(current_user)):
    role = user["role"]
    snap = await svc.live_snapshot()
    run = snap["run"] or {"summary": {}, "results": []}
    res_map = {r["member_id"]: r for r in run.get("results", [])}
    period = await db.periods.find_one({"key": snap["period_key"]})
    payload: Dict[str, Any] = {"role": role, "period": clean(period),
                               "period_closed": snap["closed"]}

    if role in ("admin_pusat", "admin_provinsi"):
        vis = await _visible_ids(user)
        q: Dict[str, Any] = {"deleted": {"$ne": True}}
        q.update(await scope_query(user))
        total = await db.users.count_documents(q)
        active = await db.users.count_documents({**q, "active": True})
        by_role = {}
        for r in core.ROLES:
            by_role[r] = await db.users.count_documents({**q, "role": r})
        results = [r for r in run.get("results", []) if vis is None or r["member_id"] in vis]
        omset_perk = sum(r["ppv_perkembangan"] for r in results)
        omset_penj = sum(r["ppv_penjualan"] for r in results)
        comp = {label: round(sum(r.get(f, 0) for r in results), 2) for f, label in BONUS_FIELDS}
        rank_dist: Dict[str, int] = {}
        for r in results:
            rank_dist[r["rank"]] = rank_dist.get(r["rank"], 0) + 1
        runs = await db.bonus_runs.find({}, {"results": 0}).sort("period_key", 1).to_list(24)
        trend = [{"period": x["period_key"], "label": x.get("label", x["period_key"]),
                  "omset": x["summary"].get("total_omset_pv", 0),
                  "bonus": x["summary"].get("total_bonus_bv", 0)} for x in runs
                 if x["period_key"] != snap["period_key"]]
        trend.append({"period": snap["period_key"], "label": core.period_label(snap["period_key"]),
                      "omset": omset_perk + omset_penj,
                      "bonus": round(sum(r["total_bonus_bv"] for r in results), 2)})
        txq: Dict[str, Any] = {} if vis is None else {"member_id": {"$in": list(vis)}}
        recent = await db.transactions.find(txq).sort("created_at", -1).to_list(10)
        payload.update({
            "total_members": total, "active_members": active, "by_role": by_role,
            "omset_perkembangan": omset_perk, "omset_penjualan": omset_penj,
            "omset_total": omset_perk + omset_penj,
            "total_bonus_bv": round(sum(r["total_bonus_bv"] for r in results), 2),
            "bonus_composition": comp, "rank_distribution": rank_dist,
            "trend": trend[-8:], "recent_transactions": [clean(t) for t in recent],
            "top_earners": sorted([{"member_id": r["member_id"], "name": r["name"],
                                    "rank": r["rank"], "total": r["total_bonus_bv"]}
                                   for r in results], key=lambda x: -x["total"])[:5],
            "stokis_fees": run.get("stokis_fees", []),
            "stokis_fee_total": round(sum(float(f.get("fee_bv", 0) or 0)
                                          for f in run.get("stokis_fees", [])), 2),
        })
    elif role == "stokis":
        members = await db.users.find({"stokis_id": user["member_id"], "deleted": {"$ne": True}}
                                      ).to_list(100000)
        ids = {m["member_id"] for m in members}
        results = [r for r in run.get("results", []) if r["member_id"] in ids]
        st = await get_settings()
        omset = sum(r["ppv"] for r in results)
        payload.update({
            "member_count": len(members),
            "active_count": sum(1 for m in members if m.get("active", True)),
            "omset_total": omset,
            "omset_perkembangan": sum(r["ppv_perkembangan"] for r in results),
            "omset_penjualan": sum(r["ppv_penjualan"] for r in results),
            "fee_percent": st.get("stokis_fee_percent", 0),
            "fee_bv": round(omset * float(st.get("stokis_fee_percent") or 0) / 100.0, 2),
            "members": [{"member_id": m["member_id"], "name": m.get("name"),
                         "rank": res_map.get(m["member_id"], {}).get("rank", "Member"),
                         "membership": res_map.get(m["member_id"], {}).get("membership", "None"),
                         "ppv": res_map.get(m["member_id"], {}).get("ppv", 0),
                         "total_bonus_bv": res_map.get(m["member_id"], {}).get("total_bonus_bv", 0),
                         "active": m.get("active", True)} for m in members][:200],
            "my": clean(res_map.get(user["member_id"], {})),
        })
    else:
        mine = res_map.get(user["member_id"], {})
        sp = await db.users.count_documents({"sponsor_id": user["member_id"], "deleted": {"$ne": True}})
        pl = await db.users.count_documents({"placement_id": user["member_id"], "deleted": {"$ne": True}})
        try:
            hist = await bonus_history(user["member_id"], user)
        except HTTPException:
            # halaman Slip Bonus ditutup untuk pengguna ini -> riwayat tidak ditampilkan
            hist = []
        payload.update({"my": clean(mine), "frontline_sponsor": sp, "frontline_placement": pl,
                        "history": hist[-8:]})
    return payload


# ============================================================== SIMULATOR
@router.post("/simulator")
async def simulate(body: SimIn, user=Depends(current_user)):
    await core.assert_any_page(user, ["simulator"])
    if not body.members:
        raise HTTPException(400, "Minimal 1 member")
    st = await get_settings()
    cfg = st.get("engine") or {}
    members, txs = [], []
    for m in body.members:
        members.append(MemberIn(
            id=m.id, sponsor_id=m.sponsor_id or None,
            placement_id=m.placement_id or m.sponsor_id or None, name=m.name or m.id,
            appv_perkembangan=m.appv_perkembangan, appv=m.appv, atnpv=m.atnpv,
            rank=m.rank or "Member", membership=m.membership or "None", carry=dict(m.carry or {})))
        if m.perkembangan_pv:
            txs.append(ETx(member_id=m.id, pv=float(m.perkembangan_pv), kind="perkembangan"))
        if m.penjualan_pv:
            txs.append(ETx(member_id=m.id, pv=float(m.penjualan_pv), kind="penjualan"))
    res = run_period(members, txs, body.period_label or "Simulasi", cfg)
    return res


# ============================================== SIMULASI TAMBAH MEMBER (tanpa simpan)
def _pick_balanced_slot(root: str, kids: Dict[str, List[str]], width: int = 2) -> str:
    """Titik placement kosong paling seimbang di bawah `root` (aturan biner maks 2 kaki).

    Memakai helper bersama `core.pick_balanced_slot` supaya perilaku simulasi
    IDENTIK dengan pendaftaran member nyata.
    """
    return core.pick_balanced_slot(root, kids, width)


def _sim_no(mid: str) -> int:
    """Ambil nomor urut dari ID member simulasi (SIM0007 -> 7)."""
    try:
        return int(str(mid)[3:])
    except Exception:
        return 0


@router.post("/simulator/add-members")
async def simulate_add_members(body: SimAddMembersIn,
                               user=Depends(require_roles("admin_pusat"))):
    """Hitung dampak penambahan member baru terhadap bonus jaringan — bisa bertingkat.

    Murni simulasi: tidak ada member, transaksi, atau pengaturan yang disimpan.
    Member simulasi batch sebelumnya dikirim ulang lewat `existing_sim` sehingga
    batch berikutnya bisa ditempel di bawah member simulasi mana pun.
    """
    mode = (body.mode or "single").strip().lower()
    if mode not in ("single", "per_member"):
        raise HTTPException(400, "Mode harus 'single' atau 'per_member'")
    per = int(body.count or 0)
    # count = 0 hanya boleh untuk "hitung ulang" jaringan simulasi yang sudah ada
    if per == 0 and body.existing_sim and mode == "single":
        pass
    elif per < 1 or per > 500:
        raise HTTPException(400, "Jumlah member simulasi harus 1 sampai 500")
    pv_perk = float(body.pv_perkembangan or 0)
    pv_penj = float(body.pv_penjualan or 0)
    if pv_perk < 0 or pv_penj < 0:
        raise HTTPException(400, "Omset tidak boleh negatif")
    if body.membership and body.membership not in MEMBERSHIP_ORDER:
        raise HTTPException(400, f"Membership '{body.membership}' tidak dikenali")
    if body.rank and body.rank not in RANK_ORDER:
        raise HTTPException(400, f"Peringkat '{body.rank}' tidak dikenali")

    st = await get_settings()
    cfg = st.get("engine") or {}
    goff = [k for k in (st.get("bonus_disabled_global") or []) if k in core.BONUS_KEYS]

    async def real_member(mid: Optional[str], label: str) -> Optional[Dict[str, Any]]:
        if not mid:
            return None
        u = await db.users.find_one({"member_id": mid.strip().upper(), "deleted": {"$ne": True}})
        if not u:
            raise HTTPException(400, f"{label} {mid} tidak ditemukan")
        if u.get("role") != "member":
            raise HTTPException(400, f"{label} harus berperan Member (bukan {u.get('role')})")
        return u

    # ---------------------------------------------- keadaan nyata saat ini
    key = await core.current_period_key()
    await core.ensure_period(key)
    data = await svc.recompute(persist=False)
    state = data["state"]
    users = await svc.all_users()
    ov = (await svc.tupo_overrides()).get(key, {})
    real_members = svc._members_in(users, state, ov, goff)
    real_ids = {m.id for m in real_members}

    # ---------------------------------------------- member simulasi batch sebelumnya
    prior_in = list(body.existing_sim or [])
    prior_ids: List[str] = []
    for p in prior_in:
        pid = (p.member_id or "").strip().upper()
        if not pid:
            raise HTTPException(400, "Member simulasi sebelumnya tidak punya ID")
        if pid in real_ids:
            raise HTTPException(400, f"ID member simulasi {pid} bertabrakan dengan member nyata")
        if pid in prior_ids:
            raise HTTPException(400, f"ID member simulasi {pid} ganda")
        prior_ids.append(pid)
    known_ids = real_ids | set(prior_ids)

    prior_members: List[MemberIn] = []
    prior_txs: List[ETx] = []
    prior_meta: Dict[str, Dict[str, Any]] = {}
    for idx, p in enumerate(prior_in):
        pid = prior_ids[idx]
        psp = (p.sponsor_id or "").strip().upper() or None
        ppl = (p.placement_id or "").strip().upper() or None
        if psp and psp not in known_ids:
            raise HTTPException(400, f"Sponsor {psp} pada member simulasi {pid} tidak dikenali")
        if ppl and ppl not in known_ids:
            raise HTTPException(400, f"Placement {ppl} pada member simulasi {pid} tidak dikenali")
        if p.membership and p.membership not in MEMBERSHIP_ORDER:
            raise HTTPException(400, f"Membership '{p.membership}' tidak dikenali")
        if p.rank and p.rank not in RANK_ORDER:
            raise HTTPException(400, f"Peringkat '{p.rank}' tidak dikenali")
        pname = p.name or f"Member Simulasi {_sim_no(pid) or idx + 1}"
        prior_members.append(MemberIn(
            id=pid, sponsor_id=psp, placement_id=ppl or psp, name=pname, active=True,
            appv_perkembangan=0.0, appv=0.0, atnpv=0.0, rank="Member", membership="None", carry={},
            tupo_override=True if p.tupo_ok else None,
            membership_force=p.membership or None, rank_force=p.rank or None,
            bonus_disabled=list(goff),
        ))
        if p.pv_perkembangan:
            prior_txs.append(ETx(member_id=pid, pv=float(p.pv_perkembangan), kind="perkembangan"))
        if p.pv_penjualan:
            prior_txs.append(ETx(member_id=pid, pv=float(p.pv_penjualan), kind="penjualan"))
        prior_meta[pid] = {
            "member_id": pid, "name": pname, "sponsor_id": psp, "placement_id": ppl or psp,
            "pv_perkembangan": float(p.pv_perkembangan or 0),
            "pv_penjualan": float(p.pv_penjualan or 0),
            "membership": p.membership or None, "rank": p.rank or None,
            "tupo_ok": bool(p.tupo_ok), "batch": int(p.batch or 1),
            "level": int(getattr(p, "level", 1) or 1),
        }

    # ---------------------------------------------- induk batch ini
    sponsor = placement = None
    targets: List[str] = []
    if mode == "single":
        sponsor = await real_member(body.sponsor_id, "Sponsor")
        placement = await real_member(body.placement_id, "Placement")
        sp_pick = (body.sponsor_id or "").strip().upper() or None
        pl_pick = (body.placement_id or "").strip().upper() or None
        # sponsor/placement boleh menunjuk member simulasi batch sebelumnya
        if sponsor is None and sp_pick and sp_pick in prior_meta:
            sponsor = {"member_id": sp_pick, "name": prior_meta[sp_pick]["name"], "_sim": True}
        elif sp_pick and sponsor is None:
            raise HTTPException(400, f"Sponsor {sp_pick} tidak ditemukan")
        if placement is None and pl_pick and pl_pick in prior_meta:
            placement = {"member_id": pl_pick, "name": prior_meta[pl_pick]["name"], "_sim": True}
        elif pl_pick and placement is None:
            raise HTTPException(400, f"Placement {pl_pick} tidak ditemukan")
        if sponsor and not sponsor.get("_sim") and sponsor["member_id"] not in real_ids:
            raise HTTPException(400, "Sponsor tidak aktif dalam struktur jaringan")
        lv1 = per
    else:
        seen_t = set()
        for t in (body.targets or []):
            tid = (t or "").strip().upper()
            if not tid or tid in seen_t:
                continue
            if tid not in known_ids:
                raise HTTPException(400, f"Induk {tid} tidak ditemukan di jaringan / simulasi")
            seen_t.add(tid)
            targets.append(tid)
        if not targets:
            raise HTTPException(400, "Pilih minimal satu member sebagai induk (mode per member)")
        lv1 = per * len(targets)

    # ------- kedalaman berantai: tiap member baru diberi `per` anak lagi, dst.
    levels = int(body.levels or 1)
    if levels < 1 or levels > 12:
        raise HTTPException(400, "Kedalaman berantai harus 1 sampai 12 level")
    per_level = [lv1]
    for _ in range(levels - 1):
        per_level.append(per_level[-1] * per)
    total_new = sum(per_level)
    if total_new > 500:
        raise HTTPException(
            400,
            f"Total member baru {total_new} melebihi batas 500 "
            f"({levels} level x {per} per member = {' + '.join(str(x) for x in per_level)}). "
            f"Kurangi jumlah per member atau kedalaman level.")

    # ---------------------------------------------- omset nyata periode berjalan
    tx_rows = []
    if body.include_current_omset:
        tx_rows = await db.transactions.find({"period_key": key}).to_list(200000)
    real_txs = [ETx(member_id=t["member_id"], pv=float(t["pv"]), kind=t["kind"])
                for t in tx_rows if t["member_id"] in real_ids]

    # baseline = jaringan nyata + seluruh member simulasi batch sebelumnya
    base_members = list(real_members) + prior_members
    base_txs = list(real_txs) + prior_txs
    baseline = run_period(list(base_members), list(base_txs), "Sebelum", cfg)
    base_map = {r["member_id"]: r for r in baseline["results"]}

    # ---------------------------------------------- peta anak (sponsor & placement)
    sp_kids: Dict[str, List[str]] = {}
    pl_kids: Dict[str, List[str]] = {}
    for m in base_members:
        sp_kids.setdefault(m.id, [])
        pl_kids.setdefault(m.id, [])
    for m in base_members:
        if m.sponsor_id in sp_kids:
            sp_kids[m.sponsor_id].append(m.id)
        if m.placement_id in pl_kids:
            pl_kids[m.placement_id].append(m.id)

    # ---------------------------------------------- bangun member batch baru
    next_no = (max((_sim_no(i) for i in prior_ids), default=0) + 1) if prior_ids else 1
    sim_members: List[MemberIn] = []
    sim_txs: List[ETx] = []
    assignments: List[Dict[str, Any]] = []
    new_ids: List[str] = []
    batch_no = int(body.batch or 1)

    def make(sid: str, sp: Optional[str], pl: Optional[str], no: int,
             induk: Optional[str], level: int = 1):
        nm = f"Member Simulasi {no}"
        sp_kids.setdefault(sid, [])
        pl_kids.setdefault(sid, [])
        if sp:
            sp_kids.setdefault(sp, []).append(sid)
        if pl:
            pl_kids.setdefault(pl, []).append(sid)
        sim_members.append(MemberIn(
            id=sid, sponsor_id=sp, placement_id=pl or sp, name=nm, active=True,
            appv_perkembangan=0.0, appv=0.0, atnpv=0.0, rank="Member", membership="None", carry={},
            tupo_override=True if body.tupo_ok else None,
            membership_force=body.membership or None, rank_force=body.rank or None,
            bonus_disabled=list(goff),
        ))
        assignments.append({"member_id": sid, "name": nm, "sponsor_id": sp,
                            "placement_id": pl or sp, "induk": induk, "batch": batch_no,
                            "level": level,
                            "pv_perkembangan": pv_perk, "pv_penjualan": pv_penj})
        if pv_perk:
            sim_txs.append(ETx(member_id=sid, pv=pv_perk, kind="perkembangan"))
        if pv_penj:
            sim_txs.append(ETx(member_id=sid, pv=pv_penj, kind="penjualan"))

    counter = {"n": next_no}

    def next_sid() -> tuple:
        no = counter["n"]
        counter["n"] += 1
        return f"SIM{no:04d}", no

    def balanced_pl(root: str) -> str:
        """Titik placement final di bawah `root`: maksimal 2 kaki, kalau penuh turun."""
        return _pick_balanced_slot(root, pl_kids)

    level_ids: List[List[str]] = []

    # -------- LEVEL 1
    ids_lv1: List[str] = []
    if mode == "single":
        sponsor_root = sponsor["member_id"] if sponsor else None
        placement_root = (placement["member_id"] if placement
                          else (sponsor_root if sponsor_root else None))
        for i in range(per):
            sid, no = next_sid()
            ids_lv1.append(sid)
            new_ids.append(sid)
            if sponsor_root is None:
                sp = None if i == 0 else _pick_balanced_slot(ids_lv1[0], sp_kids)
            elif body.spread_sponsor:
                sp = _pick_balanced_slot(sponsor_root, sp_kids)
            else:
                sp = sponsor_root
            if placement_root is None:
                pl = None if i == 0 else balanced_pl(ids_lv1[0])
            else:
                pl = balanced_pl(placement_root)
            make(sid, sp, pl, no, sponsor_root, 1)
    else:
        for t in targets:
            for _ in range(per):
                sid, no = next_sid()
                ids_lv1.append(sid)
                new_ids.append(sid)
                sp = _pick_balanced_slot(t, sp_kids) if body.spread_sponsor else t
                pl = balanced_pl(t)
                make(sid, sp, pl, no, t, 1)
    level_ids.append(ids_lv1)

    # -------- LEVEL 2..N: tiap member baru level sebelumnya dapat `per` anak lagi
    for lv in range(2, levels + 1):
        cur: List[str] = []
        for t in level_ids[-1]:
            for _ in range(per):
                sid, no = next_sid()
                cur.append(sid)
                new_ids.append(sid)
                sp = _pick_balanced_slot(t, sp_kids) if body.spread_sponsor else t
                pl = balanced_pl(t)
                make(sid, sp, pl, no, t, lv)
        level_ids.append(cur)

    all_members = base_members + sim_members
    sim_run = run_period(list(all_members), list(base_txs) + sim_txs, "Simulasi", cfg)
    sim_map = {r["member_id"]: r for r in sim_run["results"]}
    mmap = {m.id: m for m in all_members}

    # ---------------------------------------------- bandingkan per member
    sim_all_ids = set(prior_ids) | set(new_ids)
    level_of: Dict[str, int] = {p: int(prior_meta[p].get("level") or 1) for p in prior_ids}
    for a in assignments:
        level_of[a["member_id"]] = a.get("level", 1)
    rows: List[Dict[str, Any]] = []
    for mid, r in sim_map.items():
        b = base_map.get(mid)
        before = float(b["total_bonus_bv"]) if b else 0.0
        after = float(r["total_bonus_bv"])
        delta = round(after - before, 2)
        is_sim = mid in sim_all_ids
        is_new = mid in set(new_ids)
        if not is_sim and abs(delta) < 0.01 and not body.include_unchanged:
            continue
        rows.append({
            **r,
            "is_simulasi": is_sim,
            "is_batch_baru": is_new,
            "batch": (batch_no if is_new else prior_meta.get(mid, {}).get("batch")),
            "level": level_of.get(mid),
            "sponsor_id": mmap[mid].sponsor_id if mid in mmap else None,
            "placement_id": mmap[mid].placement_id if mid in mmap else None,
            "bonus_sebelum_bv": round(before, 2),
            "bonus_sesudah_bv": round(after, 2),
            "delta_bv": delta,
            "delta_rp": round(delta * PV_TO_RP, 2),
            "bonus_delta": {f: round(float(r.get(f, 0) or 0) - float((b or {}).get(f, 0) or 0), 2)
                            for f, _ in BONUS_FIELDS},
        })
    rows.sort(key=lambda x: (not x["is_batch_baru"], not x["is_simulasi"], -x["delta_bv"]))

    # ---------------------------------------------- pohon sponsor & placement
    involved = set(sim_all_ids)

    def climb(start: str, attr: str):
        cur = getattr(mmap.get(start), attr, None) if start in mmap else None
        guard = 0
        while cur and cur in mmap and guard < 500:
            involved.add(cur)
            cur = getattr(mmap[cur], attr, None)
            guard += 1

    for mid in list(sim_all_ids):
        climb(mid, "sponsor_id")
        climb(mid, "placement_id")

    nodes: List[Dict[str, Any]] = []
    for mid in sorted(involved):
        r = sim_map.get(mid)
        if not r:
            continue
        b = base_map.get(mid)
        before = float(b["total_bonus_bv"]) if b else 0.0
        m = mmap[mid]
        nodes.append({
            "member_id": mid, "name": r.get("name") or mid,
            "sponsor_id": m.sponsor_id, "placement_id": m.placement_id,
            "is_simulasi": mid in sim_all_ids,
            "is_batch_baru": mid in set(new_ids),
            "batch": (batch_no if mid in set(new_ids) else prior_meta.get(mid, {}).get("batch")),
            "level": level_of.get(mid),
            "membership": r.get("membership"), "rank": r.get("rank"),
            "ppv": r.get("ppv"), "ppv_perkembangan": r.get("ppv_perkembangan"),
            "ppv_penjualan": r.get("ppv_penjualan"),
            "tupo_ok": r.get("tupo_ok"),
            **{f: r.get(f, 0) for f, _ in BONUS_FIELDS},
            "total_bonus_bv": r.get("total_bonus_bv", 0),
            "total_bonus_rp": r.get("total_bonus_rp", 0),
            "bonus_sebelum_bv": round(before, 2),
            "delta_bv": round(float(r.get("total_bonus_bv", 0)) - before, 2),
        })

    # ---------------------------------------------- daftar akumulasi untuk batch berikutnya
    sim_members_out: List[Dict[str, Any]] = [prior_meta[p] for p in prior_ids]
    for a in assignments:
        sim_members_out.append({
            "member_id": a["member_id"], "name": a["name"],
            "sponsor_id": a["sponsor_id"], "placement_id": a["placement_id"],
            "pv_perkembangan": pv_perk, "pv_penjualan": pv_penj,
            "membership": body.membership or None, "rank": body.rank or None,
            "tupo_ok": bool(body.tupo_ok), "batch": batch_no, "level": a.get("level", 1),
        })

    omset_before = float(baseline["summary"]["total_omset_pv"])
    omset_after = float(sim_run["summary"]["total_omset_pv"])
    bonus_before = float(baseline["summary"]["total_bonus_bv"])
    bonus_after = float(sim_run["summary"]["total_bonus_bv"])
    fee_pct = float(st.get("stokis_fee_percent") or 0)
    omset_sim = round(total_new * (pv_perk + pv_penj), 2)

    def payout_pct(bonus, omset):
        return round(bonus / omset * 100, 2) if omset else 0.0

    sponsor_mode = ("akar baru dari member simulasi" if (mode == "single" and not sponsor)
                    else ("disebar biner" if body.spread_sponsor else "semua frontline sponsor"))
    if mode == "per_member":
        sponsor_mode = (f"{len(targets)} induk x {per} member"
                        + (" (sponsor disebar biner)" if body.spread_sponsor else ""))
    if levels > 1:
        sponsor_mode += f" · berantai {levels} level"

    # ---- verifikasi aturan biner pada hasil simulasi (maksimal 2 kaki placement)
    pelanggaran_biner = {p: len(c) for p, c in pl_kids.items() if len(c) > 2}

    return {
        "period_key": key, "label": core.period_label(key),
        "count": total_new,
        "per_induk": per,
        "levels": levels,
        "per_level": per_level,
        "level_counts": [len(x) for x in level_ids],
        "binary_ok": not pelanggaran_biner,
        "binary_violations": pelanggaran_biner,
        "mode": mode,
        "batch": batch_no,
        "targets": targets,
        "sponsor": ({"member_id": sponsor["member_id"], "name": sponsor.get("name", "")}
                    if sponsor else None),
        "placement": ({"member_id": placement["member_id"], "name": placement.get("name", "")}
                      if placement else None),
        "placement_mode": ("manual" if placement else "otomatis seimbang (biner)"),
        "sponsor_mode": sponsor_mode,
        "membership": body.membership or None, "rank": body.rank or None,
        "tupo_ok": bool(body.tupo_ok),
        "include_current_omset": bool(body.include_current_omset),
        "assignments": assignments,
        "existing_member_count": len(real_members),
        "prior_sim_count": len(prior_ids),
        "total_sim_count": len(sim_all_ids),
        "sim_members": sim_members_out,
        "nodes": nodes,
        "omset": {
            "sebelum_pv": round(omset_before, 2), "sesudah_pv": round(omset_after, 2),
            "tambahan_pv": omset_sim,
            "tambahan_perkembangan_pv": round(total_new * pv_perk, 2),
            "tambahan_penjualan_pv": round(total_new * pv_penj, 2),
            "tambahan_rp": round(omset_sim * PV_TO_RP, 2),
        },
        "bonus": {
            "sebelum_bv": round(bonus_before, 2), "sesudah_bv": round(bonus_after, 2),
            "delta_bv": round(bonus_after - bonus_before, 2),
            "delta_rp": round((bonus_after - bonus_before) * PV_TO_RP, 2),
            "per_type_sesudah": {label: round(sum(float(r.get(f, 0) or 0)
                                                  for r in sim_run["results"]), 2)
                                 for f, label in BONUS_FIELDS},
            "per_type_delta": {label: round(sum(float(r.get(f, 0) or 0) for r in sim_run["results"])
                                            - sum(float(r.get(f, 0) or 0) for r in baseline["results"]), 2)
                               for f, label in BONUS_FIELDS},
        },
        "payout": {
            "persen_sebelum": payout_pct(bonus_before, omset_before),
            "persen_sesudah": payout_pct(bonus_after, omset_after),
            "stokis_fee_percent": fee_pct,
            "perusahaan_bv": round(omset_after - bonus_after - omset_after * fee_pct / 100.0, 2),
        },
        "results": rows,
        "affected_existing": sum(1 for r in rows if not r["is_simulasi"]),
        "pv_to_rp": PV_TO_RP,
    }
