def _register_and_login(client, email="parent@example.com", password="mypassword", role="parent", date_of_birth=None):
    payload = {"email": email, "password": password, "role": role}
    if date_of_birth:
        payload["date_of_birth"] = date_of_birth
    client.post("/api/auth/register", json=payload)
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def _setup_family_with_child(client, child_email="child@example.com", child_dob=None):
    parent_token = _register_and_login(client, email="parent@example.com")
    family = client.post("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()
    child_token = _register_and_login(client, email=child_email, role="child", date_of_birth=child_dob)
    client.post("/api/family/join", json={"pin": family["pin"]}, headers={"Authorization": f"Bearer {child_token}"})
    members = client.get("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()["members"]
    child_id = next(m["id"] for m in members if m["role"] == "child")
    return parent_token, child_token, child_id, family


def test_parent_can_delete_child_account_with_all_data(client):
    parent_token, child_token, child_id, family = _setup_family_with_child(client)

    # Create a task assigned to the child so there's data to cascade
    client.post("/api/tasks", json={
        "name": "Clean room", "description": "Tidy up", "exbucks": 10, "assigned_to": child_id,
    }, headers={"Authorization": f"Bearer {parent_token}"})

    # Delete child account
    resp = client.delete(f"/api/account/children/{child_id}?confirm=true",
                         headers={"Authorization": f"Bearer {parent_token}"})
    assert resp.status_code == 200

    # Child is gone from family
    members = client.get("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()["members"]
    assert all(m["id"] != child_id for m in members)

    # Child's token no longer works
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {child_token}"})
    assert resp.status_code == 401

    # Child's tasks are gone
    tasks = client.get("/api/tasks", headers={"Authorization": f"Bearer {parent_token}"}).json()
    assert len(tasks) == 0


def test_delete_child_without_confirmation_returns_warning(client):
    parent_token, child_token, child_id, family = _setup_family_with_child(client)

    resp = client.delete(f"/api/account/children/{child_id}",
                         headers={"Authorization": f"Bearer {parent_token}"})
    assert resp.status_code == 200
    assert "warning" in resp.json()

    # Child still exists
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {child_token}"})
    assert resp.status_code == 200


def test_child_cannot_delete_another_child(client):
    parent_token, child_token, child_id, family = _setup_family_with_child(client)
    resp = client.delete(f"/api/account/children/{child_id}?confirm=true",
                         headers={"Authorization": f"Bearer {child_token}"})
    assert resp.status_code == 403


def test_parent_cannot_delete_child_from_other_family(client):
    # Family 1
    parent1_token, _, child_id, _ = _setup_family_with_child(client)

    # Family 2 parent
    parent2_token = _register_and_login(client, email="parent2@example.com")
    client.post("/api/family", headers={"Authorization": f"Bearer {parent2_token}"})

    resp = client.delete(f"/api/account/children/{child_id}?confirm=true",
                         headers={"Authorization": f"Bearer {parent2_token}"})
    assert resp.status_code == 404


def test_parent_deletes_own_account_family_continues(client):
    parent1_token = _register_and_login(client, email="parent1@example.com")
    family = client.post("/api/family", headers={"Authorization": f"Bearer {parent1_token}"}).json()

    parent2_token = _register_and_login(client, email="parent2@example.com")
    client.post("/api/family/join", json={"pin": family["pin"]},
                headers={"Authorization": f"Bearer {parent2_token}"})

    # Parent1 deletes own account
    resp = client.delete("/api/account/me?confirm=true",
                         headers={"Authorization": f"Bearer {parent1_token}"})
    assert resp.status_code == 200

    # Parent1 token no longer works
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {parent1_token}"})
    assert resp.status_code == 401

    # Family still exists, parent2 can see it
    resp = client.get("/api/family", headers={"Authorization": f"Bearer {parent2_token}"})
    assert resp.status_code == 200
    assert len(resp.json()["members"]) == 1


def test_last_parent_deletion_cascades_all_family_data(client):
    parent_token, child_token, child_id, family = _setup_family_with_child(client)

    # Create task and transaction data
    client.post("/api/tasks", json={
        "name": "Clean room", "description": "Tidy up", "exbucks": 10, "assigned_to": child_id,
    }, headers={"Authorization": f"Bearer {parent_token}"})

    # Last parent deletes account with confirmation
    resp = client.delete("/api/account/me?confirm=true",
                         headers={"Authorization": f"Bearer {parent_token}"})
    assert resp.status_code == 200

    # Parent token no longer works
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {parent_token}"})
    assert resp.status_code == 401

    # Child token no longer works (cascaded)
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {child_token}"})
    assert resp.status_code == 401


def test_last_parent_deletion_without_confirm_shows_cascade_warning(client):
    parent_token, _, child_id, _ = _setup_family_with_child(client)

    resp = client.delete("/api/account/me",
                         headers={"Authorization": f"Bearer {parent_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "warning" in data
    assert "family" in data["warning"].lower()


def test_child_under_16_requests_deletion_creates_pending_request(client):
    parent_token, child_token, child_id, family = _setup_family_with_child(
        client, child_dob="2015-06-15"  # ~10 years old
    )

    resp = client.post("/api/account/deletion-requests",
                       headers={"Authorization": f"Bearer {child_token}"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "pending"
    assert data["child_id"] == child_id

    # Child still exists — not deleted yet
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {child_token}"})
    assert resp.status_code == 200


def test_parent_can_list_and_approve_deletion_request(client):
    parent_token, child_token, child_id, family = _setup_family_with_child(
        client, child_dob="2015-06-15"
    )

    # Child requests deletion
    client.post("/api/account/deletion-requests",
                headers={"Authorization": f"Bearer {child_token}"})

    # Parent lists pending requests
    resp = client.get("/api/account/deletion-requests",
                      headers={"Authorization": f"Bearer {parent_token}"})
    assert resp.status_code == 200
    requests = resp.json()
    assert len(requests) == 1
    assert requests[0]["child_id"] == child_id
    request_id = requests[0]["id"]

    # Parent approves
    resp = client.post(f"/api/account/deletion-requests/{request_id}/approve",
                       headers={"Authorization": f"Bearer {parent_token}"})
    assert resp.status_code == 200

    # Child is now deleted
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {child_token}"})
    assert resp.status_code == 401


def test_child_over_16_can_delete_own_account_immediately(client):
    parent_token, child_token, child_id, family = _setup_family_with_child(
        client, child_dob="2008-01-01"  # 18 years old
    )

    resp = client.delete("/api/account/me?confirm=true",
                         headers={"Authorization": f"Bearer {child_token}"})
    assert resp.status_code == 200

    # Child token no longer works
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {child_token}"})
    assert resp.status_code == 401


def test_child_under_16_cannot_self_delete(client):
    parent_token, child_token, child_id, family = _setup_family_with_child(
        client, child_dob="2015-06-15"  # ~10 years old
    )

    resp = client.delete("/api/account/me?confirm=true",
                         headers={"Authorization": f"Bearer {child_token}"})
    assert resp.status_code == 403
    assert "parent" in resp.json()["detail"].lower()


def test_deleted_child_gone_from_family_and_profile(client):
    parent_token, child_token, child_id, family = _setup_family_with_child(client)

    # Delete child
    client.delete(f"/api/account/children/{child_id}?confirm=true",
                  headers={"Authorization": f"Bearer {parent_token}"})

    # Family members no longer includes child
    members = client.get("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()["members"]
    assert len(members) == 1
    assert members[0]["role"] == "parent"

    # Parent can't view child's profile anymore
    resp = client.get(f"/api/profile/{child_id}",
                      headers={"Authorization": f"Bearer {parent_token}"})
    assert resp.status_code == 404


def test_duplicate_deletion_request_rejected(client):
    parent_token, child_token, child_id, family = _setup_family_with_child(
        client, child_dob="2015-06-15"
    )

    resp = client.post("/api/account/deletion-requests",
                       headers={"Authorization": f"Bearer {child_token}"})
    assert resp.status_code == 201

    # Second request should be rejected
    resp = client.post("/api/account/deletion-requests",
                       headers={"Authorization": f"Bearer {child_token}"})
    assert resp.status_code == 409
