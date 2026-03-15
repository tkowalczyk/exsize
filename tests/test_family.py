def _register_and_login(client, email="parent@example.com", password="mypassword", role="parent"):
    client.post("/api/auth/register", json={
        "email": email, "password": password, "role": role,
    })
    resp = client.post("/api/auth/login", json={
        "email": email, "password": password,
    })
    return resp.json()["access_token"]


def test_parent_can_create_family(client):
    token = _register_and_login(client)
    response = client.post("/api/family", headers={
        "Authorization": f"Bearer {token}",
    })
    assert response.status_code == 201
    data = response.json()
    assert "pin" in data
    assert len(data["pin"]) == 6
    assert data["pin"].isalnum()


def test_two_families_get_different_pins(client):
    token1 = _register_and_login(client, email="parent1@example.com")
    token2 = _register_and_login(client, email="parent2@example.com")
    pin1 = client.post("/api/family", headers={"Authorization": f"Bearer {token1}"}).json()["pin"]
    pin2 = client.post("/api/family", headers={"Authorization": f"Bearer {token2}"}).json()["pin"]
    assert pin1 != pin2


def test_child_can_join_family_by_pin(client):
    parent_token = _register_and_login(client, email="parent@example.com")
    family = client.post("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()

    child_token = _register_and_login(client, email="child@example.com", role="child")
    response = client.post("/api/family/join", json={"pin": family["pin"]}, headers={
        "Authorization": f"Bearer {child_token}",
    })
    assert response.status_code == 200
    assert response.json()["family_id"] == family["id"]


def test_family_page_shows_members_with_roles(client):
    parent_token = _register_and_login(client, email="parent@example.com")
    family = client.post("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()

    child_token = _register_and_login(client, email="child@example.com", role="child")
    client.post("/api/family/join", json={"pin": family["pin"]}, headers={
        "Authorization": f"Bearer {child_token}",
    })

    response = client.get("/api/family", headers={"Authorization": f"Bearer {parent_token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["pin"] == family["pin"]
    assert len(data["members"]) == 2
    roles = {m["role"] for m in data["members"]}
    assert roles == {"parent", "child"}
    emails = {m["email"] for m in data["members"]}
    assert emails == {"parent@example.com", "child@example.com"}


def test_second_parent_can_join_by_pin(client):
    parent1_token = _register_and_login(client, email="parent1@example.com")
    family = client.post("/api/family", headers={"Authorization": f"Bearer {parent1_token}"}).json()

    parent2_token = _register_and_login(client, email="parent2@example.com")
    response = client.post("/api/family/join", json={"pin": family["pin"]}, headers={
        "Authorization": f"Bearer {parent2_token}",
    })
    assert response.status_code == 200
    assert response.json()["family_id"] == family["id"]


def test_parent_can_remove_child(client):
    parent_token = _register_and_login(client, email="parent@example.com")
    family = client.post("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()

    child_token = _register_and_login(client, email="child@example.com", role="child")
    client.post("/api/family/join", json={"pin": family["pin"]}, headers={
        "Authorization": f"Bearer {child_token}",
    })

    # Get child's user id from family members
    members = client.get("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()["members"]
    child_id = next(m["id"] for m in members if m["role"] == "child")

    response = client.delete(f"/api/family/members/{child_id}", headers={
        "Authorization": f"Bearer {parent_token}",
    })
    assert response.status_code == 200

    # Verify child is no longer in family
    members_after = client.get("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()["members"]
    assert len(members_after) == 1
    assert members_after[0]["role"] == "parent"


def test_free_tier_blocks_third_parent(client):
    parent1_token = _register_and_login(client, email="parent1@example.com")
    family = client.post("/api/family", headers={"Authorization": f"Bearer {parent1_token}"}).json()

    parent2_token = _register_and_login(client, email="parent2@example.com")
    client.post("/api/family/join", json={"pin": family["pin"]}, headers={
        "Authorization": f"Bearer {parent2_token}",
    })

    parent3_token = _register_and_login(client, email="parent3@example.com")
    response = client.post("/api/family/join", json={"pin": family["pin"]}, headers={
        "Authorization": f"Bearer {parent3_token}",
    })
    assert response.status_code == 403
    assert "upgrade" in response.json()["detail"].lower() or "limit" in response.json()["detail"].lower()


def test_free_tier_blocks_second_child(client):
    parent_token = _register_and_login(client, email="parent@example.com")
    family = client.post("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()

    child1_token = _register_and_login(client, email="child1@example.com", role="child")
    client.post("/api/family/join", json={"pin": family["pin"]}, headers={
        "Authorization": f"Bearer {child1_token}",
    })

    child2_token = _register_and_login(client, email="child2@example.com", role="child")
    response = client.post("/api/family/join", json={"pin": family["pin"]}, headers={
        "Authorization": f"Bearer {child2_token}",
    })
    assert response.status_code == 403
    assert "upgrade" in response.json()["detail"].lower() or "limit" in response.json()["detail"].lower()


def test_child_cannot_create_family(client):
    child_token = _register_and_login(client, email="child@example.com", role="child")
    response = client.post("/api/family", headers={
        "Authorization": f"Bearer {child_token}",
    })
    assert response.status_code == 403


def test_non_member_cannot_view_family(client):
    token = _register_and_login(client)
    response = client.get("/api/family", headers={
        "Authorization": f"Bearer {token}",
    })
    assert response.status_code == 404


def test_child_cannot_remove_members(client):
    parent_token = _register_and_login(client, email="parent@example.com")
    family = client.post("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()

    child_token = _register_and_login(client, email="child@example.com", role="child")
    client.post("/api/family/join", json={"pin": family["pin"]}, headers={
        "Authorization": f"Bearer {child_token}",
    })

    # Get parent's user id
    members = client.get("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()["members"]
    parent_id = next(m["id"] for m in members if m["role"] == "parent")

    response = client.delete(f"/api/family/members/{parent_id}", headers={
        "Authorization": f"Bearer {child_token}",
    })
    assert response.status_code == 403
