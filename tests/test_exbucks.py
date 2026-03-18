def _register_and_login(client, email="parent@example.com", password="mypassword", role="parent"):
    client.post("/api/auth/register", json={
        "email": email, "password": password, "role": role,
    })
    resp = client.post("/api/auth/login", json={
        "email": email, "password": password,
    })
    return resp.json()["access_token"]


def _setup_family_with_child(client):
    """Create a family with one parent and one child. Returns (parent_token, child_token, child_id)."""
    parent_token = _register_and_login(client, email="parent@example.com")
    family = client.post("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()

    child_token = _register_and_login(client, email="child@example.com", role="child")
    client.post("/api/family/join", json={"pin": family["pin"]}, headers={
        "Authorization": f"Bearer {child_token}",
    })

    members = client.get("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()["members"]
    child_id = next(m["id"] for m in members if m["role"] == "child")
    return parent_token, child_token, child_id


def test_child_balance_starts_at_zero(client):
    _parent_token, child_token, _child_id = _setup_family_with_child(client)

    response = client.get("/api/exbucks/balance", headers={
        "Authorization": f"Bearer {child_token}",
    })
    assert response.status_code == 200
    assert response.json()["balance"] == 0


def _create_and_approve_task(client, parent_token, child_token, child_id, name="Do 10 pushups", exbucks=5):
    """Create a task, child completes it, parent approves it."""
    task = client.post("/api/tasks", json={
        "name": name,
        "description": f"Complete {name}",
        "exbucks": exbucks,
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


def test_approving_task_credits_child_balance(client):
    parent_token, child_token, child_id = _setup_family_with_child(client)

    _create_and_approve_task(client, parent_token, child_token, child_id, exbucks=5)

    response = client.get("/api/exbucks/balance", headers={
        "Authorization": f"Bearer {child_token}",
    })
    assert response.status_code == 200
    assert response.json()["balance"] == 5


def test_approval_creates_transaction_record(client):
    parent_token, child_token, child_id = _setup_family_with_child(client)

    _create_and_approve_task(client, parent_token, child_token, child_id, exbucks=5)

    response = client.get("/api/exbucks/transactions", headers={
        "Authorization": f"Bearer {child_token}",
    })
    assert response.status_code == 200
    txns = response.json()
    assert len(txns) == 1
    assert txns[0]["type"] == "earned"
    assert txns[0]["amount"] == 5
    assert txns[0]["description"] == "Do 10 pushups"
    assert "created_at" in txns[0]


def test_multiple_approvals_accumulate_balance(client):
    parent_token, child_token, child_id = _setup_family_with_child(client)

    _create_and_approve_task(client, parent_token, child_token, child_id, name="Pushups", exbucks=5)
    _create_and_approve_task(client, parent_token, child_token, child_id, name="Squats", exbucks=10)
    _create_and_approve_task(client, parent_token, child_token, child_id, name="Plank", exbucks=3)

    response = client.get("/api/exbucks/balance", headers={
        "Authorization": f"Bearer {child_token}",
    })
    assert response.json()["balance"] == 18

    txns = client.get("/api/exbucks/transactions", headers={
        "Authorization": f"Bearer {child_token}",
    }).json()
    assert len(txns) == 3


def test_parent_views_child_transaction_history(client):
    parent_token, child_token, child_id = _setup_family_with_child(client)

    _create_and_approve_task(client, parent_token, child_token, child_id, name="Pushups", exbucks=5)
    _create_and_approve_task(client, parent_token, child_token, child_id, name="Squats", exbucks=10)

    response = client.get(f"/api/exbucks/transactions/{child_id}", headers={
        "Authorization": f"Bearer {parent_token}",
    })
    assert response.status_code == 200
    txns = response.json()
    assert len(txns) == 2
    amounts = {t["amount"] for t in txns}
    assert amounts == {5, 10}


def test_child_cannot_view_other_child_transactions(client):
    parent_token, child_token, child_id = _setup_family_with_child(client)

    _create_and_approve_task(client, parent_token, child_token, child_id, exbucks=5)

    # Child tries to use the parent endpoint to view transactions
    response = client.get(f"/api/exbucks/transactions/{child_id}", headers={
        "Authorization": f"Bearer {child_token}",
    })
    assert response.status_code == 403


def test_parent_assigns_penalty_to_child(client):
    parent_token, child_token, child_id = _setup_family_with_child(client)

    # Give the child some balance first
    _create_and_approve_task(client, parent_token, child_token, child_id, exbucks=10)

    response = client.post("/api/exbucks/penalty", json={
        "child_id": child_id,
        "amount": 3,
        "reason": "Skipped morning stretches",
    }, headers={"Authorization": f"Bearer {parent_token}"})

    assert response.status_code == 201
    data = response.json()
    assert data["type"] == "penalized"
    assert data["amount"] == -3
    assert data["description"] == "Skipped morning stretches"

    # Balance reduced
    balance = client.get("/api/exbucks/balance", headers={
        "Authorization": f"Bearer {child_token}",
    }).json()
    assert balance["balance"] == 7


def test_penalty_can_make_balance_negative(client):
    parent_token, child_token, child_id = _setup_family_with_child(client)

    # Child starts at 0, penalty takes them negative
    response = client.post("/api/exbucks/penalty", json={
        "child_id": child_id,
        "amount": 5,
        "reason": "Didn't clean room",
    }, headers={"Authorization": f"Bearer {parent_token}"})
    assert response.status_code == 201

    balance = client.get("/api/exbucks/balance", headers={
        "Authorization": f"Bearer {child_token}",
    }).json()
    assert balance["balance"] == -5


def test_unauthenticated_cannot_access_balance(client):
    response = client.get("/api/exbucks/balance")
    assert response.status_code == 401


def test_unauthenticated_cannot_access_transactions(client):
    response = client.get("/api/exbucks/transactions")
    assert response.status_code == 401
