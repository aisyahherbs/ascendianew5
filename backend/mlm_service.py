"""Adapter between MongoDB data and the pure bonus engine."""
from typing import Any, Dict, List, Optional, Tuple

import core
from core import db, get_settings, ensure_period, now_iso, new_id, period_key_for_date
from engine import MemberIn, TxIn, run_period, RANK_ORDER, MEMBERSHIP_ORDER, build_config


async def all_users() -> List[Dict[str, Any]]:
    return await db.users.find({"deleted": {"$ne": True}}).to_list(100000)


async def txs_by_period() -> Dict[str, List[Dict[str, Any]]]:
    out: Dict[str, List[Dict[str, Any]]] = {}
    for t in await db.transactions.find({}).to_list(500000):
        out.setdefault(t["period_key"], []).append(t)
    return out


def _blank_state(users: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    return {
        u["member_id"]: dict(
            appv_perkembangan=float(u.get("initial_appv_perkembangan", 0) or 0),
            appv=float(u.get("initial_appv", 0) or 0),
            atnpv=0.0, rank="Member", membership="None", carry={},
        ) for u in users
    }


def _members_in(users: List[Dict[str, Any]], state: Dict[str, Dict[str, Any]],
                overrides: Optional[Dict[str, bool]] = None,
                global_bonus_off: Optional[List[str]] = None) -> List[MemberIn]:
    """Hanya peran `member` yang masuk struktur jaringan & perhitungan bonus.

    Admin Pusat, Admin Provinsi, dan Stokis adalah peran operasional/administratif:
    mereka tidak punya sponsor/placement dan tidak menerima bonus jaringan.
    Stokis hanya mendapat fee perantara dari omset member yang mendaftar padanya.
    """
    ov = overrides or {}
    goff = set(global_bonus_off or [])
    out = []
    for u in users:
        if (u.get("role") or "member") != "member":
            continue
        s = state.get(u["member_id"], {})
        out.append(MemberIn(
            id=u["member_id"], sponsor_id=u.get("sponsor_id") or None,
            placement_id=u.get("placement_id") or u.get("sponsor_id") or None,
            name=u.get("name", ""), active=bool(u.get("active", True)),
            appv_perkembangan=s.get("appv_perkembangan", 0.0), appv=s.get("appv", 0.0),
            atnpv=s.get("atnpv", 0.0), rank=s.get("rank", "Member"),
            membership=s.get("membership", "None"), carry=dict(s.get("carry", {})),
            tupo_override=ov.get(u["member_id"]),
            membership_force=u.get("override_membership") or None,
            rank_force=u.get("override_rank") or None,
            bonus_disabled=sorted(goff | set(u.get("bonus_disabled") or [])),
        ))
    return out


async def tupo_overrides() -> Dict[str, Dict[str, bool]]:
    """{period_key: {member_id: bool}} — tupo yang di-set manual oleh admin."""
    out: Dict[str, Dict[str, bool]] = {}
    for r in await db.tupo_overrides.find({}).to_list(200000):
        out.setdefault(r["period_key"], {})[r["member_id"]] = bool(r.get("ok", True))
    return out


def _apply(state: Dict[str, Dict[str, Any]], res: Dict[str, Any]):
    for r in res["results"]:
        st = state.setdefault(r["member_id"], {})
        st["appv_perkembangan"] = r["appv_perkembangan"]
        st["appv"] = r["appv"]
        st["atnpv"] = r["atnpv"]
        st["rank"] = r["rank"]
        st["membership"] = r["membership"]
        st["carry"] = r["carry"]


def _engine_txs(rows: List[Dict[str, Any]]) -> List[TxIn]:
    return [TxIn(member_id=t["member_id"], pv=float(t["pv"]), kind=t["kind"]) for t in rows]


def stokis_fees(users: List[Dict[str, Any]], rows: List[Dict[str, Any]], pct: float) -> List[Dict[str, Any]]:
    """Fee perantara stokis: % dari omset member yang mendaftar lewat stokis tsb."""
    if not pct:
        return []
    owner = {u["member_id"]: u.get("stokis_id") for u in users
             if (u.get("role") or "member") == "member"}
    names = {u["member_id"]: u.get("name", "") for u in users}
    prov = {u["member_id"]: (u.get("province") or "") for u in users}
    agg: Dict[str, float] = {}
    for t in rows:
        s = owner.get(t["member_id"])
        if s:
            agg[s] = agg.get(s, 0.0) + float(t["pv"])
    return [dict(stokis_id=k, name=names.get(k, ""), province=prov.get(k, ""),
                 omset_pv=round(v, 2),
                 fee_bv=round(v * pct / 100.0, 2)) for k, v in sorted(agg.items())]


async def recompute(persist: bool = True, include_open: Optional[str] = None) -> Dict[str, Any]:
    """Replay every CLOSED period in order to rebuild state + bonus runs.

    If include_open is a period key, that period is also computed (never persisted
    as a closed run) and returned as `open_run` -- used for live bonus estimates.
    """
    st = await get_settings()
    cfg = st.get("engine") or {}
    pct = float(st.get("stokis_fee_percent") or 0)
    goff = [k for k in (st.get("bonus_disabled_global") or []) if k in core.BONUS_KEYS]
    if persist and include_open is None:
        # supaya statistik yang di-cache pada dokumen user mencerminkan periode berjalan
        include_open = await core.current_period_key()
    users = await all_users()
    tx_map = await txs_by_period()
    ov_map = await tupo_overrides()
    periods = await db.periods.find({}).sort("key", 1).to_list(10000)
    closed = [p["key"] for p in periods if p.get("status") == "closed"]

    state = _blank_state(users)
    runs: List[Dict[str, Any]] = []
    for key in closed:
        rows = tx_map.get(key, [])
        res = run_period(_members_in(users, state, ov_map.get(key), goff),
                         _engine_txs(rows), key, cfg)
        res["stokis_fees"] = stokis_fees(users, rows, pct)
        res["label"] = core.period_label(key)
        _apply(state, res)
        runs.append(res)

    open_run = None
    if include_open:
        rows = tx_map.get(include_open, [])
        open_run = run_period(_members_in(users, state, ov_map.get(include_open), goff),
                              _engine_txs(rows), include_open, cfg)
        open_run["stokis_fees"] = stokis_fees(users, rows, pct)
        open_run["label"] = core.period_label(include_open)
        open_run["status"] = "open"

    if persist:
        await db.bonus_runs.delete_many({})
        for res in runs:
            await db.bonus_runs.insert_one({
                "id": new_id(), "period_key": res["period"], "label": res["label"],
                "run_at": now_iso(), "summary": res["summary"], "results": res["results"],
                "stokis_fees": res.get("stokis_fees", []),
            })
        # cache latest state on the user docs for fast listing
        final = open_run or (runs[-1] if runs else None)
        snapshot = {r["member_id"]: r for r in (final["results"] if final else [])}
        for u in users:
            s = state.get(u["member_id"], {})
            snap = snapshot.get(u["member_id"], {})
            await db.users.update_one({"member_id": u["member_id"]}, {"$set": {
                "stat_appv_perkembangan": snap.get("appv_perkembangan", s.get("appv_perkembangan", 0)),
                "stat_appv": snap.get("appv", s.get("appv", 0)),
                "stat_atnpv": snap.get("atnpv", s.get("atnpv", 0)),
                "stat_rank": snap.get("rank", s.get("rank", "Member")),
                "stat_membership": snap.get("membership", s.get("membership", "None")),
                "stat_tupo_ok": snap.get("tupo_ok", False),
                "stat_tupo_manual": snap.get("tupo_manual", False),
                "stat_ppv": snap.get("ppv", 0),
                "stat_kg": snap.get("kg", 0),
                "stat_akg": snap.get("akg", 0),
                "stat_tnpv": snap.get("tnpv", 0),
                "stat_carry": s.get("carry", {}),
                "stat_updated_at": now_iso(),
            }})

    return {"runs": runs, "open_run": open_run, "state": state}


async def live_snapshot() -> Dict[str, Any]:
    """Current open-period computation (no persistence of a closed run)."""
    key = await core.current_period_key()
    await ensure_period(key)
    p = await db.periods.find_one({"key": key})
    if p and p.get("status") == "closed":
        data = await recompute(persist=False)
        run = next((r for r in data["runs"] if r["period"] == key), None)
        return {"period_key": key, "run": run, "closed": True}
    data = await recompute(persist=False, include_open=key)
    return {"period_key": key, "run": data["open_run"], "closed": False}
