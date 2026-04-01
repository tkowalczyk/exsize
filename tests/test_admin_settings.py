from exsize.models import User
from exsize.security import hash_password


def _seed_admin_and_login(client):
    from exsize.database import get_db
    from exsize.app import app

    db = next(app.dependency_overrides[get_db]())
    admin = User(email="admin@test.com", password_hash=hash_password("pw"), role="admin", language="en")
    db.add(admin)
    db.commit()
    resp = client.post("/api/auth/admin-login", json={"admin_secret": "test-admin-secret"})
    return resp.json()["access_token"]


def _register_and_login(client, email="parent@example.com", password="mypassword", role="parent"):
    client.post("/api/auth/register", json={"email": email, "password": password, "role": role})
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def test_admin_gets_settings_with_seeded_default(client):
    token = _seed_admin_and_login(client)

    # Seed settings via the app's startup seed (we need to call it manually in tests)
    from exsize.database import get_db
    from exsize.app import app, _seed_app_settings

    db = next(app.dependency_overrides[get_db]())
    _seed_app_settings(db)

    resp = client.get("/api/admin/settings", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "max_exbucks_per_task" in data
    assert data["max_exbucks_per_task"] == 50


def test_non_admin_cannot_access_settings(client):
    parent_token = _register_and_login(client)

    resp = client.get("/api/admin/settings", headers={"Authorization": f"Bearer {parent_token}"})
    assert resp.status_code == 403


def test_unauthenticated_cannot_access_settings(client):
    resp = client.get("/api/admin/settings")
    assert resp.status_code == 401


def test_admin_updates_max_exbucks_per_task(client):
    token = _seed_admin_and_login(client)

    from exsize.database import get_db
    from exsize.app import app, _seed_app_settings

    db = next(app.dependency_overrides[get_db]())
    _seed_app_settings(db)

    resp = client.patch("/api/admin/settings", json={"max_exbucks_per_task": 100}, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["max_exbucks_per_task"] == 100

    # Verify persisted
    resp = client.get("/api/admin/settings", headers={"Authorization": f"Bearer {token}"})
    assert resp.json()["max_exbucks_per_task"] == 100


def test_non_admin_cannot_update_settings(client):
    parent_token = _register_and_login(client)

    resp = client.patch("/api/admin/settings", json={"max_exbucks_per_task": 100}, headers={"Authorization": f"Bearer {parent_token}"})
    assert resp.status_code == 403


def _setup_family_with_child(client):
    parent_token = _register_and_login(client, email="parent@example.com")
    family = client.post("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()
    child_token = _register_and_login(client, email="child@example.com", role="child")
    client.post("/api/family/join", json={"pin": family["pin"]}, headers={"Authorization": f"Bearer {child_token}"})
    members = client.get("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()["members"]
    child_id = next(m["id"] for m in members if m["role"] == "child")
    return parent_token, child_token, child_id


def _seed_settings(client):
    from exsize.database import get_db
    from exsize.app import app, _seed_app_settings
    db = next(app.dependency_overrides[get_db]())
    _seed_app_settings(db)


def test_task_create_over_limit_returns_400(client):
    _seed_settings(client)
    parent_token, _, child_id = _setup_family_with_child(client)

    resp = client.post("/api/tasks", json={
        "name": "Hard task",
        "description": "Very rewarding",
        "exbucks": 60,  # limit is 50
        "assigned_to": child_id,
    }, headers={"Authorization": f"Bearer {parent_token}"})
    assert resp.status_code == 400
    assert "limit" in resp.json()["detail"].lower() or "max" in resp.json()["detail"].lower()


def test_task_create_at_limit_succeeds(client):
    _seed_settings(client)
    parent_token, _, child_id = _setup_family_with_child(client)

    resp = client.post("/api/tasks", json={
        "name": "Max task",
        "description": "At the limit",
        "exbucks": 50,  # exactly at limit
        "assigned_to": child_id,
    }, headers={"Authorization": f"Bearer {parent_token}"})
    assert resp.status_code == 201


def test_task_create_under_limit_succeeds(client):
    _seed_settings(client)
    parent_token, _, child_id = _setup_family_with_child(client)

    resp = client.post("/api/tasks", json={
        "name": "Small task",
        "description": "Under the limit",
        "exbucks": 10,
        "assigned_to": child_id,
    }, headers={"Authorization": f"Bearer {parent_token}"})
    assert resp.status_code == 201


def test_task_edit_over_limit_returns_400(client):
    _seed_settings(client)
    parent_token, _, child_id = _setup_family_with_child(client)

    task = client.post("/api/tasks", json={
        "name": "Task",
        "description": "Desc",
        "exbucks": 10,
        "assigned_to": child_id,
    }, headers={"Authorization": f"Bearer {parent_token}"}).json()

    resp = client.put(f"/api/tasks/{task['id']}", json={
        "name": "Task",
        "description": "Desc",
        "exbucks": 60,  # over the 50 limit
        "assigned_to": child_id,
    }, headers={"Authorization": f"Bearer {parent_token}"})
    assert resp.status_code == 400


def test_task_edit_at_limit_succeeds(client):
    _seed_settings(client)
    parent_token, _, child_id = _setup_family_with_child(client)

    task = client.post("/api/tasks", json={
        "name": "Task",
        "description": "Desc",
        "exbucks": 10,
        "assigned_to": child_id,
    }, headers={"Authorization": f"Bearer {parent_token}"}).json()

    resp = client.put(f"/api/tasks/{task['id']}", json={
        "name": "Task",
        "description": "Desc",
        "exbucks": 50,  # exactly at limit
        "assigned_to": child_id,
    }, headers={"Authorization": f"Bearer {parent_token}"})
    assert resp.status_code == 200


def test_parent_can_access_public_settings(client):
    _seed_settings(client)
    parent_token = _register_and_login(client)

    resp = client.get("/api/admin/settings/public", headers={"Authorization": f"Bearer {parent_token}"})
    assert resp.status_code == 200
    assert resp.json()["max_exbucks_per_task"] == 50


def test_penalty_not_affected_by_limit(client):
    _seed_settings(client)
    parent_token, _, child_id = _setup_family_with_child(client)

    # Penalty of 100 ExBucks should succeed even though limit is 50
    resp = client.post("/api/exbucks/penalty", json={
        "child_id": child_id,
        "amount": 100,
        "reason": "Big penalty",
    }, headers={"Authorization": f"Bearer {parent_token}"})
    assert resp.status_code == 201
    assert resp.json()["amount"] == -100
