"""POC: aturan placement BINER (maks 2 kaki, auto-balance turun) + simulasi bertingkat.

Jalankan: python3 /app/test_core_placement.py
"""
import requests, json, sys

BASE = "http://localhost:8001/api"
S = requests.Session()
OK = "\033[92mOK\033[0m"
FAIL = "\033[91mGAGAL\033[0m"
fails = []


def login():
    r = S.post(f"{BASE}/auth/login", json={"member_id": "ADMIN", "password": "admin123"})
    r.raise_for_status()
    tok = r.json()["token"]
    S.headers["Authorization"] = f"Bearer {tok}"
    print(f"{OK} login admin")


def create(name, sponsor=None, placement=None, expect_ok=True):
    body = {"name": name, "role": "member", "province": "Jawa Barat", "city": "Kota Bandung",
            "phone": "0800", "initial_pv": 0}
    if sponsor:
        body["sponsor_id"] = sponsor
    if placement:
        body["placement_id"] = placement
    r = S.post(f"{BASE}/members", json=body)
    if r.status_code >= 400:
        if expect_ok:
            fails.append(f"create {name}: {r.status_code} {r.text[:200]}")
            print(f"{FAIL} create {name} -> {r.status_code} {r.text[:160]}")
        return None
    return r.json().get("member") or r.json()


def all_members():
    r = S.get(f"{BASE}/members", params={"limit": 1000})
    r.raise_for_status()
    d = r.json()
    return d["items"] if isinstance(d, dict) else d


def kids_map(rows):
    k = {r["member_id"]: [] for r in rows}
    for r in rows:
        p = r.get("placement_id")
        if p and p in k:
            k[p].append(r["member_id"])
    return k


def check_binary(rows, tag):
    k = kids_map(rows)
    bad = {m: v for m, v in k.items() if len(v) > 2}
    if bad:
        fails.append(f"{tag}: placement >2 kaki -> {bad}")
        print(f"{FAIL} {tag}: ada placement lebih dari 2 kaki -> {bad}")
    else:
        print(f"{OK} {tag}: semua node placement <= 2 kaki")
    return k


def test_real_placement():
    print("\n=== 1. PENDAFTARAN MEMBER NYATA (aturan biner) ===")
    root = create("Root A")
    if not root:
        print("root gagal dibuat, stop")
        return None
    rid = root["member_id"]
    print(f"  root = {rid}")
    ids = [rid]
    # 6 member berikutnya semuanya SPONSOR = root, placement dikosongkan
    for i in range(2, 8):
        m = create(f"Member {i}", sponsor=rid)
        if m:
            ids.append(m["member_id"])
    rows = [r for r in all_members() if r["role"] == "member"]
    k = check_binary(rows, "member nyata")
    byid = {r["member_id"]: r for r in rows}
    # semua sponsor harus root (sponsor tak dibatasi)
    spon_root = [r["member_id"] for r in rows if r.get("sponsor_id") == rid]
    print(f"  sponsor frontline root = {len(spon_root)} (harus 6)")
    if len(spon_root) != 6:
        fails.append(f"sponsor root {len(spon_root)} != 6")
        print(f"{FAIL} sponsor tidak boleh dibatasi")
    else:
        print(f"{OK} sponsor tidak dibatasi (6 frontline)")
    # placement: root 2 kaki, sisanya turun ke bawah & seimbang
    print(f"  kaki placement root = {k.get(rid)}")
    if len(k.get(rid, [])) != 2:
        fails.append(f"root placement kaki {k.get(rid)} != 2")
        print(f"{FAIL} root harus tepat 2 kaki placement")
    else:
        print(f"{OK} root tepat 2 kaki placement")
    # level 2 (anak dari kaki root) harus terisi merata: 2 + 2
    lv1 = sorted(k.get(rid, []))
    counts = [len(k.get(c, [])) for c in lv1]
    print(f"  kaki level-1 {lv1} -> jumlah anak {counts}")
    if sorted(counts) != [2, 2]:
        fails.append(f"level-1 tidak seimbang: {counts} (harus [2,2])")
        print(f"{FAIL} level-1 harus seimbang 2 & 2")
    else:
        print(f"{OK} level-1 seimbang (2 & 2)")

    # placement manual yang sudah penuh -> harus otomatis turun (tidak boleh error)
    m = create("Member Manual Penuh", sponsor=rid, placement=rid)
    if m is None:
        print(f"{FAIL} placement manual penuh masih ditolak (harus auto turun)")
        fails.append("placement manual penuh ditolak, seharusnya auto turun ke bawah")
    else:
        rows2 = [r for r in all_members() if r["role"] == "member"]
        k2 = kids_map(rows2)
        nw = [r for r in rows2 if r["member_id"] == m["member_id"]][0]
        print(f"  member baru {nw['member_id']} placement -> {nw.get('placement_id')}")
        if nw.get("placement_id") == rid:
            fails.append("placement tetap di root walau penuh")
            print(f"{FAIL} tidak boleh menempel di root yang penuh")
        else:
            print(f"{OK} otomatis turun ke {nw.get('placement_id')}")
        check_binary(rows2, "setelah placement manual penuh")
    return rid


