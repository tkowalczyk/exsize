from exsize.models import User
from exsize.security import hash_password


def _register_and_login(client, email="admin@example.com", password="mypassword", role="admin"):
    if role == "admin":
        return _seed_admin_and_login(client, email, password)
    client.post("/api/auth/register", json={
        "email": email, "password": password, "role": role,
    })
    resp = client.post("/api/auth/login", json={
        "email": email, "password": password,
    })
    return resp.json()["access_token"]


def _seed_admin_and_login(client, email="admin@example.com", password="mypassword"):
    from exsize.database import get_db
    from exsize.app import app
    db = next(app.dependency_overrides[get_db]())
    admin = User(email=email, password_hash=hash_password(password), role="admin", language="en")
    db.add(admin)
    db.commit()
    resp = client.post("/api/auth/admin-login", json={
        "admin_secret": "test-admin-secret",
    })
    return resp.json()["access_token"]


def test_admin_creates_reward(client):
    token = _register_and_login(client, role="admin")

    response = client.post("/api/rewards", json={
        "name": "Extra screen time",
        "description": "30 minutes of extra screen time",
        "price": 10,
    }, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Extra screen time"
    assert data["description"] == "30 minutes of extra screen time"
    assert data["price"] == 10
    assert "id" in data


def test_any_user_can_list_rewards(client):
    admin_token = _register_and_login(client, role="admin")

    # Admin creates two rewards
    client.post("/api/rewards", json={
        "name": "Extra screen time", "description": "30 min", "price": 10,
    }, headers={"Authorization": f"Bearer {admin_token}"})
    client.post("/api/rewards", json={
        "name": "Pick dinner", "description": "Choose tonight's dinner", "price": 5,
    }, headers={"Authorization": f"Bearer {admin_token}"})

    # A parent can see them
    parent_token = _register_and_login(client, email="parent@example.com", role="parent")
    response = client.get("/api/rewards", headers={"Authorization": f"Bearer {parent_token}"})

    assert response.status_code == 200
    rewards = response.json()
    assert len(rewards) == 2
    names = {r["name"] for r in rewards}
    assert names == {"Extra screen time", "Pick dinner"}


def test_admin_edits_reward(client):
    token = _register_and_login(client, role="admin")

    reward = client.post("/api/rewards", json={
        "name": "Screen time", "description": "30 min", "price": 10,
    }, headers={"Authorization": f"Bearer {token}"}).json()

    response = client.patch(f"/api/rewards/{reward['id']}", json={
        "name": "Extra screen time",
        "price": 15,
    }, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Extra screen time"
    assert data["description"] == "30 min"  # unchanged
    assert data["price"] == 15


def test_admin_deletes_reward(client):
    token = _register_and_login(client, role="admin")

    reward = client.post("/api/rewards", json={
        "name": "Screen time", "description": "30 min", "price": 10,
    }, headers={"Authorization": f"Bearer {token}"}).json()

    response = client.delete(f"/api/rewards/{reward['id']}", headers={
        "Authorization": f"Bearer {token}",
    })
    assert response.status_code == 204

    # Catalog is now empty
    rewards = client.get("/api/rewards", headers={
        "Authorization": f"Bearer {token}",
    }).json()
    assert len(rewards) == 0


def _setup_family_with_child(client):
    """Create a family with one parent and one child. Returns (parent_token, child_token, child_id)."""
    parent_token = _register_and_login(client, email="parent@example.com", role="parent")
    family = client.post("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()

    child_token = _register_and_login(client, email="child@example.com", role="child")
    client.post("/api/family/join", json={"pin": family["pin"]}, headers={
        "Authorization": f"Bearer {child_token}",
    })

    members = client.get("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()["members"]
    child_id = next(m["id"] for m in members if m["role"] == "child")
    return parent_token, child_token, child_id


def _create_and_approve_task(client, parent_token, child_token, child_id, name="Do 10 pushups", exbucks=5):
    """Create a task, child completes it, parent approves it."""
    task = client.post("/api/tasks", json={
        "name": name, "description": f"Complete {name}", "exbucks": exbucks, "assigned_to": child_id,
    }, headers={"Authorization": f"Bearer {parent_token}"}).json()
    client.patch(f"/api/tasks/{task['id']}/accept", headers={"Authorization": f"Bearer {child_token}"})
    client.patch(f"/api/tasks/{task['id']}/complete", headers={"Authorization": f"Bearer {child_token}"})
    client.patch(f"/api/tasks/{task['id']}/approve", headers={"Authorization": f"Bearer {parent_token}"})
    return task


def test_child_purchases_reward(client):
    admin_token = _register_and_login(client, role="admin")
    parent_token, child_token, child_id = _setup_family_with_child(client)

    # Give child 20 ExBucks
    _create_and_approve_task(client, parent_token, child_token, child_id, exbucks=20)

    # Admin creates a reward
    reward = client.post("/api/rewards", json={
        "name": "Extra screen time", "description": "30 min", "price": 10,
    }, headers={"Authorization": f"Bearer {admin_token}"}).json()

    # Child purchases it
    response = client.post(f"/api/rewards/{reward['id']}/purchase", headers={
        "Authorization": f"Bearer {child_token}",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["reward_name"] == "Extra screen time"
    assert data["price"] == 10

    # Balance is deducted
    balance = client.get("/api/exbucks/balance", headers={
        "Authorization": f"Bearer {child_token}",
    }).json()["balance"]
    assert balance == 10

    # Transaction is recorded
    txns = client.get("/api/exbucks/transactions", headers={
        "Authorization": f"Bearer {child_token}",
    }).json()
    spent_txns = [t for t in txns if t["type"] == "spent"]
    assert len(spent_txns) == 1
    assert spent_txns[0]["amount"] == 10
    assert "Extra screen time" in spent_txns[0]["description"]


def test_purchase_blocked_insufficient_balance(client):
    admin_token = _register_and_login(client, role="admin")
    _parent_token, child_token, _child_id = _setup_family_with_child(client)

    # Create a reward costing 10 (child has 0 ExBucks)
    reward = client.post("/api/rewards", json={
        "name": "Expensive reward", "description": "Too pricey", "price": 10,
    }, headers={"Authorization": f"Bearer {admin_token}"}).json()

    response = client.post(f"/api/rewards/{reward['id']}/purchase", headers={
        "Authorization": f"Bearer {child_token}",
    })
    assert response.status_code == 400
    assert "Insufficient" in response.json()["detail"]


def test_child_sees_purchase_history(client):
    admin_token = _register_and_login(client, role="admin")
    parent_token, child_token, child_id = _setup_family_with_child(client)

    # Give child 30 ExBucks
    _create_and_approve_task(client, parent_token, child_token, child_id, exbucks=30)

    # Create two rewards
    r1 = client.post("/api/rewards", json={
        "name": "Screen time", "description": "30 min", "price": 10,
    }, headers={"Authorization": f"Bearer {admin_token}"}).json()
    r2 = client.post("/api/rewards", json={
        "name": "Pick dinner", "description": "Choose dinner", "price": 5,
    }, headers={"Authorization": f"Bearer {admin_token}"}).json()

    # Child buys both
    client.post(f"/api/rewards/{r1['id']}/purchase", headers={"Authorization": f"Bearer {child_token}"})
    client.post(f"/api/rewards/{r2['id']}/purchase", headers={"Authorization": f"Bearer {child_token}"})

    response = client.get("/api/rewards/purchases", headers={
        "Authorization": f"Bearer {child_token}",
    })
    assert response.status_code == 200
    purchases = response.json()
    assert len(purchases) == 2
    names = {p["reward_name"] for p in purchases}
    assert names == {"Screen time", "Pick dinner"}


def test_parent_sees_child_purchases(client):
    admin_token = _register_and_login(client, role="admin")
    parent_token, child_token, child_id = _setup_family_with_child(client)

    # Give child 20 ExBucks
    _create_and_approve_task(client, parent_token, child_token, child_id, exbucks=20)

    # Create and purchase a reward
    reward = client.post("/api/rewards", json={
        "name": "Screen time", "description": "30 min", "price": 10,
    }, headers={"Authorization": f"Bearer {admin_token}"}).json()
    client.post(f"/api/rewards/{reward['id']}/purchase", headers={
        "Authorization": f"Bearer {child_token}",
    })

    # Parent views child's purchases
    response = client.get(f"/api/rewards/purchases/{child_id}", headers={
        "Authorization": f"Bearer {parent_token}",
    })
    assert response.status_code == 200
    purchases = response.json()
    assert len(purchases) == 1
    assert purchases[0]["reward_name"] == "Screen time"
    assert purchases[0]["price"] == 10


def test_non_admin_cannot_manage_rewards(client):
    parent_token = _register_and_login(client, email="parent@example.com", role="parent")

    # Cannot create
    response = client.post("/api/rewards", json={
        "name": "Test", "description": "Test", "price": 5,
    }, headers={"Authorization": f"Bearer {parent_token}"})
    assert response.status_code == 403

    # Create as admin so we have something to edit/delete
    admin_token = _register_and_login(client, role="admin")
    reward = client.post("/api/rewards", json={
        "name": "Test", "description": "Test", "price": 5,
    }, headers={"Authorization": f"Bearer {admin_token}"}).json()

    # Cannot edit
    response = client.patch(f"/api/rewards/{reward['id']}", json={
        "name": "Hacked",
    }, headers={"Authorization": f"Bearer {parent_token}"})
    assert response.status_code == 403

    # Cannot delete
    response = client.delete(f"/api/rewards/{reward['id']}", headers={
        "Authorization": f"Bearer {parent_token}",
    })
    assert response.status_code == 403
