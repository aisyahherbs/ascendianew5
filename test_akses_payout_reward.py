"""Uji pembatasan akses: Payout & Special Reward hanya Admin Pusat."""
import sys

import requests

B = "http://localhost:8001/api"
A = requests.Session()
fails = []


def login(mid, pw):
    s = requests.Session()
    r = s.post(f"{B}/auth/login", json={"member_id": mid, "password": pw})
    r.raise_for_status()
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


A = login("ADMIN", "admin123")

# --- buat akun sementara
tmp = []


def mk(role, mid, name, province="Jawa Barat", city="Kota Bandung", sponsor=None):
    body = {"member_id": mid, "name": name, "role": role, "phone": "0800",
            "province": province, "city": city, "password": "uji123456", "initial_pv": 0}
    if sponsor:
        body["sponsor_id"] = sponsor
    r = A.post(f"{B}/members", json=body)
    if r.status_code >= 400:
        print("GAGAL buat", mid, r.status_code, r.text[:200])
        fails.append(f"buat {mid}: {r.text[:120]}")
        return None
    tmp.append(mid)
    return r.json()["member"]


mk("admin_provinsi", "ZZPROV9", "UJI Admin Provinsi")
mk("stokis", "ZZSTOK9", "UJI Stokis")

try:
    P = login("ZZPROV9", "uji123456")
    S = login("ZZSTOK9", "uji123456")

    for nama, sess in (("admin_provinsi", P), ("stokis", S)):
        for ep in ("/payout?mode=period", "/special-reward?mode=period"):
            r = sess.get(B + ep)
            ok = r.status_code == 403
            print(f"{'OK  ' if ok else 'GAGAL'} {nama} {ep} -> {r.status_code}")
            if not ok:
                fails.append(f"{nama} boleh akses {ep} ({r.status_code})")

        r = sess.get(B + "/bonus/report?mode=period")
        print(f"{'OK  ' if r.status_code == 200 else 'GAGAL'} {nama} /bonus/report -> {r.status_code}")
        if r.status_code != 200:
            fails.append(f"{nama} tidak bisa akses /bonus/report")
        else:
            d = r.json()
            bocor = [k for k in ("payout_percent", "company_percent", "company_bv",
                                 "total_payout_bv", "reward_pool_bv") if k in d]
            print(f"{'OK  ' if not bocor else 'GAGAL'} {nama} /bonus/report tanpa data payout "
                  f"{('bocor: ' + str(bocor)) if bocor else ''}")
            if bocor:
                fails.append(f"{nama} /bonus/report membocorkan {bocor}")
            for row in d.get("results", []):
                if "bonus_reward" in row:
                    fails.append(f"{nama} hasil bonus masih punya bonus_reward")
                    break

        r = sess.get(B + "/plan")
        if r.status_code == 200:
            d = r.json()
            bocor = [k for k in ("reward_pool_rate", "reward_qualify_rank") if k in d]
            print(f"{'OK  ' if not bocor else 'GAGAL'} {nama} /plan tanpa rumus Special Reward "
                  f"{('bocor: ' + str(bocor)) if bocor else ''}")
            if bocor:
                fails.append(f"{nama} /plan membocorkan {bocor}")

        r = sess.get(B + "/bonus/preview")
        if r.status_code == 200:
            s = r.json().get("summary", {})
            bocor = [k for k in ("reward_pool_bv", "reward_allocation", "reward_qualifiers",
                                 "reward_rate", "reward_qualify_rank") if k in s]
            print(f"{'OK  ' if not bocor else 'GAGAL'} {nama} /bonus/preview tanpa pool reward "
                  f"{('bocor: ' + str(bocor)) if bocor else ''}")
            if bocor:
                fails.append(f"{nama} /bonus/preview membocorkan {bocor}")

    # dashboard admin provinsi: tanpa tren nasional & fee stokis nasional
    d = P.get(B + "/dashboard").json()
    bocor = [k for k in ("trend", "stokis_fees", "stokis_fee_total") if k in d]
    print(f"{'OK  ' if not bocor else 'GAGAL'} dashboard admin_provinsi tanpa data nasional "
          f"{('bocor: ' + str(bocor)) if bocor else ''}")
    if bocor:
        fails.append(f"dashboard provinsi membocorkan {bocor}")
    print(f"{'OK  ' if d.get('scope_note') else 'GAGAL'} dashboard admin_provinsi punya catatan wewenang")

    # admin pusat tetap dapat semua
    dp = A.get(B + "/payout?mode=period").json()
    sr = A.get(B + "/special-reward?mode=period").json()
    print("OK   pusat payout_percent =", dp["total_payout_percent"],
          "| reward pool =", sr["pool_bv"], "BV", f"({sr['pool_percent']}% omset)")
    dash = A.get(B + "/dashboard").json()
    print(f"{'OK  ' if 'trend' in dash else 'GAGAL'} dashboard pusat tetap punya tren nasional")
    pl = A.get(B + "/plan").json()
    print(f"{'OK  ' if 'reward_pool_rate' in pl else 'GAGAL'} /plan pusat tetap punya rumus reward")

    # total bonus member tidak lagi mengandung Special Reward
    prev = A.get(B + "/bonus/preview").json()
    ada = [r["member_id"] for r in prev.get("results", []) if "bonus_reward" in r]
    print(f"{'OK  ' if not ada else 'GAGAL'} hasil bonus tidak punya field bonus_reward {ada[:3]}")
    if ada:
        fails.append("results masih punya bonus_reward")
    lines = [l for r in prev.get("results", []) for l in (r.get("lines") or [])
             if l.get("bonus") == "Special Reward"]
    print(f"{'OK  ' if not lines else 'GAGAL'} tidak ada baris rumus Special Reward di rincian member")
    if lines:
        fails.append("masih ada baris rumus Special Reward")
finally:
    for mid in tmp:
        A.delete(f"{B}/members/{mid}")
    print("akun sementara dihapus:", tmp)

print("\n==== RINGKASAN ====")
print("SEMUA LULUS" if not fails else f"{len(fails)} masalah:\n - " + "\n - ".join(fails))
sys.exit(1 if fails else 0)
