from exsize.models import User
from exsize.security import hash_password


def _register_and_login(client, email="parent@example.com", password="mypassword", role="parent"):
    if role == "admin":
        from exsize.database import get_db
        from exsize.app import app
        db = next(app.dependency_overrides[get_db]())
        admin = User(email=email, password_hash=hash_password(password), role="admin", language="en")
        db.add(admin)
        db.commit()
        resp = client.post("/api/auth/admin-login", json={"admin_secret": "test-admin-secret"})
        return resp.json()["access_token"]
    client.post("/api/auth/register", json={
        "email": email, "password": password, "role": role,
    })
    resp = client.post("/api/auth/login", json={
        "email": email, "password": password,
    })
    return resp.json()["access_token"]


def _setup_family_with_child(client):
    parent_token = _register_and_login(client, email="parent@example.com")
    family = client.post("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()

    child_token = _register_and_login(client, email="child@example.com", role="child")
    client.post("/api/family/join", json={"pin": family["pin"]}, headers={
        "Authorization": f"Bearer {child_token}",
    })

    members = client.get("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()["members"]
    child_id = next(m["id"] for m in members if m["role"] == "child")
    return parent_token, child_token, child_id


def _create_and_approve_task(client, parent_token, child_token, child_id, name="Do pushups", exbucks=5):
    task = client.post("/api/tasks", json={
        "name": name, "description": "desc", "exbucks": exbucks, "assigned_to": child_id,
    }, headers={"Authorization": f"Bearer {parent_token}"}).json()
    client.patch(f"/api/tasks/{task['id']}/accept", headers={"Authorization": f"Bearer {child_token}"})
    client.patch(f"/api/tasks/{task['id']}/complete", headers={"Authorization": f"Bearer {child_token}"})
    client.patch(f"/api/tasks/{task['id']}/approve", headers={"Authorization": f"Bearer {parent_token}"})
    return task


def test_child_views_own_profile(client):
    _parent_token, child_token, _child_id = _setup_family_with_child(client)

    resp = client.get("/api/profile", headers={
        "Authorization": f"Bearer {child_token}",
    })

    assert resp.status_code == 200
    data = resp.json()
    assert data["xp"] == 0
    assert data["level"] == 1
    assert data["level_name"] == "Beginner"
    assert data["progress_percent"] == 0
    assert data["xp_for_next_level"] == 100
    assert data["streak"] == 0
    assert data["exbucks_balance"] == 0
    assert data["badges"] == ["Freemium"]
    assert data["transactions"] == []


def test_parent_views_child_profile(client):
    parent_token, _child_token, child_id = _setup_family_with_child(client)

    resp = client.get(f"/api/profile/{child_id}", headers={
        "Authorization": f"Bearer {parent_token}",
    })

    assert resp.status_code == 200
    data = resp.json()
    assert data["xp"] == 0
    assert data["level"] == 1
    assert data["level_name"] == "Beginner"
    assert data["streak"] == 0
    assert data["exbucks_balance"] == 0
    assert data["badges"] == ["Freemium"]
    assert data["transactions"] == []


def test_parent_cannot_view_child_from_other_family(client):
    # Family 1
    parent1_token = _register_and_login(client, email="parent1@example.com")
    client.post("/api/family", headers={"Authorization": f"Bearer {parent1_token}"})

    # Family 2 with child
    parent2_token = _register_and_login(client, email="parent2@example.com")
    family2 = client.post("/api/family", headers={"Authorization": f"Bearer {parent2_token}"}).json()
    child_token = _register_and_login(client, email="child@example.com", role="child")
    client.post("/api/family/join", json={"pin": family2["pin"]}, headers={
        "Authorization": f"Bearer {child_token}",
    })
    members = client.get("/api/family", headers={"Authorization": f"Bearer {parent2_token}"}).json()["members"]
    child_id = next(m["id"] for m in members if m["role"] == "child")

    # Parent 1 tries to view child from family 2
    resp = client.get(f"/api/profile/{child_id}", headers={
        "Authorization": f"Bearer {parent1_token}",
    })
    assert resp.status_code == 404


def test_parent_cannot_view_own_profile(client):
    parent_token, _child_token, _child_id = _setup_family_with_child(client)

    resp = client.get("/api/profile", headers={
        "Authorization": f"Bearer {parent_token}",
    })
    assert resp.status_code == 403


def test_profile_includes_transactions_after_earning(client):
    parent_token, child_token, child_id = _setup_family_with_child(client)

    _create_and_approve_task(client, parent_token, child_token, child_id, name="Do pushups", exbucks=10)

    resp = client.get("/api/profile", headers={
        "Authorization": f"Bearer {child_token}",
    })

    assert resp.status_code == 200
    data = resp.json()
    assert data["xp"] == 10
    assert data["exbucks_balance"] == 10
    assert len(data["transactions"]) == 1
    txn = data["transactions"][0]
    assert txn["type"] == "earned"
    assert txn["amount"] == 10
    assert txn["description"] == "Do pushups"


def test_profile_includes_spent_and_penalty_transactions(client):
    parent_token, child_token, child_id = _setup_family_with_child(client)

    # Seed avatars
    from exsize.database import get_db
    db = next(client.app.dependency_overrides[get_db]())
    from exsize.app import _seed_avatar_items
    _seed_avatar_items(db)

    # Earn some exbucks first
    _create_and_approve_task(client, parent_token, child_token, child_id, name="Earn task", exbucks=50)

    # Spend via avatar purchase (cheapest non-free icon = 10 EB)
    from exsize.models import AvatarItem
    cheap_icon = db.query(AvatarItem).filter(AvatarItem.type == "icon", AvatarItem.price == 10).first()
    client.post(f"/api/avatar/purchase/{cheap_icon.id}", headers={
        "Authorization": f"Bearer {child_token}",
    })

    # Penalty from parent
    client.post("/api/exbucks/penalty", json={
        "child_id": child_id, "amount": 5, "reason": "Messy room",
    }, headers={"Authorization": f"Bearer {parent_token}"})

    resp = client.get("/api/profile", headers={
        "Authorization": f"Bearer {child_token}",
    })

    data = resp.json()
    assert data["exbucks_balance"] == 35  # 50 - 10 - 5
    assert len(data["transactions"]) == 3
    types = [t["type"] for t in data["transactions"]]
    assert "earned" in types
    assert "spent" in types
    assert "penalized" in types
