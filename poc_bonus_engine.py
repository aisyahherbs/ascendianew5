"""POC: validate the MLM bonus engine against every worked example in the spec."""
import sys
sys.path.insert(0, "/app/backend")
from engine import MemberIn, TxIn, run_period  # noqa

OK, FAIL = [], []


def check(name, got, want, tol=0.01):
    if abs(got - want) <= tol:
        OK.append(name)
        print(f"  PASS  {name}: {got}")
    else:
        FAIL.append(f"{name}: got {got} want {want}")
        print(f"  FAIL  {name}: got {got} want {want}")


def R(res, mid):
    return next(r for r in res["results"] if r["member_id"] == mid)


# ---------------------------------------------------------------- 1 SPONSOR
def t_sponsor():
    print("\n[1] Bonus Sponsor")
    ms = [
        MemberIn("BRZ", None, None, "Bronze upline", appv_perkembangan=2500, appv=2500),
        MemberIn("PLT", None, None, "Platinum upline", appv_perkembangan=19000, appv=19000),
        MemberIn("A", "BRZ", "BRZ", "recruit of bronze"),
        MemberIn("B", "PLT", "PLT", "recruit of platinum"),
    ]
    txs = [TxIn("A", 19000, "perkembangan"), TxIn("B", 19000, "perkembangan")]
    res = run_period(ms, txs)
    check("Bronze recruits Platinum -> 1.900 BV", R(res, "BRZ")["bonus_sponsor"], 1900)
    check("Platinum recruits Platinum -> 3.800 BV", R(res, "PLT")["bonus_sponsor"], 3800)
    # no pass-up: BRZ's own sponsor gets nothing
    check("no pass-up (A gets 0 sponsor)", R(res, "A")["bonus_sponsor"], 0)
    check("membership A upgraded to Platinum",
          1 if R(res, "A")["membership"] == "Platinum" else 0, 1)


# ---------------------------------------------------------------- 2 PASANGAN
def t_pasangan():
    print("\n[2] Bonus Pasangan (example: legs 500.000 & 300.000, Platinum)")
    ms = [
        MemberIn("P", None, None, "Platinum", appv_perkembangan=19000, appv=19000,
                 atnpv=7000000, rank="Leader Majestic"),
        MemberIn("A", "P", "P", "leg1"), MemberIn("B", "P", "P", "leg2"),
    ]
    txs = [TxIn("A", 500000, "perkembangan"), TxIn("B", 300000, "perkembangan"),
           TxIn("P", 3000, "penjualan")]
    res = run_period(ms, txs, "P1")
    p = R(res, "P")
    check("pairing bonus = 45.000 BV", p["bonus_pasangan"], 45000)
    check("carry leg A = 200.000 PV", p["carry"]["A"], 200000)
    check("carry leg B = 0", p["carry"]["B"], 0)

    print("  -- period 2: carry 200.000 used, B brings 250.000")
    ms2 = [
        MemberIn("P", None, None, "Platinum", appv_perkembangan=19000, appv=19000,
                 atnpv=7000000, rank="Leader Majestic", carry={"A": 200000, "B": 0}),
        MemberIn("A", "P", "P"), MemberIn("B", "P", "P"),
    ]
    res2 = run_period(ms2, [TxIn("B", 250000, "perkembangan"), TxIn("P", 3000, "penjualan")], "P2")
    p2 = R(res2, "P")
    check("period2 pairing = min(carry A 200.000, B 250.000) x 15% = 30.000",
          p2["bonus_pasangan"], 30000)
    check("period2 carry A = 0 (200k-200k... paired 200k)", p2["carry"]["A"], 0)
    check("period2 carry B = 50.000 (250.000-200.000)", p2["carry"]["B"], 50000)

    print("  -- cap test: Bronze max 2.500 BV per period")
    ms3 = [MemberIn("P", None, None, appv_perkembangan=2500, appv=2500),
           MemberIn("A", "P", "P"), MemberIn("B", "P", "P")]
    res3 = run_period(ms3, [TxIn("A", 100000, "perkembangan"), TxIn("B", 100000, "perkembangan")])
    check("Bronze pairing capped 2.500 BV", R(res3, "P")["bonus_pasangan"], 2500)

    print("  -- carry reset when no pairing bonus in a period")
    ms4 = [MemberIn("P", None, None, appv_perkembangan=19000, appv=19000,
                    carry={"A": 200000, "B": 0}),
           MemberIn("A", "P", "P"), MemberIn("B", "P", "P")]
    res4 = run_period(ms4, [])
    check("no pairing -> carry A reset to 0", R(res4, "P")["carry"]["A"], 0)

    print("  -- single leg only -> no pairing")
    ms5 = [MemberIn("P", None, None, appv_perkembangan=19000, appv=19000),
           MemberIn("A", "P", "P")]
    res5 = run_period(ms5, [TxIn("A", 100000, "perkembangan")])
    check("1 leg -> pairing 0", R(res5, "P")["bonus_pasangan"], 0)


