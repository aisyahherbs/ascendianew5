"""
Hybrid MLM Bonus Calculation Engine (pure python, no DB / no framework).

Units: PV and BV. 1 PV = 1 BV = Rp 1.000

Trees:
  - SPONSOR tree  -> Bonus Sponsor, Bonus Bimbingan, Bonus Prestasi, Bonus Kepemimpinan,
                     rank qualification (ATNPV / KU / KG)
  - PLACEMENT tree-> Bonus Pasangan legs (and 2-frontline-Gold rule for Platinum)
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any

PV_TO_RP = 1000

# ---------------------------------------------------------------- membership
MEMBERSHIPS: Dict[str, Dict[str, Any]] = {
    "None":     dict(threshold=0,     sponsor=0.00, pairing=0.00, cap=0,     bimbingan_gen=0),
    "Bronze":   dict(threshold=2500,  sponsor=0.10, pairing=0.08, cap=2500,  bimbingan_gen=1),
    "Silver":   dict(threshold=5000,  sponsor=0.12, pairing=0.10, cap=7500,  bimbingan_gen=2),
    "Gold":     dict(threshold=10000, sponsor=0.15, pairing=0.12, cap=15000, bimbingan_gen=3),
    "Platinum": dict(threshold=19000, sponsor=0.20, pairing=0.15, cap=35000, bimbingan_gen=4),
}
MEMBERSHIP_ORDER = ["None", "Bronze", "Silver", "Gold", "Platinum"]

# ---------------------------------------------------------------- ranks
RANK_ORDER = [
    "Member", "VIP", "Royal Star", "Crown Star",
    "Leader Ambassador", "Leader Majestic", "Director", "Executive Director",
]
PRESTASI_RATE = {
    "Member": 0.00, "VIP": 0.10, "Royal Star": 0.17, "Crown Star": 0.22,
    "Leader Ambassador": 0.26, "Leader Majestic": 0.30,
    "Director": 0.30, "Executive Director": 0.30,
}
TUPO_REQ = {
    "Member": 0, "VIP": 0, "Royal Star": 1000, "Crown Star": 2000,
    "Leader Ambassador": 3000, "Leader Majestic": 3000,
    "Director": 3000, "Executive Director": 3000,
}
LEADERSHIP_DEPTH = {
    "Crown Star": 3, "Leader Ambassador": 6, "Leader Majestic": 10,
    "Director": 10, "Executive Director": 10,
}
GEN_RATES = [0.03, 0.02, 0.02, 0.01, 0.01, 0.01, 0.005, 0.005, 0.005, 0.005]

RANK_RULES = {
    "VIP":               dict(appv=6000),
    "Royal Star":        dict(appv=15000, alt_appv=6000, alt_atnpv=75000),
    "Crown Star":        dict(atnpv=225000, kg=45000),
    "Leader Ambassador": dict(atnpv=675000, kg=135000),
    "Leader Majestic":   dict(atnpv=6750000, kg=1350000),
    "Director":          dict(legs_rank="Leader Majestic", legs=3),
    "Executive Director":dict(legs_rank="Director", legs=3),
}

PAIRING_CAP_MAJESTIC = 50000  # BV per period for Leader Majestic and above
BIMBINGAN_RATE = 0.03
SHARING_PROFIT = {"Director": 0.02, "Executive Director": 0.01}
REWARD_POOL_RATE = 0.02
REWARD_QUALIFY_RANK = "Leader Majestic"


def rank_index(r: str) -> int:
    return RANK_ORDER.index(r) if r in RANK_ORDER else 0


def membership_index(m: str) -> int:
    return MEMBERSHIP_ORDER.index(m) if m in MEMBERSHIP_ORDER else 0


# ---------------------------------------------------------------- data types
@dataclass
class MemberIn:
    id: str
    sponsor_id: Optional[str] = None
    placement_id: Optional[str] = None
    name: str = ""
    active: bool = True
    # accumulators BEFORE this period
    appv_perkembangan: float = 0.0   # accumulated personal perkembangan PV
    appv: float = 0.0                # accumulated personal PV (perk + penj)
    atnpv: float = 0.0               # accumulated total (personal+group) PV
    rank: str = "Member"             # highest rank achieved so far
    membership: str = "None"
    carry: Dict[str, float] = field(default_factory=dict)  # leg_id -> stored perkembangan PV
    # Admin dapat menandai Tupo terpenuhi secara manual (tanpa menambah omset).
    # None = otomatis dari omset penjualan pribadi, True/False = paksa.
    tupo_override: Optional[bool] = None
    # Admin Pusat dapat menetapkan membership / peringkat secara manual
    # (tanpa menambah PV). None = dihitung otomatis oleh mesin bonus.
    membership_force: Optional[str] = None
    rank_force: Optional[str] = None
    # Jenis bonus yang dinonaktifkan untuk member ini (tidak dihitung sama sekali).
    # Nilai: sponsor | pasangan | bimbingan | prestasi | kepemimpinan | sharing_profit | reward
    bonus_disabled: List[str] = field(default_factory=list)


@dataclass
class TxIn:
    member_id: str
    pv: float
    kind: str  # 'perkembangan' | 'penjualan'


def _children(members: List[MemberIn], attr: str) -> Dict[str, List[str]]:
    out: Dict[str, List[str]] = {m.id: [] for m in members}
    for m in members:
        p = getattr(m, attr)
        if p and p in out:
            out[p].append(m.id)
    return out


def _subtree(root: str, kids: Dict[str, List[str]]) -> List[str]:
    res, stack = [], [root]
    while stack:
        n = stack.pop()
        res.append(n)
        stack.extend(kids.get(n, []))
    return res




def build_config(s: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Merge editable settings on top of the default plan configuration."""
    import copy
    c: Dict[str, Any] = dict(
        memberships=copy.deepcopy(MEMBERSHIPS),
        prestasi_rate=dict(PRESTASI_RATE),
        tupo=dict(TUPO_REQ),
        leadership_depth=dict(LEADERSHIP_DEPTH),
        gen_rates=list(GEN_RATES),
        rank_rules=copy.deepcopy(RANK_RULES),
        pairing_cap_majestic=PAIRING_CAP_MAJESTIC,
        bimbingan_rate=BIMBINGAN_RATE,
        sharing_profit=dict(SHARING_PROFIT),
        reward_pool_rate=REWARD_POOL_RATE,
        reward_qualify_rank=REWARD_QUALIFY_RANK,
    )
    for k, v in (s or {}).items():
        if k not in c:
            continue
        if isinstance(c[k], dict) and isinstance(v, dict):
            for k2, v2 in v.items():
                if isinstance(c[k].get(k2), dict) and isinstance(v2, dict):
                    c[k][k2].update(v2)
                else:
                    c[k][k2] = v2
        else:
            c[k] = v
    return c

