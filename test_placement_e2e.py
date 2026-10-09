"""Uji end-to-end placement biner lewat API nyata (turun ke kaki terlemah)."""
import os
import sys

import requests

BASE = os.environ.get("API_BASE", "http://localhost:8001") + "/api"
S = requests.Session()
fails = []


def login():
    r = S.post(f"{BASE}/auth/login", json={"member_id": "ADMIN", "password": "admin123"})
    r.raise_for_status()
    S.headers["Authorization"] = f"Bearer {r.json()['token']}"


def create(name, sponsor=None, placement=None):
    body = {"name": name, "role": "member", "province": "Jawa Barat",
            "city": "Kota Bandung", "phone": "0800", "initial_pv": 0}
    if sponsor:
        body["sponsor_id"] = sponsor
    if placement:
        body["placement_id"] = placement
    r = S.post(f"{BASE}/members", json=body)
    if r.status_code >= 400:
        fails.append(f"create {name}: {r.status_code} {r.text[:200]}")
        print("GAGAL create", name, r.status_code, r.text[:200])
        return None
    return r.json()


def members():
    r = S.get(f"{BASE}/members", params={"limit": 2000})
    r.raise_for_status()
    d = r.json()
    rows = d["items"] if isinstance(d, dict) else d
    return [x for x in rows if x.get("role") == "member"]


def kids_map(rows):
    k = {r["member_id"]: [] for r in rows}
    for r in rows:
        p = r.get("placement_id")
        if p in k:
            k[p].append(r["member_id"])
    return k


def size(n, k):
    tot, st = 0, [n]
    while st:
        x = st.pop()
        tot += 1
        st += k.get(x, [])
    return tot


login()
root = create("E2E Root")
if not root:
    sys.exit(1)
rid = root["member"]["member_id"]
print("root =", rid)

dibuat = [rid]
for i in range(2, 9):
    res = create(f"E2E M{i}", sponsor=rid)
    if res:
        pid = res["member"]["member_id"]
        dibuat.append(pid)
        pi = res.get("placement_info") or {}
        print(f"  {pid} placement={res['member'].get('placement_id')} turun={pi.get('turun')}")

rows = [r for r in members() if r["member_id"] in dibuat]
k = kids_map(rows)

# 1. tidak ada node dengan >2 kaki
bad = {m: v for m, v in k.items() if len(v) > 2}
print("\n1) maks 2 kaki:", "OK" if not bad else f"GAGAL {bad}")
if bad:
    fails.append(f">2 kaki: {bad}")

# 2. sponsor tidak dibatasi
spon = [r for r in rows if r.get("sponsor_id") == rid]
print("2) sponsor frontline root =", len(spon), "OK" if len(spon) == 7 else "GAGAL")
if len(spon) != 7:
    fails.append(f"sponsor root {len(spon)} != 7")

# 3. member ke-3 masuk ke bawah (bukan root)
anak_root = k.get(rid, [])
print("3) kaki placement root =", anak_root, "OK" if len(anak_root) == 2 else "GAGAL")
if len(anak_root) != 2:
    fails.append(f"root kaki {anak_root}")

# 4. kaki level-1 seimbang
lv1 = sorted(anak_root)
sz = sorted(size(c, k) for c in lv1)
print("4) ukuran kaki level-1 =", sz, "OK" if abs(sz[0] - sz[1]) <= 1 else "GAGAL")
if abs(sz[0] - sz[1]) > 1:
    fails.append(f"kaki tidak seimbang {sz}")

# 5. placement manual penuh -> auto turun, tidak error
res = create("E2E Manual Penuh", sponsor=rid, placement=rid)
if res:
    mp = res["member"]
    print("5) manual penuh ->", mp.get("placement_id"),
          "OK" if mp.get("placement_id") != rid else "GAGAL")
    if mp.get("placement_id") == rid:
        fails.append("manual penuh menempel di root")
    print("   alasan:", (res.get("placement_info") or {}).get("reason", "")[:160])

# 6. endpoint saran placement
r = S.get(f"{BASE}/placement-slot", params={"sponsor_id": rid})
print("6) /placement-slot ->", r.status_code, r.json().get("placement_id"),
      "jalur", r.json().get("jalur"))
if r.status_code != 200:
    fails.append("placement-slot gagal")

print("\n==== RINGKASAN ====")
print("SEMUA LULUS" if not fails else f"{len(fails)} masalah: {fails}")
sys.exit(1 if fails else 0)