# ---------------------------------------------------------------- 3 BIMBINGAN
def t_bimbingan():
    print("\n[3] Bonus Bimbingan (3% per generasi, kompresi)")
    # TOP(Platinum) -> X(no pairing, compressed) -> D1(pairing) -> D2(pairing)
    def leg(prefix, parent_pl, sponsor):
        return [MemberIn(f"{prefix}A", sponsor, parent_pl), MemberIn(f"{prefix}B", sponsor, parent_pl)]

    ms = [
        MemberIn("TOP", None, None, appv_perkembangan=19000, appv=19000),
        MemberIn("X", "TOP", "TOP", appv_perkembangan=19000, appv=19000),   # no pairing
        MemberIn("D1", "X", "X", appv_perkembangan=19000, appv=19000),
        MemberIn("D2", "D1", "D1", appv_perkembangan=19000, appv=19000),
    ]
    # give TOP, D1, D2 two placement legs each with perkembangan
    ms += [MemberIn("T1", "TOP", "TOP"), MemberIn("T2", "TOP", "TOP")]
    ms += [MemberIn("E1", "D1", "D1"), MemberIn("E2", "D1", "D1")]
    ms += [MemberIn("F1", "D2", "D2"), MemberIn("F2", "D2", "D2")]
    txs = [TxIn(x, 100000, "perkembangan") for x in ["T1", "T2", "E1", "E2", "F1", "F2"]]
    txs += [TxIn(x, 3000, "penjualan") for x in ["TOP", "X", "D1", "D2"]]
    res = run_period(ms, txs)
    top, d1, d2 = R(res, "TOP"), R(res, "D1"), R(res, "D2")
    check("TOP pairing 15.000 BV", top["bonus_pasangan"], 15000)
    check("D1 pairing 15.000 BV", d1["bonus_pasangan"], 15000)
    check("X pairing 0 (kompresi)", R(res, "X")["bonus_pasangan"], 0)
    # TOP gen1 = D1 (X compressed), gen2 = D2
    check("TOP bimbingan = 3%*(D1)+3%*(D2) = 900", top["bonus_bimbingan"], 900)
    check("D1 bimbingan = 3%*D2 = 450", d1["bonus_bimbingan"], 450)
    check("D2 bimbingan = 0", d2["bonus_bimbingan"], 0)

    print("  -- requires own pairing bonus")
    ms2 = [MemberIn("TOP", None, None, appv_perkembangan=19000, appv=19000),
           MemberIn("D1", "TOP", "TOP", appv_perkembangan=19000, appv=19000),
           MemberIn("E1", "D1", "D1"), MemberIn("E2", "D1", "D1")]
    res2 = run_period(ms2, [TxIn("E1", 100000, "perkembangan"), TxIn("E2", 100000, "perkembangan"),
                            TxIn("TOP", 3000, "penjualan"), TxIn("D1", 3000, "penjualan")])
    check("TOP without pairing -> bimbingan 0", R(res2, "TOP")["bonus_bimbingan"], 0)


