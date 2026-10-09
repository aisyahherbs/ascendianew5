"""Uji end-to-end: penonaktifan jenis bonus (global + per member) & penutupan halaman.

Jalankan: python3 /app/test_access_bonus.py
"""
import json
import random
import sys
import requests

RUN = random.randint(100, 999)
A, B_, C = f"QA{RUN}A", f"QA{RUN}B", f"QA{RUN}C"

BASE = "http://localhost:8001/api"
OK, FAIL = [], []


def check(name, cond, extra=""):
    (OK if cond else FAIL).append(name)
    print(("  PASS  " if cond else "  FAIL  ") + name + ((" | " + str(extra)) if extra and not cond else ""))


def api(method, path, token=None, **kw):
    h = kw.pop("headers", {})
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.request(method, BASE + path, headers=h, timeout=60, **kw)


def login(mid, pw):
    r = api("POST", "/auth/login", json={"member_id": mid, "password": pw})
    r.raise_for_status()
    return r.json()


def main():
    admin = login("ADMIN", "admin123")
    at = admin["token"]
    print("Login admin OK")

    api("PUT", "/settings", at, json={"bonus_disabled_global": [], "pages_blocked_global": {}})

    prov, city = "Jawa Timur", "Kota Surabaya"

    def mk(mid, name, sponsor=None, pv=0, kind="perkembangan"):
        body = {"member_id": mid, "name": name, "role": "member", "password": "123456",
                "phone": "0800000000", "province": prov, "city": city,
                "initial_pv": pv, "initial_pv_kind": kind}
        if sponsor:
            body["sponsor_id"] = sponsor
        r = api("POST", "/members", at, json=body)
        if r.status_code != 200:
            print("   create failed", mid, r.status_code, r.text[:200])
        return r.status_code == 200

    check("Buat member akar QA-A", mk(A, "QA Akar", pv=19000))
    check("Buat downline QA-B", mk(B_, "QA Kaki Satu", sponsor=A, pv=6000))
    check("Buat downline QA-C", mk(C, "QA Kaki Dua", sponsor=A, pv=6000, kind="penjualan"))

    def preview():
        r = api("GET", "/bonus/preview", at)
        r.raise_for_status()
        return {x["member_id"]: x for x in r.json()["results"]}

    base = preview()
    a = base.get(A, {})
    print("   QA-A bonus:", json.dumps({k: v for k, v in a.items() if k.startswith("bonus_")}))
    check("Bonus Sponsor QA-A > 0 sebelum dinonaktifkan", a.get("bonus_sponsor", 0) > 0, a.get("bonus_sponsor"))
    check("Ada baris rincian Bonus Sponsor",
          any(l["bonus"] == "Bonus Sponsor" for l in a.get("lines", [])))
    sponsor_before = a.get("bonus_sponsor", 0)
    prestasi_before = a.get("bonus_prestasi", 0)

    # ---------------------------------------------- nonaktifkan per member
    r = api("POST", "/members/bulk/access", at,
            json={"member_ids": [A], "bonus_disabled": ["sponsor"]})
    check("POST /members/bulk/access (per member) sukses", r.status_code == 200, r.text[:200])
    a2 = preview().get(A, {})
    check("Bonus Sponsor QA-A = 0 setelah dinonaktifkan", a2.get("bonus_sponsor", -1) == 0, a2.get("bonus_sponsor"))
    check("Tidak ada baris rincian Bonus Sponsor lagi",
          not any(l["bonus"] == "Bonus Sponsor" for l in a2.get("lines", [])))
    check("Bonus lain (prestasi) tidak berubah",
          abs(a2.get("bonus_prestasi", 0) - prestasi_before) < 0.01,
          f"{prestasi_before} -> {a2.get('bonus_prestasi')}")
    check("Total bonus berkurang tepat sebesar bonus sponsor",
          abs((a.get("total_bonus_bv", 0) - a2.get("total_bonus_bv", 0)) - sponsor_before) < 0.01)

    # ---------------------------------------------- kerahasiaan dari member
    m = login(A, "123456")
    mt = m["token"]
    r = api("GET", "/auth/me", mt)
    me = r.json()
    check("Member tidak melihat field bonus_disabled di /auth/me",
          "bonus_disabled" not in (me.get("user") or {}), list((me.get("user") or {}).keys()))
    check("Field blocked_pages ada di /auth/me", "blocked_pages" in me)
    r = api("GET", f"/members/{A}", mt)
    check("Member tidak melihat bonus_disabled di detail dirinya",
          "bonus_disabled" not in (r.json().get("member") or {}))
    r = api("GET", "/settings", mt)
    stt = r.json()["settings"]
    check("Member tidak melihat bonus_disabled_global di /settings",
          "bonus_disabled_global" not in stt and "pages_blocked_global" not in stt,
          list(stt.keys()))
    r = api("GET", f"/bonus/statement/{A}", mt)
    txt = r.text
    check("Slip bonus member tidak menyebut 'nonaktif'/'disabled'",
          "nonaktif" not in txt.lower() and "disabled" not in txt.lower())

    # ---------------------------------------------- tutup halaman per member
    r = api("POST", "/members/bulk/access", at,
            json={"member_ids": [A], "blocked_pages": ["statement", "network", "plan"]})
    check("Tutup 3 halaman untuk QA-A", r.status_code == 200, r.text[:200])
    m = login(A, "123456")
    mt = m["token"]
    check("blocked_pages ikut di respons login",
          set(m.get("blocked_pages") or []) >= {"statement", "network", "plan"}, m.get("blocked_pages"))
    check("GET /network ditolak 403", api("GET", "/network", mt).status_code == 403)
    check("GET /plan ditolak 403", api("GET", "/plan", mt).status_code == 403)
    check("GET /bonus/statement ditolak 403",
          api("GET", f"/bonus/statement/{A}", mt).status_code == 403)
    check("Halaman yang tidak ditutup tetap bisa (produk 200)",
          api("GET", "/products", mt).status_code == 200)
    check("Dashboard tetap bisa diakses", api("GET", "/dashboard", mt).status_code == 200)

    # ---------------------------------------------- global: bonus + halaman
    r = api("PUT", "/settings", at, json={"bonus_disabled_global": ["prestasi"],
                                          "pages_blocked_global": {"member": ["simulator"]}})
    check("Simpan pengaturan global sukses", r.status_code == 200, r.text[:300])
    b2 = preview()
    check("Bonus Prestasi semua member = 0 (global off)",
          all(x.get("bonus_prestasi", 0) == 0 for x in b2.values()),
          {k: v.get("bonus_prestasi") for k, v in b2.items()})
    m = login(B_, "123456")
    bt = m["token"]
    check("Member lain kena penutupan halaman global (simulator)",
          "simulator" in (m.get("blocked_pages") or []), m.get("blocked_pages"))
    check("POST /simulator ditolak 403 untuk member",
          api("POST", "/simulator", bt, json={"members": [{"id": "X"}]}).status_code == 403)
    check("Member lain TIDAK kena penutupan per-member QA-A",
          "statement" not in (m.get("blocked_pages") or []))

    # ---------------------------------------------- opsi & validasi
    r = api("GET", "/access/options", at)
    opt = r.json()
    check("GET /access/options berisi 7 jenis bonus", len(opt.get("bonus_types", [])) == 7)
    check("GET /access/options berisi daftar halaman", len(opt.get("pages", [])) >= 10)
    check("Member ditolak akses /access/options", api("GET", "/access/options", bt).status_code == 403)
    r = api("POST", "/members/bulk/access", at, json={"member_ids": [A], "bonus_disabled": ["ngawur"]})
    check("Jenis bonus tak dikenal ditolak 400", r.status_code == 400, r.text[:200])
    r = api("POST", "/members/bulk/access", at, json={"member_ids": [], "bonus_disabled": []})
    check("Tanpa member ditolak 400", r.status_code == 400)
    r = api("POST", "/members/bulk/access", at, json={"member_ids": ["ADMIN"], "blocked_pages": ["plan"]})
    check("Admin Pusat tidak bisa dibatasi", (r.json().get("failed") or [{}])[0].get("reason", "").startswith("Tidak bisa mengatur") or (r.json().get("failed") or [{}])[0].get("reason", "").startswith("Admin Pusat"), r.text[:200])

    # ---------------------------------------------- pulihkan (clear)
    r = api("POST", "/members/bulk/access", at,
            json={"member_ids": [A], "clear_bonus": True, "clear_pages": True})
    check("Clear bonus & halaman sukses", r.status_code == 200, r.text[:200])
    api("PUT", "/settings", at, json={"bonus_disabled_global": [], "pages_blocked_global": {}})
    a3 = preview().get(A, {})
    check("Bonus Sponsor kembali seperti semula",
          abs(a3.get("bonus_sponsor", 0) - sponsor_before) < 0.01,
          f"{sponsor_before} -> {a3.get('bonus_sponsor')}")
    m = login(A, "123456")
    check("Halaman terbuka kembali", not (m.get("blocked_pages") or []), m.get("blocked_pages"))
    check("GET /network 200 lagi", api("GET", "/network", m["token"]).status_code == 200)

    # bersih-bersih data uji
    for mid in (C, B_, A):
        api("POST", "/members/bulk/delete", at, json={"member_ids": [mid]})

    print(f"\nHASIL: {len(OK)} lulus, {len(FAIL)} gagal")
    if FAIL:
        print("GAGAL:", FAIL)
        sys.exit(1)


if __name__ == "__main__":
    main()
