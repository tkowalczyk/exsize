from exsize.database import get_db
from exsize.models import User


def _register_and_login(client, email="parent@example.com", password="mypassword", role="parent"):
    client.post("/api/auth/register", json={
        "email": email, "password": password, "role": role,
    })
    resp = client.post("/api/auth/login", json={
        "email": email, "password": password,
    })
    return resp.json()["access_token"]


def _setup_family_with_child(client, parent_email="parent@example.com", child_email="child@example.com"):
    parent_token = _register_and_login(client, parent_email, role="parent")
    child_token = _register_and_login(client, child_email, role="child")
    resp = client.post("/api/family", headers={"Authorization": f"Bearer {parent_token}"})
    pin = resp.json()["pin"]
    client.post("/api/family/join", json={"pin": pin}, headers={"Authorization": f"Bearer {child_token}"})
    return parent_token, child_token


def test_child_sets_nickname_first_time_for_free(client):
    _parent_token, child_token = _setup_family_with_child(client)

    resp = client.patch("/api/profile/nickname", json={"nickname": "CoolKid"},
                        headers={"Authorization": f"Bearer {child_token}"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["nickname"] == "CoolKid"
    assert data["nickname_changes"] == 1

    # Verify no ExBucks were deducted
    balance_resp = client.get("/api/exbucks/balance",
                              headers={"Authorization": f"Bearer {child_token}"})
    assert balance_resp.json()["balance"] == 0


def test_nickname_must_be_unique_case_insensitive(client):
    _p1, child1_token = _setup_family_with_child(client, "p1@test.com", "c1@test.com")
    _p2, child2_token = _setup_family_with_child(client, "p2@test.com", "c2@test.com")

    # Child 1 sets nickname
    resp = client.patch("/api/profile/nickname", json={"nickname": "CoolKid"},
                        headers={"Authorization": f"Bearer {child1_token}"})
    assert resp.status_code == 200

    # Child 2 tries same nickname with different case
    resp = client.patch("/api/profile/nickname", json={"nickname": "coolkid"},
                        headers={"Authorization": f"Bearer {child2_token}"})
    assert resp.status_code == 409


def _give_exbucks(client, child_email, amount):
    db = next(client.app.dependency_overrides[get_db]())
    user = db.query(User).filter(User.email == child_email).first()
    user.exbucks_balance += amount
    db.commit()


def test_subsequent_nickname_change_costs_50_exbucks(client):
    _parent_token, child_token = _setup_family_with_child(client)

    # First change (free)
    client.patch("/api/profile/nickname", json={"nickname": "First"},
                 headers={"Authorization": f"Bearer {child_token}"})

    # Give child 100 ExBucks
    _give_exbucks(client, "child@example.com", 100)

    # Second change (costs 50)
    resp = client.patch("/api/profile/nickname", json={"nickname": "Second"},
                        headers={"Authorization": f"Bearer {child_token}"})
    assert resp.status_code == 200
    assert resp.json()["nickname"] == "Second"
    assert resp.json()["nickname_changes"] == 2

    # Verify 50 deducted
    balance_resp = client.get("/api/exbucks/balance",
                              headers={"Authorization": f"Bearer {child_token}"})
    assert balance_resp.json()["balance"] == 50

    # Verify transaction record
    txns_resp = client.get("/api/exbucks/transactions",
                           headers={"Authorization": f"Bearer {child_token}"})
    txns = txns_resp.json()
    nickname_txn = [t for t in txns if t["description"] == "Nickname change"]
    assert len(nickname_txn) == 1
    assert nickname_txn[0]["type"] == "spent"
    assert nickname_txn[0]["amount"] == -50


def test_nickname_change_rejected_if_insufficient_balance(client):
    _parent_token, child_token = _setup_family_with_child(client)

    # First change (free)
    client.patch("/api/profile/nickname", json={"nickname": "First"},
                 headers={"Authorization": f"Bearer {child_token}"})

    # Give only 30 ExBucks (less than 50 required)
    _give_exbucks(client, "child@example.com", 30)

    # Second change — should fail
    resp = client.patch("/api/profile/nickname", json={"nickname": "Second"},
                        headers={"Authorization": f"Bearer {child_token}"})
    assert resp.status_code == 400

    # Nickname unchanged
    db = next(client.app.dependency_overrides[get_db]())
    user = db.query(User).filter(User.email == "child@example.com").first()
    assert user.nickname == "First"
    assert user.exbucks_balance == 30


def test_global_leaderboard_shows_nickname(client):
    _parent_token, child_token = _setup_family_with_child(client)

    # Set nickname
    client.patch("/api/profile/nickname", json={"nickname": "CoolKid"},
                 headers={"Authorization": f"Bearer {child_token}"})

    resp = client.get("/api/leaderboard/global",
                      headers={"Authorization": f"Bearer {child_token}"})
    assert resp.status_code == 200
    entry = resp.json()["entries"][0]
    assert entry["nickname"] == "CoolKid"


def test_global_leaderboard_falls_back_to_null_nickname(client):
    _parent_token, child_token = _setup_family_with_child(client)

    resp = client.get("/api/leaderboard/global",
                      headers={"Authorization": f"Bearer {child_token}"})
    assert resp.status_code == 200
    entry = resp.json()["entries"][0]
    assert entry["nickname"] is None


def test_profile_includes_nickname(client):
    _parent_token, child_token = _setup_family_with_child(client)

    # Set nickname
    client.patch("/api/profile/nickname", json={"nickname": "CoolKid"},
                 headers={"Authorization": f"Bearer {child_token}"})

    resp = client.get("/api/profile",
                      headers={"Authorization": f"Bearer {child_token}"})
    assert resp.status_code == 200
    assert resp.json()["nickname"] == "CoolKid"


def test_parent_sees_child_nickname(client):
    parent_token, child_token = _setup_family_with_child(client)

    # Set nickname
    client.patch("/api/profile/nickname", json={"nickname": "CoolKid"},
                 headers={"Authorization": f"Bearer {child_token}"})

    # Get child_id
    db = next(client.app.dependency_overrides[get_db]())
    child = db.query(User).filter(User.email == "child@example.com").first()

    resp = client.get(f"/api/profile/{child.id}",
                      headers={"Authorization": f"Bearer {parent_token}"})
    assert resp.status_code == 200
    assert resp.json()["nickname"] == "CoolKid"