# ---------------------------------------------------------------- 4 PRESTASI
def t_prestasi():
    print("\n[4] Bonus Prestasi (example -> 62.500 BV)")
    ms = [
        MemberIn("LA", None, None, "Leader Ambassador", appv_perkembangan=19000,
                 appv=19000, atnpv=700000, rank="Leader Ambassador"),
        MemberIn("C1", "LA", "LA", rank="Crown Star", appv=19000, atnpv=300000),
        MemberIn("C2", "LA", "LA", rank="Crown Star", appv=19000, atnpv=300000),
        MemberIn("R1", "LA", "LA", rank="Royal Star", appv=19000, atnpv=90000),
        MemberIn("R2", "LA", "LA", rank="Royal Star", appv=19000, atnpv=90000),
    ]
    txs = [TxIn("C1", 500000, "penjualan"), TxIn("C2", 500000, "penjualan"),
           TxIn("R1", 150000, "penjualan"), TxIn("R2", 100000, "penjualan"),
           TxIn("LA", 3000, "penjualan")]
    res = run_period(ms, txs)
    la = R(res, "LA")
    diff = la["bonus_prestasi"] - 3000 * 0.26  # minus own personal purchase part
    check("LA differential prestasi = 62.500 BV", diff, 62500)
    check("C1 prestasi = 500.000 x 22%", R(res, "C1")["bonus_prestasi"], 110000)
    check("R1 prestasi = 150.000 x 17%", R(res, "R1")["bonus_prestasi"], 25500)

    print("  -- tupo gating: Royal Star without 1.000 PV penjualan")
    ms2 = [MemberIn("RS", None, None, rank="Royal Star", appv=19000, appv_perkembangan=19000),
           MemberIn("D", "RS", "RS", rank="Member")]
    res2 = run_period(ms2, [TxIn("D", 10000, "penjualan"), TxIn("RS", 500, "penjualan")])
    check("RS tupo not met -> prestasi 0", R(res2, "RS")["bonus_prestasi"], 0)
    res3 = run_period(ms2, [TxIn("D", 10000, "penjualan"), TxIn("RS", 1000, "penjualan")])
    check("RS tupo met -> 1.000*17% own + 10.000*(17%-10% VIP) selisih",
          R(res3, "RS")["bonus_prestasi"], 1000 * 0.17 + 10000 * 0.07)


# ---------------------------------------------------------------- 5 KEPEMIMPINAN
def t_kepemimpinan():
    print("\n[5] Bonus Kepemimpinan")
    ms = [
        MemberIn("L", None, None, rank="Leader Majestic", appv=19000,
                 appv_perkembangan=19000, atnpv=7000000),
        MemberIn("G1", "L", "L", rank="Crown Star", appv=19000, atnpv=300000),
        MemberIn("NC", "G1", "G1", rank="Royal Star", appv=19000, atnpv=90000),
        MemberIn("G2", "NC", "NC", rank="Crown Star", appv=19000, atnpv=300000),
    ]
    txs = [TxIn("L", 3000, "penjualan"), TxIn("G1", 2000, "penjualan"),
           TxIn("G2", 2000, "penjualan"), TxIn("NC", 100000, "penjualan")]
    res = run_period(ms, txs)
    l = R(res, "L")
    # gen1 = G1 segment (G1 2.000 + NC 100.000) x 3% ; gen2 = G2 (2.000) x 2%
    check("L kepemimpinan = 3%*102.000 + 2%*2.000", l["bonus_kepemimpinan"],
          102000 * 0.03 + 2000 * 0.02)
    check("G1 kepemimpinan gen1 = 2%? -> G2 at gen1 3%",
          R(res, "G1")["bonus_kepemimpinan"], 2000 * 0.03)
    check("non crown star gets 0", R(res, "NC")["bonus_kepemimpinan"], 0)


# ---------------------------------------------------------------- 6 PLACEMENT
def t_placement():
    print("\n[6] Placement rules (C sponsored by YOU, placed under A)")
    ms = [
        MemberIn("YOU", None, None, appv_perkembangan=19000, appv=19000, rank="Crown Star", atnpv=300000),
        MemberIn("A", "YOU", "YOU", appv_perkembangan=19000, appv=19000, rank="Crown Star", atnpv=300000),
        MemberIn("B", "YOU", "YOU", appv_perkembangan=19000, appv=19000),
        MemberIn("C", "YOU", "A", appv_perkembangan=19000, appv=19000),  # sponsor YOU, placement A
    ]
    txs = [TxIn("C", 100000, "perkembangan"), TxIn("B", 100000, "perkembangan"),
           TxIn("A", 2000, "penjualan"), TxIn("YOU", 2000, "penjualan"),
           TxIn("C", 50000, "penjualan")]
    res = run_period(ms, txs)
    you, a = R(res, "YOU"), R(res, "A")
    check("YOU sponsor bonus from B + C (2 x 100.000 x 20%)", you["bonus_sponsor"], 40000)
    check("A gets NO sponsor bonus from C", a["bonus_sponsor"], 0)
    check("A's TNPV excludes C (only A's own 2.000)", a["tnpv"], 2000)
    check("YOU TNPV includes C", you["tnpv"], 100000 + 100000 + 2000 + 2000 + 50000)
    # YOU pairing legs (placement): A-leg = A + C = 100.000, B-leg = 100.000
    check("YOU pairing uses placement legs (100.000 x 15%)", you["bonus_pasangan"], 15000)
    check("A prestasi from C = 0 (different sponsor line)", a["bonus_prestasi"], 2000 * 0.22)


