"""VYRO Backend API regression tests.

Covers: auth (signup/login/me), vehicle, reports (create/list/vote),
leaderboard, route AI suggestion (with bridge warning for trucks/campers).
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://vyro-fleet.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

EXISTING_EMAIL = "driver1@vyro.app"
EXISTING_PASSWORD = "secret123"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def existing_login(session):
    # Make sure existing user can login (or signup if not present)
    r = session.post(f"{API}/auth/login", json={"email": EXISTING_EMAIL, "password": EXISTING_PASSWORD})
    if r.status_code != 200:
        # Try to create
        session.post(f"{API}/auth/signup", json={
            "email": EXISTING_EMAIL, "password": EXISTING_PASSWORD, "username": "NightRider"
        })
        r = session.post(f"{API}/auth/login", json={"email": EXISTING_EMAIL, "password": EXISTING_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.text}"
    data = r.json()
    return data["token"], data["user"]


@pytest.fixture(scope="session")
def fresh_user(session):
    """Fresh signup user used for vehicle/report mutations."""
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_{suffix}@vyro.app"
    pw = "secret123"
    uname = f"TEST_{suffix}"
    r = session.post(f"{API}/auth/signup", json={"email": email, "password": pw, "username": uname})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["token"], "user": data["user"], "email": email, "password": pw}


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------------- Health ----------------------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        body = r.json()
        assert body.get("service") == "VYRO"
        assert body.get("status") == "ok"


# ---------------------- Auth ----------------------
class TestAuth:
    def test_signup_new_user_returns_token_and_public_user(self, session):
        suffix = uuid.uuid4().hex[:8]
        email = f"TEST_su_{suffix}@vyro.app"
        r = session.post(f"{API}/auth/signup", json={
            "email": email, "password": "secret123", "username": f"TEST_{suffix}"
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body and isinstance(body["token"], str)
        u = body["user"]
        # No leakage
        assert "_id" not in u
        assert "password_hash" not in u
        assert u["email"] == email.lower()
        assert u["xp"] == 0
        assert u["level"] == 1
        assert u["trust_score"] == 50
        assert "rookie" in u["badges"]
        assert u["vehicle"]["type"] == "car"

    def test_signup_duplicate_email_400(self, session, existing_login):
        r = session.post(f"{API}/auth/signup", json={
            "email": EXISTING_EMAIL, "password": "secret123", "username": "Dup"
        })
        assert r.status_code == 400

    def test_login_success(self, session, existing_login):
        token, user = existing_login
        assert user["email"] == EXISTING_EMAIL
        assert "password_hash" not in user

    def test_login_invalid_password_401(self, session):
        r = session.post(f"{API}/auth/login", json={"email": EXISTING_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_with_bearer_token(self, session, existing_login):
        token, _ = existing_login
        r = session.get(f"{API}/auth/me", headers=auth_headers(token))
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == EXISTING_EMAIL
        assert "password_hash" not in u

    def test_me_without_token_401(self, session):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)

    def test_me_invalid_token_401(self, session):
        r = session.get(f"{API}/auth/me", headers=auth_headers("garbage.token.value"))
        assert r.status_code == 401


# ---------------------- Vehicle ----------------------
class TestVehicle:
    def test_update_vehicle_truck_persists(self, session, fresh_user):
        token = fresh_user["token"]
        v = {
            "type": "truck",
            "height_m": 3.8,
            "width_m": 2.4,
            "length_m": 8.0,
            "weight_kg": 7500,
            "driving_mode": "safe",
        }
        r = session.put(f"{API}/vehicle", json=v, headers=auth_headers(token))
        assert r.status_code == 200, r.text
        assert r.json()["vehicle"]["type"] == "truck"
        # Verify via GET /me
        me = session.get(f"{API}/auth/me", headers=auth_headers(token)).json()
        assert me["vehicle"]["type"] == "truck"
        assert me["vehicle"]["driving_mode"] == "safe"
        assert abs(me["vehicle"]["height_m"] - 3.8) < 1e-6


# ---------------------- Reports ----------------------
class TestReports:
    @pytest.fixture(scope="class")
    def created_report(self, session, fresh_user):
        token = fresh_user["token"]
        r = session.post(f"{API}/reports", json={
            "type": "hazard", "lat": 40.7128, "lng": -74.006, "note": "TEST debris"
        }, headers=auth_headers(token))
        assert r.status_code == 200, r.text
        body = r.json()
        return body, token

    def test_create_report_returns_ai_score_reason_xp(self, created_report, fresh_user, session):
        body, _ = created_report
        assert body["ok"] is True
        rep = body["report"]
        assert "ai_score" in rep and isinstance(rep["ai_score"], int)
        assert 0 <= rep["ai_score"] <= 100
        assert "ai_reason" in rep
        assert body["xp_gained"] == 10
        assert "_id" not in rep
        # Verify XP was applied to the user
        me = session.get(f"{API}/auth/me", headers=auth_headers(fresh_user["token"])).json()
        assert me["xp"] >= 10

    def test_list_reports_excludes_id_and_contains_created(self, session, created_report):
        body, _ = created_report
        rid = body["report"]["id"]
        r = session.get(f"{API}/reports")
        assert r.status_code == 200
        items = r.json()["reports"]
        assert isinstance(items, list)
        for item in items:
            assert "_id" not in item
        assert any(it["id"] == rid for it in items), "Created report not present in list"

    def test_vote_confirm_increments_and_changes_trust(self, session, created_report, existing_login):
        body, reporter_token = created_report
        rid = body["report"]["id"]
        voter_token, voter_user = existing_login

        # Get reporter trust before
        # We do this by reading reports list and finding fields
        before_voter = session.get(f"{API}/auth/me", headers=auth_headers(voter_token)).json()
        before_voter_xp = before_voter["xp"]

        r = session.post(f"{API}/reports/vote", json={"report_id": rid, "confirm": True},
                         headers=auth_headers(voter_token))
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True

        # confirm count increased
        items = session.get(f"{API}/reports").json()["reports"]
        rep = next(it for it in items if it["id"] == rid)
        assert rep["confirms"] >= 1

        # voter XP increased by 2
        after_voter = session.get(f"{API}/auth/me", headers=auth_headers(voter_token)).json()
        assert after_voter["xp"] - before_voter_xp == 2

    def test_vote_deny_decrements_reporter_trust(self, session, created_report, existing_login):
        body, reporter_token = created_report
        rid = body["report"]["id"]
        voter_token, _ = existing_login

        before_reporter = session.get(f"{API}/auth/me", headers=auth_headers(reporter_token)).json()
        before_trust = before_reporter["trust_score"]

        r = session.post(f"{API}/reports/vote", json={"report_id": rid, "confirm": False},
                         headers=auth_headers(voter_token))
        assert r.status_code == 200

        after_reporter = session.get(f"{API}/auth/me", headers=auth_headers(reporter_token)).json()
        assert after_reporter["trust_score"] == before_trust - 1

    def test_vote_unknown_report_404(self, session, existing_login):
        token, _ = existing_login
        r = session.post(f"{API}/reports/vote", json={"report_id": "nonexistent", "confirm": True},
                         headers=auth_headers(token))
        assert r.status_code == 404


# ---------------------- Leaderboard ----------------------
class TestLeaderboard:
    def test_leaderboard_sorted_no_sensitive_fields(self, session):
        r = session.get(f"{API}/leaderboard")
        assert r.status_code == 200
        items = r.json()["leaderboard"]
        assert isinstance(items, list)
        for u in items:
            assert "_id" not in u
            assert "password_hash" not in u
            assert "email" not in u
            assert "xp" in u and "username" in u
        # sorted desc by xp
        xps = [u["xp"] for u in items]
        assert xps == sorted(xps, reverse=True)


# ---------------------- Route AI Suggest ----------------------
class TestRoute:
    def test_route_suggest_default_car(self, session, existing_login):
        token, _ = existing_login
        r = session.post(f"{API}/route/suggest",
                         json={"origin": "Times Square", "destination": "JFK Airport"},
                         headers=auth_headers(token))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        sug = body["suggestion"]
        assert "eta_minutes" in sug
        assert "distance_km" in sug
        assert "tips" in sug and isinstance(sug["tips"], list)
        assert "warnings" in sug and isinstance(sug["warnings"], list)

    def test_route_suggest_truck_includes_warnings(self, session, fresh_user):
        token = fresh_user["token"]
        # set vehicle to truck
        truck = {"type": "truck", "height_m": 3.9, "width_m": 2.5, "length_m": 9.0,
                 "weight_kg": 8000, "driving_mode": "safe"}
        session.put(f"{API}/vehicle", json=truck, headers=auth_headers(token))

        r = session.post(f"{API}/route/suggest",
                         json={"origin": "Warehouse A", "destination": "Depot B"},
                         headers=auth_headers(token))
        assert r.status_code == 200, r.text
        sug = r.json()["suggestion"]
        warns = sug.get("warnings", [])
        # At least one warning expected for trucks (either AI or fallback bridge warning)
        assert len(warns) >= 1, f"Expected bridge/clearance warning for truck, got: {warns}"