def run_period(members: List[MemberIn], txs: List[TxIn],
              period_label: str = "P1",
              settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Compute a full period close. Returns results + updated member state."""
    cfg = build_config(settings)
    MB = cfg["memberships"]; PR = cfg["prestasi_rate"]; TP = cfg["tupo"]
    LD = cfg["leadership_depth"]; GR = cfg["gen_rates"]; RR_ = cfg["rank_rules"]
    idx = {m.id: m for m in members}
    sp_kids = _children(members, "sponsor_id")
    pl_kids = _children(members, "placement_id")

    # ---------------- period personal volumes
    p_perk = {m.id: 0.0 for m in members}
    p_penj = {m.id: 0.0 for m in members}
    for t in txs:
        if t.member_id not in idx:
            continue
        if t.kind == "perkembangan":
            p_perk[t.member_id] += t.pv
        else:
            p_penj[t.member_id] += t.pv
    ppv = {i: p_perk[i] + p_penj[i] for i in p_perk}

    # ---------------- accumulators after this period
    appv_perk = {m.id: m.appv_perkembangan + p_perk[m.id] for m in members}
    appv = {m.id: m.appv + ppv[m.id] for m in members}

    # group volumes on SPONSOR tree (personal + group)
    def subtree_sum(root, kids, values):
        return sum(values.get(n, 0.0) for n in _subtree(root, kids))

    tnpv = {m.id: subtree_sum(m.id, sp_kids, ppv) for m in members}
    tnpv_penj = {m.id: subtree_sum(m.id, sp_kids, p_penj) for m in members}
    # ATNPV = accumulated network total = sum of accumulated personal PV in sponsor subtree
    # (stored value kept as a floor so seeded/legacy data is honoured)
    atnpv = {m.id: max(subtree_sum(m.id, sp_kids, appv), m.atnpv) for m in members}

    # ---------------- membership update
    membership = {}
    for m in members:
        cur = "None"
        for name in reversed(MEMBERSHIP_ORDER[1:]):
            if appv_perk[m.id] >= MB[name]["threshold"]:
                cur = name
                break
        if membership_index(m.membership) > membership_index(cur):
            cur = m.membership
        membership[m.id] = cur
    # Platinum via: Gold + 2 frontline Gold (sponsor OR placement frontline)
    for m in members:
        if membership[m.id] == "Gold":
            fl = set(sp_kids.get(m.id, [])) | set(pl_kids.get(m.id, []))
            golds = sum(1 for c in fl if membership_index(membership.get(c, "None")) >= membership_index("Gold"))
            if golds >= 2:
                membership[m.id] = "Platinum"
    # override manual oleh Admin Pusat (menang atas perhitungan otomatis)
    for m in members:
        if m.membership_force and m.membership_force in MEMBERSHIP_ORDER:
            membership[m.id] = m.membership_force

    # ---------------- rank update (accumulative, never demoted)
    forced_rank = {m.id: (m.rank_force if m.rank_force in RANK_ORDER else None) for m in members}
    rank = {m.id: (forced_rank[m.id] or m.rank) for m in members}

    def leg_atnpv_values(mid):
        # accumulated total network PV per sponsor frontline leg
        out = []
        for c in sp_kids.get(mid, []):
            val = 0.0
            for n in _subtree(c, sp_kids):
                val += idx[n].appv + ppv[n]
            out.append((c, val))
        return sorted(out, key=lambda kv: kv[1], reverse=True)

    # iterate a few passes so Director / Exec Director (leg based) settle bottom-up
    for _ in range(len(RANK_ORDER)):
        changed = False
        for m in members:
            mid = m.id
            if forced_rank[mid]:
                continue
            new = rank[mid]
            legs = leg_atnpv_values(mid)
            ku = legs[0][1] if legs else 0.0
            kg = sum(v for _, v in legs[1:])
            a_appv, a_atnpv = appv[mid], atnpv[mid]
            cand = "Member"
            if a_appv >= RR_["VIP"]["appv"]:
                cand = "VIP"
            r = RR_["Royal Star"]
            if a_appv >= r["appv"] or (a_appv >= r["alt_appv"] and a_atnpv >= r["alt_atnpv"]):
                cand = "Royal Star"
            for nm in ("Crown Star", "Leader Ambassador", "Leader Majestic"):
                rr = RR_[nm]
                if a_atnpv >= rr["atnpv"] and kg >= rr["kg"]:
                    cand = nm
            for nm in ("Director", "Executive Director"):
                rr = RR_[nm]
                need = rank_index(rr["legs_rank"])
                cnt = 0
                for c in sp_kids.get(mid, []):
                    if any(rank_index(rank.get(n, "Member")) >= need for n in _subtree(c, sp_kids)):
                        cnt += 1
                if cnt >= rr["legs"]:
                    cand = nm
            if rank_index(cand) > rank_index(new):
                new = cand
            if new != rank[mid]:
                rank[mid] = new
                changed = True
        if not changed:
            break

    # ---------------- KU / KG (jalur terbesar vs sisa jalur) pada pohon sponsor
    def leg_values(mid, values):
        out = []
        for c in sp_kids.get(mid, []):
            out.append(sum(values.get(n, 0.0) for n in _subtree(c, sp_kids)))
        return sorted(out, reverse=True)

    accum_pv = {m.id: idx[m.id].appv + ppv[m.id] for m in members}
    ku, kg, aku, akg = {}, {}, {}, {}
    for m in members:
        cur = leg_values(m.id, ppv)
        acc = leg_values(m.id, accum_pv)
        ku[m.id] = round(cur[0], 2) if cur else 0.0
        kg[m.id] = round(sum(cur[1:]), 2)
        aku[m.id] = round(acc[0], 2) if acc else 0.0
        akg[m.id] = round(sum(acc[1:]), 2)

    # ---------------- tupo (from omset PENJUALAN personal only)
    tupo_req = {m.id: TP[rank[m.id]] for m in members}
    tupo_auto = {m.id: (p_penj[m.id] >= tupo_req[m.id]) for m in members}
    tupo_manual = {m.id: (m.tupo_override is not None) for m in members}
    tupo_ok = {m.id: (bool(m.tupo_override) if m.tupo_override is not None else tupo_auto[m.id])
               for m in members}
    qualified = {m.id: (m.active and tupo_ok[m.id]) for m in members}

    lines: Dict[str, List[Dict[str, Any]]] = {m.id: [] for m in members}
    b_sponsor = {m.id: 0.0 for m in members}
    b_pasangan = {m.id: 0.0 for m in members}
    b_bimbingan = {m.id: 0.0 for m in members}
    b_prestasi = {m.id: 0.0 for m in members}
    b_kepemimpinan = {m.id: 0.0 for m in members}
    b_sharing = {m.id: 0.0 for m in members}

    # Penonaktifan jenis bonus per member: bonus TIDAK dihitung sama sekali.
    def off(mid: str, key: str) -> bool:
        m = idx.get(mid)
        return bool(m and m.bonus_disabled and key in m.bonus_disabled)

    def add_line(mid, bonus, desc, base, rate, amount):
        if amount <= 0:
            return
        lines[mid].append(dict(bonus=bonus, description=desc, base_pv=round(base, 2),
                               rate=rate, amount_bv=round(amount, 2)))

    # ============================================================ 1. SPONSOR
    # sponsor tree, direct frontline only, no pass-up, no tupo needed
    for m in members:
        if p_perk[m.id] <= 0:
            continue
        s = m.sponsor_id
        if not s or s not in idx or not idx[s].active:
            continue
        if off(s, "sponsor"):
            continue
        rate = MB[membership[s]]["sponsor"]
        amt = p_perk[m.id] * rate
        b_sponsor[s] += amt
        add_line(s, "Bonus Sponsor",
                 f"Omset perkembangan {m.id} ({m.name or m.id})", p_perk[m.id], rate, amt)

    # ============================================================ 2. PASANGAN
    carry_out: Dict[str, Dict[str, float]] = {}
    pairing_detail: Dict[str, Dict[str, Any]] = {}
    for m in members:
        legs_val: Dict[str, float] = {}
        for c in pl_kids.get(m.id, []):
            legs_val[c] = m.carry.get(c, 0.0) + subtree_sum(c, pl_kids, p_perk)
        # keep carry of legs that no longer exist
        for k, v in m.carry.items():
            legs_val.setdefault(k, v)
        bonus = 0.0
        paired = 0.0
        capped = False
        cap = MB[membership[m.id]]["cap"]
        if rank_index(rank[m.id]) >= rank_index("Leader Majestic"):
            cap = max(cap, cfg['pairing_cap_majestic'])
        ordered = sorted(legs_val.items(), key=lambda kv: kv[1], reverse=True)
        if len(ordered) >= 2 and qualified[m.id] and membership[m.id] != "None" \
                and not off(m.id, "pasangan"):
            l1, l2 = ordered[0], ordered[1]
            paired = min(l1[1], l2[1])
            if paired > 0:
                rate = MB[membership[m.id]]["pairing"]
                bonus = paired * rate
                if bonus > cap:
                    bonus = cap
                    capped = True
                legs_val[l1[0]] = l1[1] - paired
                legs_val[l2[0]] = l2[1] - paired
                add_line(m.id, "Bonus Pasangan",
                         f"Pasangan jalur {l1[0]} ({l1[1]:.0f} PV) & {l2[0]} ({l2[1]:.0f} PV)"
                         + (" [kena batas maksimal]" if capped else ""),
                         paired, rate, bonus)
        b_pasangan[m.id] = bonus
        if bonus <= 0:
            # no pairing bonus this period -> stored remainder resets to 0
            carry_out[m.id] = {k: 0.0 for k in legs_val}
        else:
            carry_out[m.id] = {k: max(0.0, v) for k, v in legs_val.items()}
        pairing_detail[m.id] = dict(
            legs=[dict(leg=k, pv=round(v, 2)) for k, v in ordered],
            paired_pv=round(paired, 2), cap_bv=cap, capped=capped,
            carry={k: round(v, 2) for k, v in carry_out[m.id].items()})

    # ============================================================ 3. BIMBINGAN
    # sponsor tree, 3% of downline pairing bonus, generations compressed on
    # downlines that have pairing bonus. Requires own pairing bonus.
    for m in members:
        if b_pasangan[m.id] <= 0 or not qualified[m.id] or off(m.id, "bimbingan"):
            continue
        depth = MB[membership[m.id]]["bimbingan_gen"]
        if depth <= 0:
            continue
        # BFS collecting compressed generations
        frontier = list(sp_kids.get(m.id, []))
        gen = 1
        while frontier and gen <= depth:
            nxt: List[str] = []
            for node in frontier:
                if b_pasangan.get(node, 0.0) > 0:
                    amt = b_pasangan[node] * cfg['bimbingan_rate']
                    b_bimbingan[m.id] += amt
                    add_line(m.id, "Bonus Bimbingan",
                             f"Generasi {gen} - {node} (bonus pasangan {b_pasangan[node]:.0f} BV)",
                             b_pasangan[node], cfg['bimbingan_rate'], amt)
                    nxt.extend(sp_kids.get(node, []))
                else:
                    # compressed: this member's downlines take this generation slot
                    frontier.extend(sp_kids.get(node, []))
            frontier = nxt
            gen += 1

    # ============================================================ 4. PRESTASI
    # stair-step rank differential on personal omset PENJUALAN, sponsor tree
    for m in members:
        own_rate = PR[rank[m.id]] if qualified[m.id] else 0.0
        if own_rate > 0 and p_penj[m.id] > 0 and not off(m.id, "prestasi"):
            amt = p_penj[m.id] * own_rate
            b_prestasi[m.id] += amt
            add_line(m.id, "Bonus Prestasi", "Belanja pribadi omset penjualan",
                     p_penj[m.id], own_rate, amt)
        if p_penj[m.id] <= 0:
            continue
        current = own_rate
        node = idx[m.id].sponsor_id
        guard = 0
        while node and node in idx and guard < 200:
            guard += 1
            up = idx[node]
            r = PR[rank[node]] if qualified[node] else 0.0
            if r > current:
                diff = r - current
                # Selisih tetap "terpakai" walau bonus dinonaktifkan, supaya upline
                # lain tidak mendapat porsi tambahan yang bukan haknya.
                if not off(node, "prestasi"):
                    amt = p_penj[m.id] * diff
                    b_prestasi[node] += amt
                    add_line(node, "Bonus Prestasi",
                             f"Selisih peringkat atas omset penjualan {m.id} "
                             f"({rank[node]} {r*100:.0f}% - {current*100:.0f}%)",
                             p_penj[m.id], round(diff, 4), amt)
                current = r
            node = up.sponsor_id
            if current >= 0.30:
                break

    # ============================================================ 5. KEPEMIMPINAN
    def is_leader(mid):
        return rank_index(rank[mid]) >= rank_index("Crown Star") and qualified[mid]

    def segment_penj(root):
        """omset penjualan of root's group, excluding groups of deeper leaders"""
        total, stack = p_penj.get(root, 0.0), list(sp_kids.get(root, []))
        while stack:
            n = stack.pop()
            if is_leader(n):
                continue
            total += p_penj.get(n, 0.0)
            stack.extend(sp_kids.get(n, []))
        return total

    for m in members:
        if not is_leader(m.id) or off(m.id, "kepemimpinan"):
            continue
        depth = LD.get(rank[m.id], 0)
        frontier = list(sp_kids.get(m.id, []))
        gen = 1
        while frontier and gen <= depth:
            nxt: List[str] = []
            for node in frontier:
                if is_leader(node):
                    base = segment_penj(node)
                    rate = GR[gen - 1]
                    amt = base * rate
                    if amt > 0:
                        b_kepemimpinan[m.id] += amt
                        add_line(m.id, "Bonus Kepemimpinan",
                                 f"Generasi {gen} - {node} ({rank[node]})", base, rate, amt)
                    nxt.extend(sp_kids.get(node, []))
                else:
                    frontier.extend(sp_kids.get(node, []))
            frontier = nxt
            gen += 1

    # ============================================================ 6. SHARING PROFIT
    total_omset = sum(ppv.values())
    total_perk = sum(p_perk.values())
    total_penj = sum(p_penj.values())
    sharing_pools = {}
    for rname, rate in cfg['sharing_profit'].items():
        pool = total_omset * rate
        elig = [m.id for m in members if rank[m.id] == rname and qualified[m.id]]
        sharing_pools[rname] = dict(pool_bv=round(pool, 2), qualifiers=elig)
        if elig:
            share = pool / len(elig)
            for mid in elig:
                # Kualifikasi tetap dihitung (pembagi pool tidak berubah) supaya
                # bonus member lain tidak ikut berubah, tetapi yang dinonaktifkan
                # tidak menerima apa pun.
                if off(mid, "sharing_profit"):
                    continue
                b_sharing[mid] += share
                add_line(mid, "Bonus Sharing Profit",
                         f"{rate*100:.0f}% omset nasional dibagi {len(elig)} {rname}",
                         total_omset, rate, share)

    # ============================================================ 7. SPECIAL REWARD
    # Pool tetap dihitung otomatis supaya Admin Pusat tahu dana yang tersedia dan
    # tidak melebihi payout. TETAPI nilainya TIDAK dibagikan otomatis sebagai bonus:
    # tidak masuk total bonus member, tidak masuk slip bonus, dan tidak ada baris
    # rumus di rincian member. Pembagiannya sepenuhnya kuasa pusat (bisa BV / non-BV).
    reward_pool = total_omset * cfg['reward_pool_rate']
    r_elig = [m.id for m in members
              if rank_index(rank[m.id]) >= rank_index(cfg['reward_qualify_rank']) and qualified[m.id]]
    r_terima = [mid for mid in r_elig if not off(mid, "reward")]
    share_ref = round(reward_pool / len(r_terima), 2) if r_terima else 0.0
    nama = {m.id: m.name for m in members}
    reward_allocation = [{"member_id": mid, "name": nama.get(mid, mid), "rank": rank[mid],
                          "alokasi_rata_bv": share_ref} for mid in r_terima]

    # ---------------- assemble
    results = []
    for m in members:
        mid = m.id
        total = (b_sponsor[mid] + b_pasangan[mid] + b_bimbingan[mid] + b_prestasi[mid]
                 + b_kepemimpinan[mid] + b_sharing[mid])
        results.append(dict(
            member_id=mid, name=m.name, period=period_label,
            membership=membership[mid], rank=rank[mid],
            ppv=round(ppv[mid], 2), ppv_perkembangan=round(p_perk[mid], 2),
            ppv_penjualan=round(p_penj[mid], 2),
            appv=round(appv[mid], 2), appv_perkembangan=round(appv_perk[mid], 2),
            tnpv=round(tnpv[mid], 2), atnpv=round(atnpv[mid], 2),
            ku=ku[mid], kg=kg[mid], aku=aku[mid], akg=akg[mid],
            tupo_required=tupo_req[mid], tupo_ok=tupo_ok[mid],
            tupo_auto=tupo_auto[mid], tupo_manual=tupo_manual[mid],
            bonus_sponsor=round(b_sponsor[mid], 2),
            bonus_pasangan=round(b_pasangan[mid], 2),
            bonus_bimbingan=round(b_bimbingan[mid], 2),
            bonus_prestasi=round(b_prestasi[mid], 2),
            bonus_kepemimpinan=round(b_kepemimpinan[mid], 2),
            bonus_sharing_profit=round(b_sharing[mid], 2),
            total_bonus_bv=round(total, 2),
            total_bonus_rp=round(total * PV_TO_RP, 2),
            carry=carry_out.get(mid, {}),
            pairing_detail=pairing_detail.get(mid, {}),
            lines=lines[mid],
        ))

    return dict(
        period=period_label,
        summary=dict(total_omset_pv=round(total_omset, 2),
                     total_omset_perkembangan=round(total_perk, 2),
                     total_omset_penjualan=round(total_penj, 2),
                     total_bonus_bv=round(sum(r["total_bonus_bv"] for r in results), 2),
                     sharing_profit_pools=sharing_pools,
                     reward_pool_bv=round(reward_pool, 2),
                     reward_rate=cfg['reward_pool_rate'],
                     reward_qualify_rank=cfg['reward_qualify_rank'],
                     reward_qualifiers=r_terima,
                     reward_allocation=reward_allocation),
        results=results,
    )