# ---------------------------------------------------------------- 7 RANK / SHARING
def t_rank_sharing():
    print("\n[7] Rank progression, Sharing Profit & Reward")
    ms = [MemberIn("M1", None, None)]
    res = run_period(ms, [TxIn("M1", 6000, "perkembangan")])
    check("APPV 6.000 -> VIP", 1 if R(res, "M1")["rank"] == "VIP" else 0, 1)
    res = run_period([MemberIn("M1", None, None)], [TxIn("M1", 15000, "perkembangan")])
    check("APPV 15.000 -> Royal Star", 1 if R(res, "M1")["rank"] == "Royal Star" else 0, 1)

    # VIP with ATNPV 75.000 -> Royal Star
    ms = [MemberIn("M1", None, None, appv=6000, appv_perkembangan=6000, rank="VIP"),
          MemberIn("D", "M1", "M1")]
    res = run_period(ms, [TxIn("D", 69000, "penjualan")])
    check("VIP + ATNPV 75.000 -> Royal Star",
          1 if R(res, "M1")["rank"] == "Royal Star" else 0, 1)

    # Crown Star needs ATNPV 225.000 and KG 45.000
    ms = [MemberIn("M1", None, None, appv=19000, appv_perkembangan=19000, rank="Royal Star"),
          MemberIn("K1", "M1", "M1"), MemberIn("K2", "M1", "M1")]
    res = run_period(ms, [TxIn("K1", 200000, "penjualan"), TxIn("K2", 10000, "penjualan")])
    check("KG only 10.000 -> stays Royal Star",
          1 if R(res, "M1")["rank"] == "Royal Star" else 0, 1)
    res = run_period(ms, [TxIn("K1", 200000, "penjualan"), TxIn("K2", 50000, "penjualan")])
    check("KG 50.000 + ATNPV 269.000 -> Crown Star",
          1 if R(res, "M1")["rank"] == "Crown Star" else 0, 1)

    # Director: 3 legs with Leader Majestic
    ms = [MemberIn("DIR", None, None, appv=19000, appv_perkembangan=19000,
                   rank="Leader Majestic", atnpv=20000000)]
    for i in range(3):
        ms.append(MemberIn(f"LM{i}", "DIR", "DIR", rank="Leader Majestic",
                           appv=19000, atnpv=7000000))
    res = run_period(ms, [TxIn("DIR", 3000, "penjualan")] +
                     [TxIn(f"LM{i}", 3000, "penjualan") for i in range(3)])
    check("3 kaki Leader Majestic -> Director",
          1 if R(res, "DIR")["rank"] == "Director" else 0, 1)
    total_omset = 3000 * 4
    check("Sharing profit Director = 2% omset nasional",
          R(res, "DIR")["bonus_sharing_profit"], total_omset * 0.02)
    check("Reward pool 2% split among Majestic+ (4 orang)",
          R(res, "DIR")["bonus_reward"], total_omset * 0.02 / 4)


# ---------------------------------------------------------------- 8 PLATINUM VIA GOLD
def t_platinum_gold():
    print("\n[8] Platinum via Gold + 2 frontline Gold")
    ms = [MemberIn("G", None, None, appv_perkembangan=10000, appv=10000, membership="Gold"),
          MemberIn("F1", "G", "G", appv_perkembangan=10000, appv=10000, membership="Gold"),
          MemberIn("F2", "G", "G", appv_perkembangan=10000, appv=10000, membership="Gold")]
    res = run_period(ms, [])
    check("Gold + 2 frontline Gold -> Platinum",
          1 if R(res, "G")["membership"] == "Platinum" else 0, 1)


if __name__ == "__main__":
    t_sponsor()
    t_pasangan()
    t_bimbingan()
    t_prestasi()
    t_kepemimpinan()
    t_placement()
    t_rank_sharing()
    t_platinum_gold()
    print(f"\n==== {len(OK)} passed, {len(FAIL)} failed ====")
    for f in FAIL:
        print("  X", f)
    sys.exit(1 if FAIL else 0)
