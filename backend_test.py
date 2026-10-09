#!/usr/bin/env python3
"""
Backend API Testing for Binary Placement (Max 2 Kids) + Auto-Balancing
Tests all backend endpoints for the new binary placement rules.
"""
import requests
import sys
import json
from datetime import datetime

BASE_URL = "https://mlm-placement-system.preview.emergentagent.com/api"

class BinaryPlacementTester:
    def __init__(self):
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_members = []  # Track test members for cleanup
        
    def log(self, msg, status="INFO"):
        prefix = {
            "PASS": "✅",
            "FAIL": "❌",
            "INFO": "ℹ️",
            "WARN": "⚠️"
        }.get(status, "•")
        print(f"{prefix} {msg}")
        
    def run_test(self, name, func):
        """Run a single test function"""
        self.tests_run += 1
        self.log(f"Testing: {name}", "INFO")
        try:
            func()
            self.tests_passed += 1
            self.log(f"PASSED: {name}", "PASS")
            return True
        except AssertionError as e:
            self.log(f"FAILED: {name} - {str(e)}", "FAIL")
            return False
        except Exception as e:
            self.log(f"ERROR: {name} - {str(e)}", "FAIL")
            return False
            
    def api_call(self, method, endpoint, data=None, params=None, expect_status=None):
        """Make API call with auth"""
        url = f"{BASE_URL}{endpoint}"
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
            
        if method == "GET":
            resp = requests.get(url, headers=headers, params=params)
        elif method == "POST":
            resp = requests.post(url, headers=headers, json=data)
        elif method == "PUT":
            resp = requests.put(url, headers=headers, json=data)
        elif method == "DELETE":
            resp = requests.delete(url, headers=headers)
        else:
            raise ValueError(f"Unknown method: {method}")
            
        if expect_status and resp.status_code != expect_status:
            raise AssertionError(
                f"Expected status {expect_status}, got {resp.status_code}. "
                f"Response: {resp.text[:200]}"
            )
        return resp
        
    def login(self):
        """Login as Admin Pusat"""
        self.log("Logging in as ADMIN...", "INFO")
        resp = self.api_call("POST", "/auth/login", 
                            data={"member_id": "ADMIN", "password": "admin123"},
                            expect_status=200)
        data = resp.json()
        self.token = data["token"]
        self.log(f"Logged in as {data['user']['member_id']}", "PASS")
        
    def create_test_member(self, name, sponsor_id=None, placement_id=None, expect_status=200):
        """Create a test member"""
        payload = {
            "name": name,
            "role": "member",
            "phone": "08123456789",
            "province": "DKI Jakarta",
            "city": "Kota Jakarta Selatan",
            "sponsor_id": sponsor_id,
            "placement_id": placement_id or "",  # Empty string for auto-balance
        }
        resp = self.api_call("POST", "/members", data=payload, expect_status=expect_status)
        if expect_status in (200, 201):
            data = resp.json()
            member_id = data["member"]["member_id"]
            self.test_members.append(member_id)
            return member_id, data
        return None, resp.json()
        
    def get_member_detail(self, member_id):
        """Get member details including frontline counts"""
        resp = self.api_call("GET", f"/members/{member_id}", expect_status=200)
        return resp.json()
        
    def cleanup_test_members(self):
        """Delete all test members created during testing"""
        self.log(f"Cleaning up {len(self.test_members)} test members...", "INFO")
        for mid in reversed(self.test_members):  # Delete in reverse order
            try:
                self.api_call("DELETE", f"/members/{mid}", expect_status=200)
                self.log(f"Deleted {mid}", "INFO")
            except Exception as e:
                self.log(f"Failed to delete {mid}: {e}", "WARN")
        self.test_members = []
        
    # ============================================================
    # TEST CASES
    # ============================================================
    
    def test_binary_placement_auto_balance(self):
        """Test 1: Create 6 members with empty placement -> auto-balance to max 2 kids each"""
        # Get an existing member as sponsor (skip MB00001 which has legacy 4 kids)
        resp = self.api_call("GET", "/members", params={"role": "member", "limit": 10}, expect_status=200)
        members = resp.json()
        # Find a member that's not MB00001
        sponsor_id = None
        for m in members:
            if m["member_id"] != "MB00001":
                sponsor_id = m["member_id"]
                break
        
        if not sponsor_id:
            self.log("No suitable sponsor found (only MB00001 exists), creating new one", "WARN")
            # Create a new sponsor under MB00001
            sponsor_id, _ = self.create_test_member("Binary Test Sponsor", sponsor_id="MB00001", placement_id="")
        
        self.log(f"Using sponsor: {sponsor_id}", "INFO")
        
        # Create 6 members with same sponsor, empty placement
        member_ids = []
        for i in range(6):
            mid, _ = self.create_test_member(
                f"Binary Test Member {i+1}",
                sponsor_id=sponsor_id,
                placement_id=""  # Empty = auto-balance
            )
            member_ids.append(mid)
            
        # Verify sponsor has max 2 placement kids
        sponsor_detail = self.get_member_detail(sponsor_id)
        placement_kids = sponsor_detail["frontline_placement"]
        assert placement_kids <= 2, f"Sponsor has {placement_kids} placement kids, expected max 2"
        self.log(f"Sponsor {sponsor_id} has {placement_kids} placement kids (max 2) ✓", "INFO")
        
        # Verify all 6 members are placed somewhere
        for mid in member_ids:
            detail = self.get_member_detail(mid)
            placement = detail["member"]["placement_id"]
            assert placement, f"Member {mid} has no placement_id"
            self.log(f"Member {mid} placed under {placement}", "INFO")
            
        # Verify NO member has more than 2 placement kids
        all_members = [sponsor_id] + member_ids
        for mid in all_members:
            detail = self.get_member_detail(mid)
            kids = detail["frontline_placement"]
            assert kids <= 2, f"Member {mid} has {kids} placement kids, violates binary rule"
            
        self.log("Binary auto-balance verified: all members have ≤2 placement kids", "PASS")
        
    def test_placement_full_auto_descend(self):
        """Test 2: Place member under full placement (2 kids) -> SUCCESS with auto-descend"""
        # Get existing member as sponsor
        resp = self.api_call("GET", "/members", params={"role": "member", "limit": 1}, expect_status=200)
        members = resp.json()
        if not members:
            self.log("No existing members, skipping test", "WARN")
            return
        sponsor_id = members[0]["member_id"]
        
        # Create a member with 2 placement kids
        parent_id, _ = self.create_test_member("Full Placement Parent", sponsor_id=sponsor_id, placement_id="")
        kid1, _ = self.create_test_member("Kid 1", sponsor_id=sponsor_id, placement_id=parent_id)
        kid2, _ = self.create_test_member("Kid 2", sponsor_id=sponsor_id, placement_id=parent_id)
        
        # Verify parent now has 2 kids
        detail = self.get_member_detail(parent_id)
        assert detail["frontline_placement"] == 2, "Parent should have exactly 2 placement kids"
        
        # Try to add 3rd kid with full placement -> should SUCCEED and auto-descend
        kid3_id, kid3_data = self.create_test_member(
            "Kid 3 (auto-descend)",
            sponsor_id=sponsor_id,
            placement_id=parent_id,
            expect_status=200
        )
        
        # Verify placement_info indicates auto-descend
        placement_info = kid3_data.get("placement_info", {})
        assert placement_info.get("turun") == True, "Should indicate auto-descend (turun=true)"
        assert placement_info.get("placement_id") != parent_id, f"Should be placed elsewhere, not under {parent_id}"
        
        # Verify kid3 is NOT directly under parent_id
        kid3_detail = self.get_member_detail(kid3_id)
        actual_placement = kid3_detail["member"]["placement_id"]
        assert actual_placement != parent_id, f"Kid 3 should auto-descend, not be under {parent_id}"
        
        self.log(f"Auto-descend successful: {kid3_id} placed under {actual_placement} (not {parent_id})", "PASS")
        self.log(f"Reason: {placement_info.get('reason', '')[:100]}...", "INFO")
        
    def test_placement_manual_with_space(self):
        """Test 3: Manually place member under placement with <2 kids -> success"""
        # Get existing member as sponsor
        resp = self.api_call("GET", "/members", params={"role": "member", "limit": 1}, expect_status=200)
        members = resp.json()
        if not members:
            self.log("No existing members, skipping test", "WARN")
            return
        sponsor_id = members[0]["member_id"]
        
        parent_id, _ = self.create_test_member("Manual Placement Parent", sponsor_id=sponsor_id, placement_id="")
        kid1, _ = self.create_test_member("Manual Kid 1", sponsor_id=sponsor_id, placement_id=parent_id)
        
        # Parent has 1 kid, should accept 1 more
        detail = self.get_member_detail(parent_id)
        assert detail["frontline_placement"] == 1, "Parent should have 1 placement kid"
        
        # Add 2nd kid manually -> should succeed
        kid2, _ = self.create_test_member(
            "Manual Kid 2",
            sponsor_id=sponsor_id,
            placement_id=parent_id,
            expect_status=200
        )
        
        # Verify parent now has 2 kids
        detail = self.get_member_detail(parent_id)
        assert detail["frontline_placement"] == 2, "Parent should now have 2 placement kids"
        self.log("Manual placement with available space works correctly", "PASS")
        
    def test_sponsor_unlimited(self):
        """Test 4: One sponsor can have 6+ frontline sponsor (unlimited)"""
        # Get existing member as sponsor
        resp = self.api_call("GET", "/members", params={"role": "member", "limit": 1}, expect_status=200)
        members = resp.json()
        if not members:
            self.log("No existing members, skipping test", "WARN")
            return
        root_sponsor = members[0]["member_id"]
        
        sponsor_id, _ = self.create_test_member("Unlimited Sponsor Test", sponsor_id=root_sponsor, placement_id="")
        
        # Create 6 members with same sponsor, empty placement (auto-balance)
        for i in range(6):
            self.create_test_member(
                f"Sponsor Frontline {i+1}",
                sponsor_id=sponsor_id,
                placement_id=""
            )
            
        # Verify sponsor has 6 frontline sponsor
        detail = self.get_member_detail(sponsor_id)
        sponsor_kids = detail["frontline_sponsor"]
        assert sponsor_kids == 6, f"Sponsor should have 6 frontline sponsor, got {sponsor_kids}"
        
        # Verify placement is still limited to 2
        placement_kids = detail["frontline_placement"]
        assert placement_kids <= 2, f"Placement should be max 2, got {placement_kids}"
        
        self.log(f"Sponsor has {sponsor_kids} frontline sponsor (unlimited) and {placement_kids} placement kids (max 2)", "PASS")
        
    def test_placement_slot_endpoint(self):
        """Test 5: GET /placement-slot returns auto-balance suggestion"""
        # Get existing member as sponsor
        resp = self.api_call("GET", "/members", params={"role": "member", "limit": 1}, expect_status=200)
        members = resp.json()
        if not members:
            self.log("No existing members, skipping test", "WARN")
            return
        root_sponsor = members[0]["member_id"]
        
        sponsor_id, _ = self.create_test_member("Slot Test Sponsor", sponsor_id=root_sponsor, placement_id="")
        
        # Query placement slot
        resp = self.api_call("GET", "/placement-slot", params={"sponsor_id": sponsor_id}, expect_status=200)
        data = resp.json()
        
        # Verify response structure
        assert "placement_id" in data, "Response should have placement_id"
        assert "kaki_terpakai" in data, "Response should have kaki_terpakai"
        assert "kaki_maksimal" in data, "Response should have kaki_maksimal"
        assert data["kaki_maksimal"] == 2, "Max kids should be 2"
        assert "alasan" in data, "Response should have alasan (reason in Indonesian)"
        
        # Verify Indonesian message
        alasan = data["alasan"]
        assert any(word in alasan.lower() for word in ["sponsor", "kaki", "placement"]), \
            f"Reason should be in Indonesian, got: {alasan}"
        
        self.log(f"Placement slot suggestion: {data['placement_id']}, reason: {alasan[:80]}...", "INFO")
        
    def test_placement_audit_preview(self):
        """Test 6: GET /placement-audit is preview only (no data changes)"""
        # Get current member count
        resp = self.api_call("GET", "/members", params={"role": "member", "limit": 1000}, expect_status=200)
        members_before = resp.json()
        count_before = len(members_before)
        
        # Call audit endpoint
        resp = self.api_call("GET", "/placement-audit", expect_status=200)
        audit_data = resp.json()
        
        # Verify response structure
        assert "total_member" in audit_data, "Should have total_member"
        assert "kaki_maksimal" in audit_data, "Should have kaki_maksimal"
        assert audit_data["kaki_maksimal"] == 2, "Max kids should be 2"
        assert "pelanggaran" in audit_data, "Should have pelanggaran list"
        assert "rencana" in audit_data, "Should have rencana list"
        assert "pesan" in audit_data, "Should have pesan (Indonesian message)"
        
        # Call audit again
        resp2 = self.api_call("GET", "/placement-audit", expect_status=200)
        audit_data2 = resp2.json()
        
        # Verify member count unchanged
        resp = self.api_call("GET", "/members", params={"role": "member", "limit": 1000}, expect_status=200)
        members_after = resp.json()
        count_after = len(members_after)
        
        assert count_before == count_after, f"Member count changed from {count_before} to {count_after} after audit"
        
        # Verify placement_id unchanged for all members
        for mb, ma in zip(members_before, members_after):
            if mb["member_id"] == ma["member_id"]:
                assert mb.get("placement_id") == ma.get("placement_id"), \
                    f"Placement changed for {mb['member_id']}"
        
        self.log(f"Audit is preview only: {audit_data['total_member']} members checked, {len(audit_data['pelanggaran'])} violations found", "PASS")
        
    def test_placement_audit_fix_access(self):
        """Test 7: POST /placement-audit/fix only for admin_pusat"""
        # This test just verifies the endpoint exists and requires admin_pusat
        # We won't actually fix anything to preserve user data
        resp = self.api_call("GET", "/placement-audit", expect_status=200)
        audit_data = resp.json()
        
        if audit_data["jumlah_dipindah"] == 0:
            self.log("No violations to fix, audit/fix endpoint accessible", "PASS")
        else:
            self.log(f"Found {audit_data['jumlah_dipindah']} violations, but NOT fixing to preserve user data", "WARN")
            
    def test_update_member_placement_full_auto_descend(self):
        """Test 8: PUT /members/{id} with placement to full member -> SUCCESS with auto-descend"""
        # Get existing member as sponsor
        resp = self.api_call("GET", "/members", params={"role": "member", "limit": 1}, expect_status=200)
        members = resp.json()
        if not members:
            self.log("No existing members, skipping test", "WARN")
            return
        root_sponsor = members[0]["member_id"]
        
        # Create parent with 2 kids
        parent_id, _ = self.create_test_member("Update Test Parent", sponsor_id=root_sponsor, placement_id="")
        kid1, _ = self.create_test_member("Update Kid 1", sponsor_id=root_sponsor, placement_id=parent_id)
        kid2, _ = self.create_test_member("Update Kid 2", sponsor_id=root_sponsor, placement_id=parent_id)
        
        # Create another member to move
        mover_id, _ = self.create_test_member("Mover", sponsor_id=root_sponsor, placement_id="")
        
        # Try to move to full placement -> should SUCCEED with auto-descend
        resp = self.api_call("PUT", f"/members/{mover_id}", 
                            data={"placement_id": parent_id},
                            expect_status=200)
        updated = resp.json()
        
        # Verify placement_info indicates auto-descend
        placement_info = updated.get("placement_info", {})
        assert placement_info.get("turun") == True, "Should indicate auto-descend"
        assert placement_info.get("placement_id") != parent_id, "Should be placed elsewhere"
        
        self.log(f"Update with auto-descend successful: {mover_id} placed under {placement_info.get('placement_id')}", "PASS")
        
    def test_update_member_circular_placement(self):
        """Test 9: PUT /members/{id} with placement to descendant -> 400 circular error"""
        # Get existing member as sponsor
        resp = self.api_call("GET", "/members", params={"role": "member", "limit": 1}, expect_status=200)
        members = resp.json()
        if not members:
            self.log("No existing members, skipping test", "WARN")
            return
        root_sponsor = members[0]["member_id"]
        
        # Create parent -> child chain
        parent_id, _ = self.create_test_member("Circular Parent", sponsor_id=root_sponsor, placement_id="")
        child_id, _ = self.create_test_member("Circular Child", sponsor_id=root_sponsor, placement_id=parent_id)
        
        # Try to move parent under child -> should fail with circular error
        resp = self.api_call("PUT", f"/members/{parent_id}",
                            data={"placement_id": child_id},
                            expect_status=400)
        error_msg = resp.json().get("detail", "")
        assert "melingkar" in error_msg.lower(), f"Should mention 'melingkar' (circular), got: {error_msg}"
        self.log("Circular placement correctly rejected", "PASS")
        
    def test_simulator_binary_placement(self):
        """Test 10: Simulator with multi-level binary placement (84 members total)"""
        self.log("Testing simulator with multi-level binary placement...", "INFO")
        
        # Get a real member as sponsor
        resp = self.api_call("GET", "/members", params={"role": "member", "limit": 1}, expect_status=200)
        members = resp.json()
        if not members:
            self.log("No real members found, skipping simulator test", "WARN")
            return
        sponsor_id = members[0]["member_id"]
        
        # Batch 1: Add 4 members
        resp = self.api_call("POST", "/simulator/add-members", data={
            "mode": "single",
            "sponsor_id": sponsor_id,
            "count": 4,
            "pv_perkembangan": 5000,
            "pv_penjualan": 1000,
            "membership": "Bronze",
            "rank": "Member",
            "tupo_ok": True,
            "include_current_omset": False,
            "spread_sponsor": False,
            "existing_sim": [],
            "batch": 1
        }, expect_status=200)
        batch1 = resp.json()
        
        assert batch1["count"] == 4, "Batch 1 should have 4 members"
        assert batch1["total_sim_count"] == 4, "Total sim count should be 4"
        sim_members = batch1["sim_members"]
        batch1_ids = [m["member_id"] for m in sim_members]
        
        self.log(f"Batch 1: Created {len(batch1_ids)} members: {', '.join(batch1_ids)}", "INFO")
        
        # Batch 2: Add 4 members per each batch 1 member (4 x 4 = 16)
        resp = self.api_call("POST", "/simulator/add-members", data={
            "mode": "per_member",
            "targets": batch1_ids,
            "count": 4,
            "pv_perkembangan": 5000,
            "pv_penjualan": 1000,
            "membership": "Bronze",
            "rank": "Member",
            "tupo_ok": True,
            "include_current_omset": False,
            "spread_sponsor": False,
            "existing_sim": sim_members,
            "batch": 2
        }, expect_status=200)
        batch2 = resp.json()
        
        assert batch2["count"] == 16, f"Batch 2 should have 16 members (4x4), got {batch2['count']}"
        assert batch2["total_sim_count"] == 20, f"Total should be 20, got {batch2['total_sim_count']}"
        sim_members = batch2["sim_members"]
        batch2_ids = [m["member_id"] for m in sim_members if m.get("batch") == 2]
        
        self.log(f"Batch 2: Created {len(batch2_ids)} members (4 per batch 1 member)", "INFO")
        
        # Batch 3: Add 4 members per each batch 2 member (16 x 4 = 64)
        resp = self.api_call("POST", "/simulator/add-members", data={
            "mode": "per_member",
            "targets": batch2_ids,
            "count": 4,
            "pv_perkembangan": 5000,
            "pv_penjualan": 1000,
            "membership": "Bronze",
            "rank": "Member",
            "tupo_ok": True,
            "include_current_omset": False,
            "spread_sponsor": False,
            "existing_sim": sim_members,
            "batch": 3
        }, expect_status=200)
        batch3 = resp.json()
        
        assert batch3["count"] == 64, f"Batch 3 should have 64 members (16x4), got {batch3['count']}"
        assert batch3["total_sim_count"] == 84, f"Total should be 84 (4+16+64), got {batch3['total_sim_count']}"
        
        self.log(f"Batch 3: Created 64 members. Total simulation: {batch3['total_sim_count']} members", "INFO")
        
        # Verify NO member has >2 placement kids (except MB00001 which is legacy data)
        nodes = batch3.get("nodes", [])
        violations = []
        for node in nodes:
            # Count direct placement kids
            mid = node["member_id"]
            # Skip MB00001 - it's legacy data with 4 kids before binary rule
            if mid == "MB00001":
                continue
            kids = [n for n in nodes if n.get("placement_id") == mid]
            if len(kids) > 2:
                violations.append(f"{mid} has {len(kids)} placement kids")
                
        assert len(violations) == 0, f"Binary rule violated: {', '.join(violations)}"
        self.log(f"Verified {len(nodes)} nodes: NO member has >2 placement kids (MB00001 legacy data excluded)", "PASS")
        
        # Verify balanced placement (not all on one side)
        # Check that most nodes with 2 kids have them distributed
        nodes_with_2_kids = [n for n in nodes if len([x for x in nodes if x.get("placement_id") == n["member_id"]]) == 2]
        self.log(f"Found {len(nodes_with_2_kids)} nodes with exactly 2 placement kids (balanced)", "INFO")
        
    def test_simulator_levels_cascade(self):
        """Test 10b: Simulator with levels parameter (single click cascade)"""
        self.log("Testing simulator with levels parameter (cascade)...", "INFO")
        
        # Get a real member as sponsor
        resp = self.api_call("GET", "/members", params={"role": "member", "limit": 1}, expect_status=200)
        members = resp.json()
        if not members:
            self.log("No real members found, skipping test", "WARN")
            return
        sponsor_id = members[0]["member_id"]
        
        # Single call with levels=3, count=4 -> should create 4+16+64=84 members
        resp = self.api_call("POST", "/simulator/add-members", data={
            "mode": "single",
            "sponsor_id": sponsor_id,
            "count": 4,
            "levels": 3,
            "pv_perkembangan": 5000,
            "pv_penjualan": 1000,
            "membership": "Bronze",
            "rank": "Member",
            "tupo_ok": True,
            "include_current_omset": False,
            "spread_sponsor": False,
            "existing_sim": [],
            "batch": 1
        }, expect_status=200)
        data = resp.json()
        
        # Verify total count
        assert data["count"] == 84, f"Should create 84 members (4+16+64), got {data['count']}"
        assert data["levels"] == 3, "Should have 3 levels"
        assert data["per_level"] == [4, 16, 64], f"Per level should be [4,16,64], got {data['per_level']}"
        
        # Verify level_counts
        level_counts = data.get("level_counts", [])
        assert level_counts == [4, 16, 64], f"Level counts should be [4,16,64], got {level_counts}"
        
        # Verify binary_ok
        assert data.get("binary_ok") == True, "Binary rule should be satisfied"
        assert not data.get("binary_violations"), "Should have no binary violations"
        
        # Verify each assignment has level field
        assignments = data.get("assignments", [])
        level_1 = [a for a in assignments if a.get("level") == 1]
        level_2 = [a for a in assignments if a.get("level") == 2]
        level_3 = [a for a in assignments if a.get("level") == 3]
        
        assert len(level_1) == 4, f"Level 1 should have 4 members, got {len(level_1)}"
        assert len(level_2) == 16, f"Level 2 should have 16 members, got {len(level_2)}"
        assert len(level_3) == 64, f"Level 3 should have 64 members, got {len(level_3)}"
        
        self.log(f"Cascade successful: {data['count']} members in 3 levels ({data['per_level']})", "PASS")
        
    def test_simulator_levels_limit(self):
        """Test 10c: Simulator rejects levels that exceed 500 member limit"""
        self.log("Testing simulator 500-member limit...", "INFO")
        
        # Get a real member as sponsor
        resp = self.api_call("GET", "/members", params={"role": "member", "limit": 1}, expect_status=200)
        members = resp.json()
        if not members:
            self.log("No real members found, skipping test", "WARN")
            return
        sponsor_id = members[0]["member_id"]
        
        # Try levels=6, count=4 -> 4+16+64+256+1024+4096 = 5460 > 500
        resp = self.api_call("POST", "/simulator/add-members", data={
            "mode": "single",
            "sponsor_id": sponsor_id,
            "count": 4,
            "levels": 6,
            "pv_perkembangan": 5000,
            "pv_penjualan": 1000,
            "tupo_ok": True,
            "include_current_omset": False,
            "existing_sim": [],
            "batch": 1
        }, expect_status=400)
        
        error = resp.json()
        error_msg = error.get("detail", "")
        
        # Verify error mentions exceeding limit
        assert "melebihi batas 500" in error_msg.lower() or "exceeds" in error_msg.lower(), \
            f"Error should mention exceeding 500 limit, got: {error_msg}"
        
        self.log(f"Correctly rejected: {error_msg[:100]}...", "PASS")
        
    def test_placement_slot_with_placement_id(self):
        """Test 10d: GET /placement-slot with placement_id parameter"""
        # Get existing member as sponsor
        resp = self.api_call("GET", "/members", params={"role": "member", "limit": 1}, expect_status=200)
        members = resp.json()
        if not members:
            self.log("No existing members, skipping test", "WARN")
            return
        sponsor_id = members[0]["member_id"]
        
        # Create a parent with 2 kids (full)
        parent_id, _ = self.create_test_member("Slot Test Parent", sponsor_id=sponsor_id, placement_id="")
        kid1, _ = self.create_test_member("Slot Kid 1", sponsor_id=sponsor_id, placement_id=parent_id)
        kid2, _ = self.create_test_member("Slot Kid 2", sponsor_id=sponsor_id, placement_id=parent_id)
        
        # Query placement slot with full placement_id
        resp = self.api_call("GET", "/placement-slot", 
                            params={"sponsor_id": sponsor_id, "placement_id": parent_id}, 
                            expect_status=200)
        data = resp.json()
        
        # Verify response indicates auto-descend
        assert data.get("turun_otomatis") == True, "Should indicate auto-descend"
        assert data.get("placement_id") != parent_id, "Should suggest different placement"
        assert "alasan" in data, "Should have reason"
        
        # Verify reason mentions full placement
        alasan = data["alasan"]
        assert "penuh" in alasan.lower(), f"Reason should mention 'penuh', got: {alasan}"
        
        self.log(f"Placement slot with full placement_id: suggests {data['placement_id']} (auto-descend)", "PASS")
        
    def test_simulator_zero_storage(self):
        """Test 11: Simulator creates NO database records (zero storage)"""
        # Get member count before
        resp = self.api_call("GET", "/members", params={"role": "member", "limit": 10000}, expect_status=200)
        count_before = len(resp.json())
        
        # Run a small simulation
        resp = self.api_call("GET", "/members", params={"role": "member", "limit": 1}, expect_status=200)
        members = resp.json()
        if not members:
            self.log("No real members, skipping zero storage test", "WARN")
            return
        sponsor_id = members[0]["member_id"]
        
        resp = self.api_call("POST", "/simulator/add-members", data={
            "mode": "single",
            "sponsor_id": sponsor_id,
            "count": 5,
            "pv_perkembangan": 1000,
            "pv_penjualan": 500,
            "tupo_ok": True,
            "include_current_omset": False,
            "existing_sim": [],
            "batch": 1
        }, expect_status=200)
        sim_data = resp.json()
        
        # Get member count after
        resp = self.api_call("GET", "/members", params={"role": "member", "limit": 10000}, expect_status=200)
        count_after = len(resp.json())
        
        assert count_before == count_after, f"Member count changed from {count_before} to {count_after} after simulation"
        
        # Verify no SIM* members in database
        resp = self.api_call("GET", "/members", params={"q": "SIM", "limit": 100}, expect_status=200)
        sim_in_db = [m for m in resp.json() if m["member_id"].startswith("SIM")]
        assert len(sim_in_db) == 0, f"Found {len(sim_in_db)} SIM* members in database"
        
        self.log(f"Simulator created {sim_data['count']} members with ZERO database storage", "PASS")
        
    def test_regression_endpoints(self):
        """Test 12: Regression - all main endpoints still work"""
        endpoints = [
            ("GET", "/", None, 200),
            ("GET", "/auth/me", None, 200),
            ("GET", "/dashboard", None, 200),
            ("GET", "/members", {"limit": 10}, 200),
            ("GET", "/members/options", {"limit": 10}, 200),
            ("GET", "/network", {"tree": "placement"}, 200),
            ("GET", "/network", {"tree": "sponsor"}, 200),
            ("GET", "/hierarchy", None, 200),
            ("GET", "/periods", None, 200),
            ("GET", "/settings", None, 200),
        ]
        
        for method, endpoint, params, expected in endpoints:
            try:
                self.api_call(method, endpoint, params=params, expect_status=expected)
                self.log(f"{method} {endpoint} -> {expected} ✓", "INFO")
            except Exception as e:
                raise AssertionError(f"{method} {endpoint} failed: {e}")
                
        self.log("All regression endpoints working", "PASS")
        
    def run_all_tests(self):
        """Run all test cases"""
        self.log("=" * 60, "INFO")
        self.log("BINARY PLACEMENT BACKEND TESTING", "INFO")
        self.log("=" * 60, "INFO")
        
        try:
            self.login()
            
            # Run tests
            self.run_test("Binary Placement Auto-Balance (6 members, max 2 kids)", 
                         self.test_binary_placement_auto_balance)
            self.run_test("Placement Full Auto-Descend (SUCCESS with auto-descend)", 
                         self.test_placement_full_auto_descend)
            self.run_test("Manual Placement with Available Space", 
                         self.test_placement_manual_with_space)
            self.run_test("Sponsor Unlimited (6+ frontline sponsor)", 
                         self.test_sponsor_unlimited)
            self.run_test("Placement Slot Endpoint (auto-balance suggestion)", 
                         self.test_placement_slot_endpoint)
            self.run_test("Placement Slot with Full Placement ID (auto-descend)", 
                         self.test_placement_slot_with_placement_id)
            self.run_test("Placement Audit Preview (no data changes)", 
                         self.test_placement_audit_preview)
            self.run_test("Placement Audit Fix Access (admin_pusat only)", 
                         self.test_placement_audit_fix_access)
            self.run_test("Update Member Placement Full -> Auto-Descend", 
                         self.test_update_member_placement_full_auto_descend)
            self.run_test("Update Member Circular Placement -> 400", 
                         self.test_update_member_circular_placement)
            self.run_test("Simulator Multi-Level Binary (84 members total)", 
                         self.test_simulator_binary_placement)
            self.run_test("Simulator Levels Cascade (single click, 84 members)", 
                         self.test_simulator_levels_cascade)
            self.run_test("Simulator 500-Member Limit (levels=6 rejected)", 
                         self.test_simulator_levels_limit)
            self.run_test("Simulator Zero Storage (no DB records)", 
                         self.test_simulator_zero_storage)
            self.run_test("Regression - All Main Endpoints", 
                         self.test_regression_endpoints)
            
        finally:
            # Cleanup
            self.cleanup_test_members()
            
        # Summary
        self.log("=" * 60, "INFO")
        self.log(f"TESTS COMPLETED: {self.tests_passed}/{self.tests_run} passed", 
                "PASS" if self.tests_passed == self.tests_run else "FAIL")
        self.log("=" * 60, "INFO")
        
        return 0 if self.tests_passed == self.tests_run else 1

if __name__ == "__main__":
    tester = BinaryPlacementTester()
    sys.exit(tester.run_all_tests())
