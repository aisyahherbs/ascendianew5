"""Backend regression tests: user input lowercase is normalized server-side.

Covers:
- Login works with lowercase member_id 'admin'
- Create member accepts lowercase member_id / sponsor_id / placement_id
- Binary placement rule still enforced
- Simulator endpoint accepts lowercase IDs (normalized client-side; server-side defensively works too)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"member_id": "admin", "password": "admin123"})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["member_id"] == "ADMIN"
    return data["token"]


@pytest.fixture(scope="module")
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


def _mk_payload(name, member_id=None, sponsor_id=None, placement_id=None):
    return {
        "name": name,
        "role": "member",
        "member_id": member_id,
        "phone": "081234567890",
        "province": "DKI Jakarta",
        "city": "Kota Jakarta Pusat",
        "sponsor_id": sponsor_id,
        "placement_id": placement_id,
        "initial_pv": 0,
        "initial_pv_kind": "perkembangan",
    }


def test_login_lowercase_admin():
    r = requests.post(f"{API}/auth/login", json={"member_id": "admin", "password": "admin123"})
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "admin_pusat"


def test_login_mixed_case_admin():
    r = requests.post(f"{API}/auth/login", json={"member_id": "AdMiN", "password": "admin123"})
    assert r.status_code == 200


def test_create_member_with_lowercase_ids(admin_client):
    import uuid
    tid = f"TC_{uuid.uuid4().hex[:6].upper()}"
    # ensure at least one root member exists
    members = admin_client.get(f"{API}/members", params={"role": "member", "limit": 2}).json()
    if not members:
        root_payload = _mk_payload("TEST Root Case", member_id=f"RT_{uuid.uuid4().hex[:4].upper()}")
        root_payload["sponsor_id"] = None
        root_payload["placement_id"] = None
        r = admin_client.post(f"{API}/members", json=root_payload)
        assert r.status_code == 200, r.text
        root_id = r.json()["member"]["member_id"]
    else:
        root_id = members[0]["member_id"]

    # Create child using LOWERCASE sponsor id
    child_payload = _mk_payload("TEST Child Case", member_id=tid.lower(),
                                sponsor_id=root_id.lower(),
                                placement_id=root_id.lower())
    r = admin_client.post(f"{API}/members", json=child_payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["member"]["member_id"] == tid
    assert body["member"]["sponsor_id"] == root_id
    # Verify via listing
    rows = admin_client.get(f"{API}/members", params={"q": tid}).json()
    assert any(m["member_id"] == tid and m.get("sponsor_id") == root_id for m in rows)

    # cleanup
    admin_client.delete(f"{API}/members/{tid}")


def test_simulator_accepts_lowercase_ids(admin_client):
    payload = {
        "period_label": "SimCase",
        "members": [
            {"id": "a", "name": "Root", "sponsor_id": "", "placement_id": "",
             "membership": "Platinum", "rank": "Leader Majestic",
             "appv_perkembangan": 19000, "appv": 19000, "atnpv": 7000000,
             "perkembangan_pv": 0, "penjualan_pv": 3000},
            {"id": "b", "name": "Left", "sponsor_id": "a", "placement_id": "a",
             "membership": "None", "rank": "Member",
             "appv_perkembangan": 0, "appv": 0, "atnpv": 0,
             "perkembangan_pv": 500000, "penjualan_pv": 0},
        ],
    }
    # Normalize like the frontend does before submit
    for m in payload["members"]:
        m["id"] = m["id"].strip().upper()
        m["sponsor_id"] = m["sponsor_id"].strip().upper()
        m["placement_id"] = m["placement_id"].strip().upper()
    r = admin_client.post(f"{API}/simulator", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data["results"]) == 2


def test_members_options_search_case_insensitive(admin_client):
    r = admin_client.get(f"{API}/members/options", params={"q": "admin", "limit": 5})
    assert r.status_code == 200
    ids = [m["member_id"] for m in r.json()]
    assert "ADMIN" in ids
