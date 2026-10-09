"""Uji unit aturan placement biner: turun ke KAKI TERLEMAH dari sponsor."""
import re
from typing import Any, Dict, List, Optional  # noqa: F401

src = open('/app/backend/core.py').read()
ns: Dict[str, Any] = {'Dict': Dict, 'List': List, 'Optional': Optional,
                      'Any': Any, 'BINARY_WIDTH': 2}
for fn in ['placement_descendants', 'placement_subtree_size', 'placement_path',
           'pick_balanced_slot', 'resolve_placement']:
    m = re.search(r'\ndef ' + fn + r'\(.*?(?=\ndef |\nasync def )', src, re.S)
    exec(m.group(0), ns)

resolve = ns['resolve_placement']


def simulate(n, sponsor='R', manual=None):
    kids = {'R': []}
    log = []
    for i in range(1, n + 1):
        info = resolve(kids, sponsor, manual)
        slot = info['placement_id']
        nid = 'M%02d' % i
        kids.setdefault(nid, [])
        kids.setdefault(slot, []).append(nid)
        log.append((nid, slot, info['turun']))
    return kids, log


def test_tiga_member_tanpa_placement_turun_otomatis():
    kids, log = simulate(3)
    assert len(kids['R']) == 2, kids
    assert log[2][1] == 'M01', log          # member ke-3 turun ke kaki terlemah
    assert log[2][2] is True


def test_tujuh_member_seimbang():
    kids, _ = simulate(7)
    assert len(kids['R']) == 2
    lv1 = sorted(kids['R'])
    assert [len(kids[c]) for c in lv1] == [2, 2], kids
    for m, c in kids.items():
        assert len(c) <= 2, (m, c)


def test_placement_manual_penuh_tidak_ditolak():
    kids = {'R': ['A', 'B'], 'A': [], 'B': []}
    info = resolve(kids, 'R', 'R')
    assert info['placement_id'] == 'A'
    assert info['turun'] is True
    assert 'KAKI TERLEMAH' in info['reason']


def test_selalu_pilih_kaki_dengan_member_paling_sedikit():
    # kaki A berat (3 member), kaki B ringan (1 member)
    kids = {'R': ['A', 'B'], 'A': ['A1', 'A2'], 'A1': [], 'A2': [], 'B': []}
    assert resolve(kids, 'R')['placement_id'] == 'B'


def test_turun_berlapis_sampai_slot_kosong():
    kids = {'R': ['A', 'B'],
            'A': ['A1', 'A2'], 'A1': [], 'A2': [],
            'B': ['B1', 'B2'], 'B1': [], 'B2': ['B2a'], 'B2a': []}
    # kaki R: A=3, B=4 -> turun ke A; kaki A: A1=1, A2=1 -> ambil A1 (ID terkecil)
    info = resolve(kids, 'R')
    assert info['placement_id'] == 'A1', info
    assert info['jalur'] == ['R', 'A', 'A1'], info['jalur']


def test_sponsor_tidak_dibatasi():
    # 10 member semuanya disponsori R -> placement tetap maks 2 kaki
    kids, log = simulate(10)
    assert all(len(c) <= 2 for c in kids.values())
    assert len(log) == 10


def test_pindah_member_tidak_melingkar():
    kids = {'R': ['A', 'B'], 'A': ['A1'], 'A1': [], 'B': []}
    info = resolve(kids, 'R', 'R', skip='A')
    assert info['placement_id'] not in ('A', 'A1'), info


if __name__ == '__main__':
    import traceback
    g = dict(globals())
    gagal = 0
    for nm, f in sorted(g.items()):
        if nm.startswith('test_'):
            try:
                f()
                print('OK  ', nm)
            except Exception:
                gagal += 1
                print('GAGAL', nm)
                traceback.print_exc()
    print('\nRINGKASAN:', 'SEMUA LULUS' if not gagal else f'{gagal} gagal')
    raise SystemExit(1 if gagal else 0)
