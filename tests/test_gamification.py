def _register_and_login(client, email="parent@example.com", password="mypassword", role="parent"):
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


def test_child_sees_initial_gamification_profile(client):
    _parent_token, child_token, _child_id = _setup_family_with_child(client)

    resp = client.get("/api/gamification/profile", headers={
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


def test_xp_credited_on_task_approval(client):
    parent_token, child_token, child_id = _setup_family_with_child(client)

    _create_and_approve_task(client, parent_token, child_token, child_id, exbucks=10)

    resp = client.get("/api/gamification/profile", headers={
        "Authorization": f"Bearer {child_token}",
    })
    data = resp.json()
    assert data["xp"] == 10


def test_level_increases_with_xp(client):
    parent_token, child_token, child_id = _setup_family_with_child(client)

    # Level 2 requires 100 XP total. Approve a task worth 100 exbucks.
    _create_and_approve_task(client, parent_token, child_token, child_id, name="Big task", exbucks=100)

    resp = client.get("/api/gamification/profile", headers={
        "Authorization": f"Bearer {child_token}",
    })
    data = resp.json()
    assert data["xp"] == 100
    assert data["level"] == 2
    assert data["level_name"] == "Starter"


def test_progress_percent_shows_partial_progress(client):
    parent_token, child_token, child_id = _setup_family_with_child(client)

    # 50 XP into level 1, which needs 100 to reach level 2 → 50%
    _create_and_approve_task(client, parent_token, child_token, child_id, exbucks=50)

    resp = client.get("/api/gamification/profile", headers={
        "Authorization": f"Bearer {child_token}",
    })
    data = resp.json()
    assert data["level"] == 1
    assert data["progress_percent"] == 50
    assert data["xp_for_next_level"] == 100


def test_streak_increments_when_all_daily_tasks_approved(client):
    parent_token, child_token, child_id = _setup_family_with_child(client)

    # Create two tasks for Monday, approve both
    t1 = client.post("/api/tasks", json={
        "name": "Task 1", "description": "desc", "exbucks": 5,
        "assigned_to": child_id, "day_of_week": "monday",
    }, headers={"Authorization": f"Bearer {parent_token}"}).json()
    t2 = client.post("/api/tasks", json={
        "name": "Task 2", "description": "desc", "exbucks": 5,
        "assigned_to": child_id, "day_of_week": "monday",
    }, headers={"Authorization": f"Bearer {parent_token}"}).json()

    # Complete and approve first task — streak should not increment yet
    client.patch(f"/api/tasks/{t1['id']}/accept", headers={"Authorization": f"Bearer {child_token}"})
    client.patch(f"/api/tasks/{t1['id']}/complete", headers={"Authorization": f"Bearer {child_token}"})
    client.patch(f"/api/tasks/{t1['id']}/approve", headers={"Authorization": f"Bearer {parent_token}"})

    resp = client.get("/api/gamification/profile", headers={"Authorization": f"Bearer {child_token}"})
    assert resp.json()["streak"] == 0

    # Complete and approve second task — now all monday tasks approved, streak = 1
    client.patch(f"/api/tasks/{t2['id']}/accept", headers={"Authorization": f"Bearer {child_token}"})
    client.patch(f"/api/tasks/{t2['id']}/complete", headers={"Authorization": f"Bearer {child_token}"})
    client.patch(f"/api/tasks/{t2['id']}/approve", headers={"Authorization": f"Bearer {parent_token}"})

    resp = client.get("/api/gamification/profile", headers={"Authorization": f"Bearer {child_token}"})
    assert resp.json()["streak"] == 1


def test_streak_does_not_increment_for_tasks_without_day(client):
    parent_token, child_token, child_id = _setup_family_with_child(client)

    # Task without day_of_week should not affect streak
    _create_and_approve_task(client, parent_token, child_token, child_id, exbucks=5)

    resp = client.get("/api/gamification/profile", headers={"Authorization": f"Bearer {child_token}"})
    assert resp.json()["streak"] == 0


def test_streak_increments_only_once_per_day(client):
    parent_token, child_token, child_id = _setup_family_with_child(client)

    # Complete all monday tasks
    t1 = client.post("/api/tasks", json={
        "name": "Mon task", "description": "d", "exbucks": 5,
        "assigned_to": child_id, "day_of_week": "monday",
    }, headers={"Authorization": f"Bearer {parent_token}"}).json()
    client.patch(f"/api/tasks/{t1['id']}/accept", headers={"Authorization": f"Bearer {child_token}"})
    client.patch(f"/api/tasks/{t1['id']}/complete", headers={"Authorization": f"Bearer {child_token}"})
    client.patch(f"/api/tasks/{t1['id']}/approve", headers={"Authorization": f"Bearer {parent_token}"})

    # Complete all tuesday tasks on same day
    t2 = client.post("/api/tasks", json={
        "name": "Tue task", "description": "d", "exbucks": 5,
        "assigned_to": child_id, "day_of_week": "tuesday",
    }, headers={"Authorization": f"Bearer {parent_token}"}).json()
    client.patch(f"/api/tasks/{t2['id']}/accept", headers={"Authorization": f"Bearer {child_token}"})
    client.patch(f"/api/tasks/{t2['id']}/complete", headers={"Authorization": f"Bearer {child_token}"})
    client.patch(f"/api/tasks/{t2['id']}/approve", headers={"Authorization": f"Bearer {parent_token}"})

    # Both day groups completed on same calendar day → streak should be 1, not 2
    resp = client.get("/api/gamification/profile", headers={"Authorization": f"Bearer {child_token}"})
    assert resp.json()["streak"] == 1


def test_parent_cannot_access_gamification_profile(client):
    parent_token, _child_token, _child_id = _setup_family_with_child(client)

    resp = client.get("/api/gamification/profile", headers={
        "Authorization": f"Bearer {parent_token}",
    })
    assert resp.status_code == 403


def test_multi_level_progression_and_progress_resets(client):
    parent_token, child_token, child_id = _setup_family_with_child(client)

    # 300 XP → level 3 (threshold: 100 + 200 = 300). Progress into level 3 = 0%.
    _create_and_approve_task(client, parent_token, child_token, child_id, name="t1", exbucks=300)

    resp = client.get("/api/gamification/profile", headers={"Authorization": f"Bearer {child_token}"})
    data = resp.json()
    assert data["xp"] == 300
    assert data["level"] == 3
    assert data["level_name"] == "Rookie"
    assert data["progress_percent"] == 0
    assert data["xp_for_next_level"] == 300  # level 3 needs 300 XP to reach level 4

    # Add 150 more XP → 450 total, still level 3 (need 600 for level 4). Progress = 150/300 = 50%.
    _create_and_approve_task(client, parent_token, child_token, child_id, name="t2", exbucks=150)

    resp = client.get("/api/gamification/profile", headers={"Authorization": f"Bearer {child_token}"})
    data = resp.json()
    assert data["xp"] == 450
    assert data["level"] == 3
    assert data["progress_percent"] == 50