def test_sim_nested(root):
    print("\n=== 2. SIMULASI BERTINGKAT (4 -> 4 per member) ===")
    # batch 1: 4 member di bawah root (mode single)
    body = {"mode": "single", "count": 4, "sponsor_id": root, "batch": 1,
            "pv_perkembangan": 100, "pv_penjualan": 0, "existing_sim": []}
    r = S.post(f"{BASE}/simulator/add-members", json=body)
    if r.status_code >= 400:
        fails.append(f"sim batch1: {r.status_code} {r.text[:300]}")
        print(f"{FAIL} sim batch1 {r.status_code} {r.text[:300]}")
        return
    d = r.json()
    sim = d["sim_members"]
    print(f"{OK} batch1: {d['count']} member simulasi, total {len(sim)}")
    for a in d["assignments"]:
        print(f"   {a['member_id']} sponsor={a['sponsor_id']} placement={a['placement_id']}")

    # batch 2: 4 member untuk MASING-MASING member batch 1 (mode per_member)
    targets = [a["member_id"] for a in d["assignments"]]
    body2 = {"mode": "per_member", "count": 4, "targets": targets, "batch": 2,
             "pv_perkembangan": 100, "pv_penjualan": 0, "existing_sim": sim}
    r2 = S.post(f"{BASE}/simulator/add-members", json=body2)
    if r2.status_code >= 400:
        fails.append(f"sim batch2: {r2.status_code} {r2.text[:300]}")
        print(f"{FAIL} sim batch2 {r2.status_code} {r2.text[:300]}")
        return
    d2 = r2.json()
    print(f"{OK} batch2: {d2['count']} member baru ({len(targets)} induk x 4)")
    sim2 = d2["sim_members"]

    # batch 3: 4 lagi untuk setiap member batch 2
    targets3 = [a["member_id"] for a in d2["assignments"]]
    body3 = {"mode": "per_member", "count": 4, "targets": targets3, "batch": 3,
             "pv_perkembangan": 100, "pv_penjualan": 0, "existing_sim": sim2}
    r3 = S.post(f"{BASE}/simulator/add-members", json=body3)
    if r3.status_code >= 400:
        fails.append(f"sim batch3: {r3.status_code} {r3.text[:300]}")
        print(f"{FAIL} sim batch3 {r3.status_code} {r3.text[:300]}")
        return
    d3 = r3.json()
    print(f"{OK} batch3: {d3['count']} member baru ({len(targets3)} induk x 4)")

    # validasi biner pada seluruh member simulasi + nyata
    allsim = d3["sim_members"]
    k = {}
    for s in allsim:
        k.setdefault(s["member_id"], [])
    real = [r["member_id"] for r in all_members() if r["role"] == "member"]
    for rid in real:
        k.setdefault(rid, [])
    for s in allsim:
        p = s.get("placement_id")
        if p:
            k.setdefault(p, []).append(s["member_id"])
    # tambahkan kaki placement nyata
    for r_ in [x for x in all_members() if x["role"] == "member"]:
        p = r_.get("placement_id")
        if p:
            k.setdefault(p, []).append(r_["member_id"])
    bad = {m: v for m, v in k.items() if len(v) > 2}
    if bad:
        fails.append(f"simulasi: placement >2 kaki -> {bad}")
        print(f"{FAIL} simulasi ada node >2 kaki placement: {bad}")
    else:
        print(f"{OK} simulasi: semua node placement <= 2 kaki ({len(allsim)} member simulasi)")

    # sponsor bebas: setiap induk harus punya 4 sponsor frontline
    sp = {}
    for s in allsim:
        if s.get("sponsor_id"):
            sp.setdefault(s["sponsor_id"], []).append(s["member_id"])
    per_t = {t: len(sp.get(t, [])) for t in targets}
    print(f"  sponsor frontline induk batch2 = {per_t}")
    if any(v != 4 for v in per_t.values()):
        fails.append(f"sponsor per induk tidak 4: {per_t}")
        print(f"{FAIL} setiap induk harus punya 4 sponsor langsung")
    else:
        print(f"{OK} setiap induk punya 4 sponsor langsung (sponsor tak dibatasi)")

    # bonus per member tersedia
    rows = d3.get("results") or []
    print(f"  baris hasil bonus = {len(rows)}, total member simulasi = {d3['total_sim_count']}")
    if not rows:
        fails.append("simulasi tidak mengembalikan baris bonus")


