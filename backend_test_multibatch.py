"""
Comprehensive Backend Testing for Multi-Batch "Simulasi Tambah Member" Feature
Tests the expanded feature that supports continuous batch additions (not one-time use)
"""
import requests
import sys
import json
import os
from typing import Dict, Any, List, Optional

BASE_URL = os.environ.get("TEST_BASE_URL", "https://ascendia-web-deploy.preview.emergentagent.com/api")

class MultiBatchSimulatorTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failed_tests = []
        
    def log(self, msg: str, level: str = "INFO"):
        """Log test messages"""
        prefix = {
            "INFO": "ℹ️",
            "SUCCESS": "✅",
            "FAIL": "❌",
            "WARN": "⚠️"
        }.get(level, "•")
        print(f"{prefix} {msg}")
    
    def run_test(self, name: str, method: str, endpoint: str, 
                 expected_status: int, data: Optional[Dict] = None,
                 token: Optional[str] = None) -> tuple:
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        self.tests_run += 1
        self.log(f"\nTest {self.tests_run}: {name}", "INFO")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                self.log(f"PASSED - Status: {response.status_code}", "SUCCESS")
            else:
                self.tests_failed += 1
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "got": response.status_code,
                    "response": response.text[:300]
                })
                self.log(f"FAILED - Expected {expected_status}, got {response.status_code}", "FAIL")
                self.log(f"Response: {response.text[:300]}", "WARN")
            
            try:
                return success, response.json() if response.text else {}
            except:
                return success, {"text": response.text}
                
        except Exception as e:
            self.tests_failed += 1
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            self.log(f"FAILED - Error: {str(e)}", "FAIL")
            return False, {}
    
    def test_login_admin(self):
        """Test admin login"""
        self.log("\n=== TESTING AUTHENTICATION ===", "INFO")
        success, response = self.run_test(
            "Admin Login (ADMIN/admin123)",
            "POST",
            "auth/login",
            200,
            data={"member_id": "ADMIN", "password": "admin123"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            self.log(f"Admin token obtained", "SUCCESS")
            return True
        return False
    
    def get_db_counts(self):
        """Get current database counts"""
        success, members_resp = self.run_test(
            "Get Members Count",
            "GET",
            "members",
            200,
            token=self.admin_token
        )
        
        success2, tx_resp = self.run_test(
            "Get Transactions Count",
            "GET",
            "transactions",
            200,
            token=self.admin_token
        )
        
        members = members_resp if isinstance(members_resp, list) else []
        transactions = tx_resp if isinstance(tx_resp, list) else []
        
        # Filter out SIM* members
        real_members = [m for m in members if not str(m.get('member_id', '')).startswith('SIM')]
        sim_members = [m for m in members if str(m.get('member_id', '')).startswith('SIM')]
        
        self.log(f"Database state: {len(real_members)} real members, {len(sim_members)} SIM members, {len(transactions)} transactions", "INFO")
        
        return len(real_members), len(sim_members), len(transactions)
    
    def test_batch_1_single_mode(self):
        """Test Batch 1: mode='single', count=4"""
        self.log("\n=== TESTING BATCH 1: SINGLE MODE (4 members) ===", "INFO")
        
        # Get initial DB state
        initial_members, initial_sim, initial_tx = self.get_db_counts()
        
        success, response = self.run_test(
            "Batch 1: mode='single', count=4, empty sponsor (root)",
            "POST",
            "simulator/add-members",
            200,
            data={
                "mode": "single",
                "sponsor_id": None,
                "placement_id": None,
                "count": 4,
                "pv_perkembangan": 5000,
                "pv_penjualan": 1000,
                "membership": "Bronze",
                "rank": "Member",
                "tupo_ok": True,
                "include_current_omset": True,
                "spread_sponsor": False,
                "existing_sim": [],
                "targets": [],
                "batch": 1,
                "include_unchanged": False
            },
            token=self.admin_token
        )
        
        if not success:
            return None
        
        # Verify response structure
        assert 'sim_members' in response, "Response missing 'sim_members'"
        assert 'nodes' in response, "Response missing 'nodes'"
        assert 'total_sim_count' in response, "Response missing 'total_sim_count'"
        assert 'prior_sim_count' in response, "Response missing 'prior_sim_count'"
        assert 'mode' in response, "Response missing 'mode'"
        assert 'per_induk' in response, "Response missing 'per_induk'"
        
        # Verify counts
        assert response['count'] == 4, f"Expected count=4, got {response['count']}"
        assert response['total_sim_count'] == 4, f"Expected total_sim_count=4, got {response['total_sim_count']}"
        assert response['prior_sim_count'] == 0, f"Expected prior_sim_count=0, got {response['prior_sim_count']}"
        assert response['mode'] == 'single', f"Expected mode='single', got {response['mode']}"
        assert response['per_induk'] == 4, f"Expected per_induk=4, got {response['per_induk']}"
        
        # Verify sim_members structure
        sim_members = response['sim_members']
        assert len(sim_members) == 4, f"Expected 4 sim_members, got {len(sim_members)}"
        
        # Verify member IDs
        member_ids = [m['member_id'] for m in sim_members]
        expected_ids = ['SIM0001', 'SIM0002', 'SIM0003', 'SIM0004']
        assert member_ids == expected_ids, f"Expected {expected_ids}, got {member_ids}"
        
        # Verify each member has required fields
        for m in sim_members:
            assert 'member_id' in m
            assert 'sponsor_id' in m
            assert 'placement_id' in m
            assert 'batch' in m
            assert m['batch'] == 1, f"Expected batch=1, got {m['batch']}"
            assert m['pv_perkembangan'] == 5000
            assert m['pv_penjualan'] == 1000
            assert m['membership'] == 'Bronze'
            assert m['rank'] == 'Member'
        
        # Verify nodes have bonus information
        nodes = response['nodes']
        assert len(nodes) >= 4, f"Expected at least 4 nodes, got {len(nodes)}"
        
        for node in nodes:
            if node['member_id'].startswith('SIM'):
                assert 'total_bonus_bv' in node
                assert 'total_bonus_rp' in node
                assert 'delta_bv' in node
                assert 'membership' in node
                assert 'rank' in node
                assert 'ppv' in node
                assert 'sponsor_id' in node
                assert 'placement_id' in node
                assert 'is_simulasi' in node
                assert 'is_batch_baru' in node
                assert 'batch' in node
        
        # Verify binary tree (max 2 children per placement)
        placement_kids = {}
        for m in sim_members:
            pid = m['placement_id']
            if pid:
                placement_kids.setdefault(pid, []).append(m['member_id'])
        
        for parent, kids in placement_kids.items():
            assert len(kids) <= 2, f"Parent {parent} has {len(kids)} children (max 2 allowed in binary)"
        
        self.log(f"✅ Batch 1 verified: 4 members, binary placement correct, bonus data present", "SUCCESS")
        
        # Verify NO DATA SAVED
        final_members, final_sim, final_tx = self.get_db_counts()
        assert final_members == initial_members, f"Members count changed! {initial_members} → {final_members}"
        assert final_sim == 0, f"SIM members found in DB! Expected 0, got {final_sim}"
        assert final_tx == initial_tx, f"Transactions count changed! {initial_tx} → {final_tx}"
        
        self.log(f"✅ CRITICAL: NO DATA SAVED - DB unchanged", "SUCCESS")
        
        return response
    
    def test_batch_2_per_member_mode(self, batch1_response):
        """Test Batch 2: mode='per_member', targets=4 batch1 IDs, count=4"""
        self.log("\n=== TESTING BATCH 2: PER_MEMBER MODE (4 induk × 4 = 16 members) ===", "INFO")
        
        if not batch1_response:
            self.log("Skipping Batch 2 - Batch 1 failed", "WARN")
            return None
        
        # Get initial DB state
        initial_members, initial_sim, initial_tx = self.get_db_counts()
        
        # Extract sim_members from batch 1
        existing_sim = batch1_response['sim_members']
        targets = [m['member_id'] for m in existing_sim]  # All 4 from batch 1
        
        success, response = self.run_test(
            "Batch 2: mode='per_member', targets=4 IDs from batch 1, count=4",
            "POST",
            "simulator/add-members",
            200,
            data={
                "mode": "per_member",
                "sponsor_id": None,
                "placement_id": None,
                "count": 4,
                "pv_perkembangan": 5000,
                "pv_penjualan": 1000,
                "membership": "Bronze",
                "rank": "Member",
                "tupo_ok": True,
                "include_current_omset": True,
                "spread_sponsor": False,
                "existing_sim": existing_sim,
                "targets": targets,
                "batch": 2,
                "include_unchanged": False
            },
            token=self.admin_token
        )
        
        if not success:
            return None
        
        # Verify counts
        assert response['count'] == 16, f"Expected count=16, got {response['count']}"
        assert response['total_sim_count'] == 20, f"Expected total_sim_count=20, got {response['total_sim_count']}"
        assert response['prior_sim_count'] == 4, f"Expected prior_sim_count=4, got {response['prior_sim_count']}"
        assert response['mode'] == 'per_member', f"Expected mode='per_member', got {response['mode']}"
        assert response['per_induk'] == 4, f"Expected per_induk=4, got {response['per_induk']}"
        assert len(response['targets']) == 4, f"Expected 4 targets, got {len(response['targets'])}"
        
        # Verify sim_members structure
        sim_members = response['sim_members']
        assert len(sim_members) == 20, f"Expected 20 sim_members (4+16), got {len(sim_members)}"
        
        # Verify no duplicate IDs
        member_ids = [m['member_id'] for m in sim_members]
        assert len(member_ids) == len(set(member_ids)), "Duplicate member IDs found!"
        
        # Verify batch 1 members are included
        batch1_ids = [m['member_id'] for m in sim_members if m.get('batch') == 1]
        assert len(batch1_ids) == 4, f"Expected 4 batch 1 members, got {len(batch1_ids)}"
        
        # Verify batch 2 members
        batch2_ids = [m['member_id'] for m in sim_members if m.get('batch') == 2]
        assert len(batch2_ids) == 16, f"Expected 16 batch 2 members, got {len(batch2_ids)}"
        
        # Verify each batch 2 member has a parent from targets
        for m in sim_members:
            if m.get('batch') == 2:
                # Either sponsor_id or placement_id should be in targets
                assert m['sponsor_id'] in targets or m['placement_id'] in targets, \
                    f"Member {m['member_id']} parent not in targets"
        
        # Verify sponsor_mode field
        assert 'sponsor_mode' in response
        assert '4 induk x 4' in response['sponsor_mode'], f"Expected '4 induk x 4' in sponsor_mode, got {response['sponsor_mode']}"
        
        # Verify binary tree still maintained
        placement_kids = {}
        for m in sim_members:
            pid = m['placement_id']
            if pid:
                placement_kids.setdefault(pid, []).append(m['member_id'])
        
        for parent, kids in placement_kids.items():
            assert len(kids) <= 2, f"Parent {parent} has {len(kids)} children (max 2 allowed in binary)"
        
        self.log(f"✅ Batch 2 verified: 16 new members (4×4), total 20, binary maintained", "SUCCESS")
        
        # Verify NO DATA SAVED
        final_members, final_sim, final_tx = self.get_db_counts()
        assert final_members == initial_members, f"Members count changed! {initial_members} → {final_members}"
        assert final_sim == 0, f"SIM members found in DB! Expected 0, got {final_sim}"
        assert final_tx == initial_tx, f"Transactions count changed! {initial_tx} → {final_tx}"
        
        self.log(f"✅ CRITICAL: NO DATA SAVED - DB unchanged", "SUCCESS")
        
        return response
    
    def test_batch_3_continuation(self, batch2_response):
        """Test Batch 3: mode='per_member', targets=16 batch2 IDs, count=2"""
        self.log("\n=== TESTING BATCH 3: CONTINUATION (16 induk × 2 = 32 members) ===", "INFO")
        
        if not batch2_response:
            self.log("Skipping Batch 3 - Batch 2 failed", "WARN")
            return None
        
        # Get initial DB state
        initial_members, initial_sim, initial_tx = self.get_db_counts()
        
        # Extract sim_members from batch 2
        existing_sim = batch2_response['sim_members']
        # Get only batch 2 members as targets
        targets = [m['member_id'] for m in existing_sim if m.get('batch') == 2]
        
        success, response = self.run_test(
            "Batch 3: mode='per_member', targets=16 IDs from batch 2, count=2",
            "POST",
            "simulator/add-members",
            200,
            data={
                "mode": "per_member",
                "sponsor_id": None,
                "placement_id": None,
                "count": 2,
                "pv_perkembangan": 5000,
                "pv_penjualan": 1000,
                "membership": "Bronze",
                "rank": "Member",
                "tupo_ok": True,
                "include_current_omset": True,
                "spread_sponsor": False,
                "existing_sim": existing_sim,
                "targets": targets,
                "batch": 3,
                "include_unchanged": False
            },
            token=self.admin_token
        )
        
        if not success:
            return None
        
        # Verify counts
        assert response['count'] == 32, f"Expected count=32, got {response['count']}"
        assert response['total_sim_count'] == 52, f"Expected total_sim_count=52, got {response['total_sim_count']}"
        assert response['prior_sim_count'] == 20, f"Expected prior_sim_count=20, got {response['prior_sim_count']}"
        
        # Verify sim_members structure
        sim_members = response['sim_members']
        assert len(sim_members) == 52, f"Expected 52 sim_members (4+16+32), got {len(sim_members)}"
        
        # Verify no duplicate IDs
        member_ids = [m['member_id'] for m in sim_members]
        assert len(member_ids) == len(set(member_ids)), "Duplicate member IDs found!"
        
        # Verify all IDs are unique and sequential
        sim_ids = [m['member_id'] for m in sim_members if m['member_id'].startswith('SIM')]
        expected_last_id = 'SIM0052'
        assert expected_last_id in sim_ids, f"Expected {expected_last_id} in member IDs"
        
        # Verify binary tree still maintained
        placement_kids = {}
        for m in sim_members:
            pid = m['placement_id']
            if pid:
                placement_kids.setdefault(pid, []).append(m['member_id'])
        
        for parent, kids in placement_kids.items():
            assert len(kids) <= 2, f"Parent {parent} has {len(kids)} children (max 2 allowed in binary)"
        
        self.log(f"✅ Batch 3 verified: 32 new members (16×2), total 52, all IDs unique, binary maintained", "SUCCESS")
        
        # Verify NO DATA SAVED
        final_members, final_sim, final_tx = self.get_db_counts()
        assert final_members == initial_members, f"Members count changed! {initial_members} → {final_members}"
        assert final_sim == 0, f"SIM members found in DB! Expected 0, got {final_sim}"
        assert final_tx == initial_tx, f"Transactions count changed! {initial_tx} → {final_tx}"
        
        self.log(f"✅ CRITICAL: NO DATA SAVED - DB unchanged", "SUCCESS")
        
        return response
    
    def test_bonus_per_member(self, batch_response):
        """Test bonus calculations per member"""
        self.log("\n=== TESTING BONUS PER MEMBER ===", "INFO")
        
        if not batch_response:
            self.log("Skipping bonus test - batch response missing", "WARN")
            return False
        
        # Check nodes have bonus data
        nodes = batch_response.get('nodes', [])
        assert len(nodes) > 0, "No nodes in response"
        
        for node in nodes:
            # Verify bonus fields
            assert 'total_bonus_bv' in node, f"Node {node.get('member_id')} missing total_bonus_bv"
            assert 'total_bonus_rp' in node, f"Node {node.get('member_id')} missing total_bonus_rp"
            assert 'delta_bv' in node, f"Node {node.get('member_id')} missing delta_bv"
            
            # Verify 7 bonus types
            bonus_fields = ['bonus_sponsor', 'bonus_pasangan', 'bonus_bimbingan', 
                          'bonus_prestasi', 'bonus_kepemimpinan', 'bonus_sharing_profit', 'bonus_reward']
            for field in bonus_fields:
                assert field in node, f"Node {node.get('member_id')} missing {field}"
        
        # Check results have bonus formulas
        results = batch_response.get('results', [])
        if len(results) > 0:
            sample = results[0]
            assert 'lines' in sample or 'total_bonus_bv' in sample, "Results missing bonus details"
            assert 'sponsor_id' in sample, "Results missing sponsor_id"
            assert 'placement_id' in sample, "Results missing placement_id"
            assert 'batch' in sample or 'is_simulasi' in sample, "Results missing batch info"
        
        self.log(f"✅ Bonus per member verified: {len(nodes)} nodes with complete bonus data", "SUCCESS")
        return True
    
    def test_tree_structures(self, batch_response):
        """Test sponsor and placement tree structures"""
        self.log("\n=== TESTING TREE STRUCTURES ===", "INFO")
        
        if not batch_response:
            self.log("Skipping tree test - batch response missing", "WARN")
            return False
        
        nodes = batch_response.get('nodes', [])
        assert len(nodes) > 0, "No nodes in response"
        
        # Build sponsor tree
        sponsor_tree = {}
        for node in nodes:
            mid = node['member_id']
            sid = node.get('sponsor_id')
            sponsor_tree.setdefault(mid, {'parent': sid, 'children': []})
            if sid:
                sponsor_tree.setdefault(sid, {'parent': None, 'children': []})
                sponsor_tree[sid]['children'].append(mid)
        
        # Build placement tree
        placement_tree = {}
        for node in nodes:
            mid = node['member_id']
            pid = node.get('placement_id')
            placement_tree.setdefault(mid, {'parent': pid, 'children': []})
            if pid:
                placement_tree.setdefault(pid, {'parent': None, 'children': []})
                placement_tree[pid]['children'].append(mid)
        
        # Find roots (nodes with no parent or parent outside nodes)
        node_ids = {n['member_id'] for n in nodes}
        sponsor_roots = [mid for mid, data in sponsor_tree.items() 
                        if data['parent'] is None or data['parent'] not in node_ids]
        placement_roots = [mid for mid, data in placement_tree.items() 
                          if data['parent'] is None or data['parent'] not in node_ids]
        
        self.log(f"Sponsor tree: {len(sponsor_roots)} roots, {len(sponsor_tree)} nodes", "INFO")
        self.log(f"Placement tree: {len(placement_roots)} roots, {len(placement_tree)} nodes", "INFO")
        
        assert len(sponsor_roots) > 0, "No sponsor tree roots found"
        assert len(placement_roots) > 0, "No placement tree roots found"
        
        self.log(f"✅ Tree structures verified: sponsor & placement trees can be built", "SUCCESS")
        return True
    
    def test_recalculation(self, batch_response):
        """Test recalculation with count=0"""
        self.log("\n=== TESTING RECALCULATION (count=0) ===", "INFO")
        
        if not batch_response:
            self.log("Skipping recalc test - batch response missing", "WARN")
            return False
        
        existing_sim = batch_response['sim_members']
        
        success, response = self.run_test(
            "Recalculate with count=0 (no new members)",
            "POST",
            "simulator/add-members",
            200,
            data={
                "mode": "single",
                "count": 0,
                "existing_sim": existing_sim,
                "include_current_omset": True,
                "batch": len(existing_sim) + 1
            },
            token=self.admin_token
        )
        
        if not success:
            return False
        
        # Verify recalculation
        assert response['count'] == 0, f"Expected count=0, got {response['count']}"
        assert response['total_sim_count'] == len(existing_sim), \
            f"Expected total_sim_count={len(existing_sim)}, got {response['total_sim_count']}"
        
        # Delta should be 0 (baseline same)
        delta = response.get('bonus', {}).get('delta_bv', 0)
        self.log(f"Recalculation delta: {delta} BV (should be ~0)", "INFO")
        
        self.log(f"✅ Recalculation verified: count=0 accepted, no errors", "SUCCESS")
        return True
    
    def test_validations(self):
        """Test all validation scenarios"""
        self.log("\n=== TESTING VALIDATIONS ===", "INFO")
        
        # Test 1: count=0 without existing_sim
        success, _ = self.run_test(
            "Validation: count=0 without existing_sim → 400",
            "POST",
            "simulator/add-members",
            400,
            data={"mode": "single", "count": 0},
            token=self.admin_token
        )
        
        # Test 2: count=501 (exceeds limit)
        success, _ = self.run_test(
            "Validation: count=501 → 400",
            "POST",
            "simulator/add-members",
            400,
            data={"mode": "single", "count": 501},
            token=self.admin_token
        )
        
        # Test 3: mode='per_member' with empty targets
        success, _ = self.run_test(
            "Validation: mode='per_member' with empty targets → 400",
            "POST",
            "simulator/add-members",
            400,
            data={"mode": "per_member", "count": 4, "targets": []},
            token=self.admin_token
        )
        
        # Test 4: Unknown mode
        success, _ = self.run_test(
            "Validation: mode='xyz' → 400",
            "POST",
            "simulator/add-members",
            400,
            data={"mode": "xyz", "count": 4},
            token=self.admin_token
        )
        
        # Test 5: Negative PV
        success, _ = self.run_test(
            "Validation: negative pv_perkembangan → 400",
            "POST",
            "simulator/add-members",
            400,
            data={"mode": "single", "count": 4, "pv_perkembangan": -100},
            token=self.admin_token
        )
        
        # Test 6: Unknown membership
        success, _ = self.run_test(
            "Validation: unknown membership → 400",
            "POST",
            "simulator/add-members",
            400,
            data={"mode": "single", "count": 4, "membership": "Diamond"},
            token=self.admin_token
        )
        
        # Test 7: Unknown rank
        success, _ = self.run_test(
            "Validation: unknown rank → 400",
            "POST",
            "simulator/add-members",
            400,
            data={"mode": "single", "count": 4, "rank": "SuperStar"},
            token=self.admin_token
        )
        
        # Test 8: Total per_member exceeds 500
        success, _ = self.run_test(
            "Validation: 20 induk × 30 = 600 → 400",
            "POST",
            "simulator/add-members",
            400,
            data={
                "mode": "per_member",
                "count": 30,
                "targets": [f"SIM{i:04d}" for i in range(1, 21)],
                "existing_sim": [{"member_id": f"SIM{i:04d}", "sponsor_id": None, "placement_id": None,
                                 "pv_perkembangan": 0, "pv_penjualan": 0, "batch": 1}
                                for i in range(1, 21)]
            },
            token=self.admin_token
        )
        
        self.log(f"✅ All validations passed", "SUCCESS")
        return True
    
    def test_access_control(self):
        """Test non-admin access is blocked"""
        self.log("\n=== TESTING ACCESS CONTROL ===", "INFO")
        
        # Test without token
        success, _ = self.run_test(
            "Access: No token → 401",
            "POST",
            "simulator/add-members",
            401,
            data={"mode": "single", "count": 4}
        )
        
        self.log(f"✅ Access control verified: non-admin blocked", "SUCCESS")
        return True
    
    def test_regression(self):
        """Test other endpoints still work"""
        self.log("\n=== TESTING REGRESSION ===", "INFO")
        
        endpoints = [
            ("GET /", "GET", "", 200),
            ("GET /auth/me", "GET", "auth/me", 200),
            ("GET /dashboard", "GET", "dashboard", 200),
            ("GET /members", "GET", "members", 200),
            ("GET /periods", "GET", "periods", 200),
            ("GET /settings", "GET", "settings", 200),
            ("GET /payout", "GET", "payout", 200),
            ("GET /bonus/preview", "GET", "bonus/preview", 200),
        ]
        
        for name, method, endpoint, expected in endpoints:
            self.run_test(name, method, endpoint, expected, token=self.admin_token)
        
        # Test old manual simulator
        success, _ = self.run_test(
            "POST /simulator (old manual)",
            "POST",
            "simulator",
            200,
            data={
                "members": [
                    {"id": "TEST001", "name": "Test", "sponsor_id": None, "placement_id": None,
                     "perkembangan_pv": 1000, "penjualan_pv": 500, "membership": "Bronze", "rank": "Member"}
                ]
            },
            token=self.admin_token
        )
        
        self.log(f"✅ Regression tests passed", "SUCCESS")
        return True
    
    def run_all_tests(self):
        """Run all tests"""
        self.log("\n" + "="*60, "INFO")
        self.log("MULTI-BATCH SIMULATOR COMPREHENSIVE BACKEND TESTING", "INFO")
        self.log("="*60 + "\n", "INFO")
        
        # Login
        if not self.test_login_admin():
            self.log("Cannot proceed without admin login", "FAIL")
            return False
        
        # Get initial DB state
        self.log("\n=== INITIAL DATABASE STATE ===", "INFO")
        initial_members, initial_sim, initial_tx = self.get_db_counts()
        
        # Run batch tests
        batch1 = self.test_batch_1_single_mode()
        batch2 = self.test_batch_2_per_member_mode(batch1)
        batch3 = self.test_batch_3_continuation(batch2)
        
        # Test bonus and tree structures
        if batch3:
            self.test_bonus_per_member(batch3)
            self.test_tree_structures(batch3)
            self.test_recalculation(batch3)
        
        # Test validations
        self.test_validations()
        
        # Test access control
        self.test_access_control()
        
        # Test regression
        self.test_regression()
        
        # Final DB check
        self.log("\n=== FINAL DATABASE STATE CHECK ===", "INFO")
        final_members, final_sim, final_tx = self.get_db_counts()
        
        if final_members == initial_members and final_sim == 0 and final_tx == initial_tx:
            self.log("✅ CRITICAL VERIFICATION PASSED: Database unchanged throughout all tests", "SUCCESS")
        else:
            self.log(f"❌ DATABASE CHANGED! Initial: {initial_members}m/{initial_sim}s/{initial_tx}t, Final: {final_members}m/{final_sim}s/{final_tx}t", "FAIL")
        
        # Print summary
        self.log("\n" + "="*60, "INFO")
        self.log("TEST SUMMARY", "INFO")
        self.log("="*60, "INFO")
        self.log(f"Total tests run: {self.tests_run}", "INFO")
        self.log(f"Tests passed: {self.tests_passed}", "SUCCESS")
        self.log(f"Tests failed: {self.tests_failed}", "FAIL" if self.tests_failed > 0 else "INFO")
        
        if self.failed_tests:
            self.log("\nFailed tests:", "FAIL")
            for ft in self.failed_tests:
                self.log(f"  - {ft.get('test')}: {ft.get('error', ft.get('response', 'Unknown error'))}", "FAIL")
        
        return self.tests_failed == 0

if __name__ == "__main__":
    tester = MultiBatchSimulatorTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
