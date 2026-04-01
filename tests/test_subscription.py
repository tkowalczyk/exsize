from exsize.database import get_db
from exsize.models import Subscription


def _add_sizepass(client, family_id):
    """Insert an active SizePass subscription directly into DB."""
    db = next(client.app.dependency_overrides[get_db]())
    sub = Subscription(family_id=family_id, plan="monthly", status="active")
    db.add(sub)
    db.commit()


def _register_and_login(client, email="parent@example.com", password="mypassword", role="parent"):
    client.post("/api/auth/register", json={
        "email": email, "password": password, "role": role,
    })
    resp = client.post("/api/auth/login", json={
        "email": email, "password": password,
    })
    return resp.json()["access_token"]


def test_checkout_creates_active_subscription(client):
    parent_token, family = _setup_family(client)
    resp = client.post("/api/subscription/checkout", json={"plan": "monthly"}, headers={
        "Authorization": f"Bearer {parent_token}",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["plan"] == "monthly"
    assert data["status"] == "active"
    # Verify GET returns active subscription
    resp2 = client.get("/api/subscription", headers={
        "Authorization": f"Bearer {parent_token}",
    })
    assert resp2.json()["plan"] == "monthly"
    assert resp2.json()["status"] == "active"


def test_checkout_rejects_already_subscribed(client):
    parent_token, family = _setup_family(client)
    # First checkout succeeds
    client.post("/api/subscription/checkout", json={"plan": "monthly"}, headers={
        "Authorization": f"Bearer {parent_token}",
    })
    # Second checkout fails
    resp = client.post("/api/subscription/checkout", json={"plan": "yearly"}, headers={
        "Authorization": f"Bearer {parent_token}",
    })
    assert resp.status_code == 409


def test_checkout_rejects_invalid_plan(client):
    parent_token, family = _setup_family(client)
    resp = client.post("/api/subscription/checkout", json={"plan": "weekly"}, headers={
        "Authorization": f"Bearer {parent_token}",
    })
    assert resp.status_code == 422


def test_checkout_rejects_child(client):
    parent_token, child_token, child_id, family = _setup_family_with_child(client)
    resp = client.post("/api/subscription/checkout", json={"plan": "monthly"}, headers={
        "Authorization": f"Bearer {child_token}",
    })
    assert resp.status_code == 403


def test_cancel_deactivates_subscription(client):
    parent_token, family = _setup_family(client)
    # Activate subscription
    client.post("/api/subscription/checkout", json={"plan": "monthly"}, headers={
        "Authorization": f"Bearer {parent_token}",
    })
    # Cancel it
    resp = client.post("/api/subscription/cancel", headers={
        "Authorization": f"Bearer {parent_token}",
    })
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    # Verify GET returns free
    resp2 = client.get("/api/subscription", headers={
        "Authorization": f"Bearer {parent_token}",
    })
    assert resp2.json()["status"] == "cancelled"


def test_cancel_without_subscription_returns_404(client):
    parent_token, family = _setup_family(client)
    resp = client.post("/api/subscription/cancel", headers={
        "Authorization": f"Bearer {parent_token}",
    })
    assert resp.status_code == 404


def test_cancel_rejects_child(client):
    parent_token, child_token, child_id, family = _setup_family_with_child(client)
    _add_sizepass(client, family["id"])
    resp = client.post("/api/subscription/cancel", headers={
        "Authorization": f"Bearer {child_token}",
    })
    assert resp.status_code == 403


def test_get_subscription_returns_free(client):
    token = _register_and_login(client)
    resp = client.get("/api/subscription", headers={
        "Authorization": f"Bearer {token}",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["plan"] == "free"
    assert data["status"] == "free"


def _setup_family_with_child(client):
    parent_token, family = _setup_family(client)
    child_token = _register_and_login(client, email="child@example.com", role="child")
    client.post("/api/family/join", json={"pin": family["pin"]}, headers={
        "Authorization": f"Bearer {child_token}",
    })
    members = client.get("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()["members"]
    child_id = next(m["id"] for m in members if m["role"] == "child")
    return parent_token, child_token, child_id, family


def _create_accepted_task(client, parent_token, child_token, child_id):
    task = client.post("/api/tasks", json={
        "name": "Do pushups", "description": "desc", "exbucks": 5,
        "assigned_to": child_id,
    }, headers={"Authorization": f"Bearer {parent_token}"}).json()
    client.patch(f"/api/tasks/{task['id']}/accept", headers={
        "Authorization": f"Bearer {child_token}",
    })
    return task


def _setup_family(client):
    parent_token = _register_and_login(client, email="parent@example.com")
    family = client.post("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()
    return parent_token, family


def test_free_family_limited_to_one_child(client):
    parent_token, family = _setup_family(client)
    # First child joins — OK
    child1_token = _register_and_login(client, email="child1@example.com", role="child")
    resp = client.post("/api/family/join", json={"pin": family["pin"]}, headers={
        "Authorization": f"Bearer {child1_token}",
    })
    assert resp.status_code == 200
    # Second child — blocked on free tier
    child2_token = _register_and_login(client, email="child2@example.com", role="child")
    resp = client.post("/api/family/join", json={"pin": family["pin"]}, headers={
        "Authorization": f"Bearer {child2_token}",
    })
    assert resp.status_code == 403
    assert "upgrade" in resp.json()["detail"].lower()


def test_sizepass_family_allows_multiple_children(client):
    parent_token, family = _setup_family(client)
    _add_sizepass(client, family["id"])
    # First child
    child1_token = _register_and_login(client, email="child1@example.com", role="child")
    resp = client.post("/api/family/join", json={"pin": family["pin"]}, headers={
        "Authorization": f"Bearer {child1_token}",
    })
    assert resp.status_code == 200
    # Second child — allowed with SizePass
    child2_token = _register_and_login(client, email="child2@example.com", role="child")
    resp = client.post("/api/family/join", json={"pin": family["pin"]}, headers={
        "Authorization": f"Bearer {child2_token}",
    })
    assert resp.status_code == 200


def test_free_child_cannot_attach_photo(client):
    parent_token, child_token, child_id, family = _setup_family_with_child(client)
    task = _create_accepted_task(client, parent_token, child_token, child_id)
    resp = client.patch(f"/api/tasks/{task['id']}/complete", json={
        "photo_url": "https://example.com/photo.jpg",
    }, headers={"Authorization": f"Bearer {child_token}"})
    assert resp.status_code == 403
    assert "sizepass" in resp.json()["detail"].lower()


def test_sizepass_child_can_attach_photo(client):
    parent_token, child_token, child_id, family = _setup_family_with_child(client)
    _add_sizepass(client, family["id"])
    task = _create_accepted_task(client, parent_token, child_token, child_id)
    resp = client.patch(f"/api/tasks/{task['id']}/complete", json={
        "photo_url": "https://example.com/photo.jpg",
    }, headers={"Authorization": f"Bearer {child_token}"})
    assert resp.status_code == 200
    assert resp.json()["photo_url"] == "https://example.com/photo.jpg"


def _create_and_approve_task(client, parent_token, child_token, child_id, name="Do pushups", exbucks=5):
    task = client.post("/api/tasks", json={
        "name": name, "description": "desc", "exbucks": exbucks,
        "assigned_to": child_id,
    }, headers={"Authorization": f"Bearer {parent_token}"}).json()
    client.patch(f"/api/tasks/{task['id']}/accept", headers={
        "Authorization": f"Bearer {child_token}",
    })
    client.patch(f"/api/tasks/{task['id']}/complete", headers={
        "Authorization": f"Bearer {child_token}",
    })
    client.patch(f"/api/tasks/{task['id']}/approve", headers={
        "Authorization": f"Bearer {parent_token}",
    })
    return task


def test_free_child_has_freemium_badge(client):
    parent_token, child_token, child_id, family = _setup_family_with_child(client)
    resp = client.get("/api/profile", headers={"Authorization": f"Bearer {child_token}"})
    assert resp.status_code == 200
    assert resp.json()["badges"] == ["Freemium"]


def test_sizepass_child_gets_milestone_badges(client):
    parent_token, child_token, child_id, family = _setup_family_with_child(client)
    _add_sizepass(client, family["id"])
    # Earn enough XP to reach level 5 (need 100+200+300+400 = 1000 XP)
    for i in range(10):
        _create_and_approve_task(client, parent_token, child_token, child_id,
                                 name=f"Task {i}", exbucks=100)
    resp = client.get("/api/profile", headers={"Authorization": f"Bearer {child_token}"})
    assert resp.status_code == 200
    badges = resp.json()["badges"]
    assert "SizePass" in badges
    assert "Rising Star" in badges  # level 5 milestone badge


def test_leaderboard_gated_for_free_user(client):
    parent_token, child_token, child_id, family = _setup_family_with_child(client)
    resp = client.get("/api/leaderboard", headers={
        "Authorization": f"Bearer {parent_token}",
    })
    assert resp.status_code == 403
    assert "sizepass" in resp.json()["detail"].lower()


def test_leaderboard_works_for_sizepass_family(client):
    parent_token, family = _setup_family(client)
    _add_sizepass(client, family["id"])
    # Add two children (SizePass lifts limit)
    child1_token = _register_and_login(client, email="child1@example.com", role="child")
    client.post("/api/family/join", json={"pin": family["pin"]}, headers={
        "Authorization": f"Bearer {child1_token}",
    })
    child2_token = _register_and_login(client, email="child2@example.com", role="child")
    client.post("/api/family/join", json={"pin": family["pin"]}, headers={
        "Authorization": f"Bearer {child2_token}",
    })
    members = client.get("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()["members"]
    children = [m for m in members if m["role"] == "child"]
    child1_id = children[0]["id"]
    # Give child1 some XP via a task
    _create_and_approve_task(client, parent_token, child1_token, child1_id, name="Task A", exbucks=50)

    resp = client.get("/api/leaderboard", headers={
        "Authorization": f"Bearer {parent_token}",
    })
    assert resp.status_code == 200
    entries = resp.json()["entries"]
    assert len(entries) == 2
    # First entry should be the child with more XP
    assert entries[0]["xp"] >= entries[1]["xp"]


def test_sizepass_dashboard_has_advanced_stats(client):
    parent_token, child_token, child_id, family = _setup_family_with_child(client)
    _add_sizepass(client, family["id"])
    _create_and_approve_task(client, parent_token, child_token, child_id, name="Pushups", exbucks=10)
    resp = client.get("/api/dashboard", headers={
        "Authorization": f"Bearer {parent_token}",
    })
    assert resp.status_code == 200
    data = resp.json()
    # Advanced stats should be present for SizePass
    assert "advanced_stats" in data
    stats = data["advanced_stats"]
    assert stats["total_xp_earned"] == 10
    assert stats["best_streak"] == 0  # no day_of_week tasks
    assert len(stats["children"]) == 1
    assert stats["children"][0]["total_tasks"] == 1
    assert stats["children"][0]["approved_tasks"] == 1


def test_free_dashboard_has_no_advanced_stats(client):
    parent_token, child_token, child_id, family = _setup_family_with_child(client)
    _create_and_approve_task(client, parent_token, child_token, child_id, name="Pushups", exbucks=10)
    resp = client.get("/api/dashboard", headers={
        "Authorization": f"Bearer {parent_token}",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["advanced_stats"] is None