def test_sim_cascade(root):
    """Satu klik: 4 member, lalu 4 lagi per member, dan seterusnya (levels)."""
    print("\n=== 3. SIMULASI BERANTAI SEKALI KLIK (levels=3, 4 per member) ===")
    body = {"mode": "single", "count": 4, "levels": 3, "sponsor_id": root, "batch": 1,
            "pv_perkembangan": 5000, "pv_penjualan": 1000, "membership": "Bronze",
            "tupo_ok": True, "existing_sim": []}
    r = S.post(f"{BASE}/simulator/add-members", json=body)
    if r.status_code >= 400:
        fails.append(f"cascade: {r.status_code} {r.text[:300]}")
        print(f"{FAIL} cascade {r.status_code} {r.text[:300]}")
        return
    d = r.json()
    print(f"  total member baru = {d['count']} (per_level {d['per_level']}, "
          f"level_counts {d['level_counts']})")
    if d["count"] != 4 + 16 + 64:
        fails.append(f"cascade total {d['count']} != 84")
        print(f"{FAIL} total harus 84 (4+16+64)")
    else:
        print(f"{OK} total 84 member (4 + 16 + 64)")
    if not d.get("binary_ok"):
        fails.append(f"cascade melanggar biner: {d.get('binary_violations')}")
        print(f"{FAIL} ada node >2 kaki: {d.get('binary_violations')}")
    else:
        print(f"{OK} seluruh placement maksimal 2 kaki (binary_ok)")
    # setiap induk punya tepat `per` sponsor langsung
    sp = {}
    for a in d["assignments"]:
        if a["induk"]:
            sp.setdefault(a["induk"], []).append(a["member_id"])
    bad = {k: len(v) for k, v in sp.items() if len(v) != 4}
    if bad:
        fails.append(f"cascade sponsor per induk salah: {bad}")
        print(f"{FAIL} induk dengan sponsor langsung != 4: {bad}")
    else:
        print(f"{OK} setiap induk punya 4 downline sponsor ({len(sp)} induk)")
    lv = {}
    for a in d["assignments"]:
        lv[a["level"]] = lv.get(a["level"], 0) + 1
    print(f"  distribusi level = {lv}")
    if lv != {1: 4, 2: 16, 3: 64}:
        fails.append(f"distribusi level salah: {lv}")
        print(f"{FAIL} distribusi level harus 4/16/64")
    else:
        print(f"{OK} distribusi level benar (4 / 16 / 64)")
    rows = d.get("results") or []
    berbonus = [x for x in rows if float(x.get("total_bonus_bv") or 0) > 0]
    print(f"  baris hasil = {len(rows)}, punya bonus = {len(berbonus)}, "
          f"kenaikan bonus = {d['bonus']['delta_bv']} BV")
    if d["bonus"]["delta_bv"] <= 0:
        fails.append("cascade tidak menghasilkan kenaikan bonus")
        print(f"{FAIL} bonus tidak naik padahal ada 84 member ber-omset")
    else:
        print(f"{OK} bonus jaringan naik {d['bonus']['delta_bv']} BV")
    # cek batas
    r2 = S.post(f"{BASE}/simulator/add-members", json={**body, "levels": 6})
    if r2.status_code == 400 and "melebihi batas" in r2.text:
        print(f"{OK} batas 500 member dijaga (levels=6 ditolak dengan penjelasan)")
    else:
        fails.append(f"batas 500 tidak dijaga: {r2.status_code}")
        print(f"{FAIL} levels=6 seharusnya ditolak, dapat {r2.status_code}")


if __name__ == "__main__":
    login()
    root = test_real_placement()
    if root:
        test_sim_nested(root)
        test_sim_cascade(root)
    print("\n================ RINGKASAN ================")
    if fails:
        print(f"{FAIL} {len(fails)} masalah:")
        for f in fails:
            print(" -", f)
        sys.exit(1)
    print(f"{OK} SEMUA UJI LULUS")
