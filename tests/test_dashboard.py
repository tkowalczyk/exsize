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


DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _create_and_approve_task(client, parent_token, child_token, child_id, name="Do pushups", exbucks=5, day_of_week=None):
    task = client.post("/api/tasks", json={
        "name": name, "description": "desc", "exbucks": exbucks,
        "assigned_to": child_id, "day_of_week": day_of_week,
    }, headers={"Authorization": f"Bearer {parent_token}"}).json()
    client.patch(f"/api/tasks/{task['id']}/accept", headers={"Authorization": f"Bearer {child_token}"})
    client.patch(f"/api/tasks/{task['id']}/complete", headers={"Authorization": f"Bearer {child_token}"})
    client.patch(f"/api/tasks/{task['id']}/approve", headers={"Authorization": f"Bearer {parent_token}"})
    return task


def test_parent_dashboard_empty(client):
    parent_token, _child_token, child_id = _setup_family_with_child(client)

    resp = client.get("/api/dashboard", headers={
        "Authorization": f"Bearer {parent_token}",
    })

    assert resp.status_code == 200
    data = resp.json()

    # Per-child stats
    assert len(data["children"]) == 1
    child = data["children"][0]
    assert child["id"] == child_id
    assert child["email"] == "child@example.com"
    assert child["tasks_completed_percent"] == 0
    assert child["streak"] == 0
    assert child["exbucks_earned"] == 0
    assert child["exbucks_spent"] == 0

    # Weekly overview has all 7 days, all empty
    assert list(data["weekly_overview"].keys()) == DAYS
    for day in DAYS:
        assert data["weekly_overview"][day] == []


def test_dashboard_task_completion_percent(client):
    parent_token, child_token, child_id = _setup_family_with_child(client)

    # Create 2 tasks, approve only 1
    _create_and_approve_task(client, parent_token, child_token, child_id, name="Task A", exbucks=5)
    client.post("/api/tasks", json={
        "name": "Task B", "description": "desc", "exbucks": 5, "assigned_to": child_id,
    }, headers={"Authorization": f"Bearer {parent_token}"})

    resp = client.get("/api/dashboard", headers={
        "Authorization": f"Bearer {parent_token}",
    })

    assert resp.status_code == 200
    child = resp.json()["children"][0]
    assert child["tasks_completed_percent"] == 50


def test_dashboard_shows_child_streak(client):
    parent_token, child_token, child_id = _setup_family_with_child(client)

    # Approve a task with day_of_week to trigger streak increment
    _create_and_approve_task(client, parent_token, child_token, child_id,
                             name="Monday task", exbucks=5, day_of_week="Monday")

    resp = client.get("/api/dashboard", headers={
        "Authorization": f"Bearer {parent_token}",
    })

    assert resp.status_code == 200
    child = resp.json()["children"][0]
    assert child["streak"] == 1


def test_dashboard_exbucks_earned_and_spent(client):
    parent_token, child_token, child_id = _setup_family_with_child(client)

    # Earn via tasks
    _create_and_approve_task(client, parent_token, child_token, child_id, name="Task 1", exbucks=20)
    _create_and_approve_task(client, parent_token, child_token, child_id, name="Task 2", exbucks=30)

    # Spend via reward purchase
    admin_token = _register_and_login(client, email="admin@example.com", role="admin")
    reward = client.post("/api/rewards", json={
        "name": "Sticker", "description": "Cool sticker", "price": 10,
    }, headers={"Authorization": f"Bearer {admin_token}"}).json()
    client.post(f"/api/rewards/{reward['id']}/purchase", headers={
        "Authorization": f"Bearer {child_token}",
    })

    resp = client.get("/api/dashboard", headers={
        "Authorization": f"Bearer {parent_token}",
    })

    assert resp.status_code == 200
    child = resp.json()["children"][0]
    assert child["exbucks_earned"] == 50
    assert child["exbucks_spent"] == 10


def test_dashboard_weekly_overview(client):
    parent_token, child_token, child_id = _setup_family_with_child(client)

    # 2 Monday tasks: approve 1, leave 1 assigned
    _create_and_approve_task(client, parent_token, child_token, child_id,
                             name="Mon A", exbucks=5, day_of_week="Monday")
    client.post("/api/tasks", json={
        "name": "Mon B", "description": "desc", "exbucks": 5,
        "assigned_to": child_id, "day_of_week": "Monday",
    }, headers={"Authorization": f"Bearer {parent_token}"})

    # 1 Wednesday task: approved
    _create_and_approve_task(client, parent_token, child_token, child_id,
                             name="Wed A", exbucks=5, day_of_week="Wednesday")

    resp = client.get("/api/dashboard", headers={
        "Authorization": f"Bearer {parent_token}",
    })

    data = resp.json()
    monday = data["weekly_overview"]["Monday"]
    assert len(monday) == 1
    assert monday[0]["child_id"] == child_id
    assert monday[0]["total"] == 2
    assert monday[0]["approved"] == 1

    wednesday = data["weekly_overview"]["Wednesday"]
    assert len(wednesday) == 1
    assert wednesday[0]["total"] == 1
    assert wednesday[0]["approved"] == 1

    # Days without tasks are empty
    assert data["weekly_overview"]["Tuesday"] == []
    assert data["weekly_overview"]["Sunday"] == []


def test_dashboard_multi_child(client):
    parent_token = _register_and_login(client, email="parent@example.com")
    family = client.post("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()

    # Need SizePass-style family: free tier limits 1 child, but let's test with what we can.
    # Register first child and join
    child1_token = _register_and_login(client, email="child1@example.com", role="child")
    client.post("/api/family/join", json={"pin": family["pin"]}, headers={
        "Authorization": f"Bearer {child1_token}",
    })

    members = client.get("/api/family", headers={"Authorization": f"Bearer {parent_token}"}).json()["members"]
    child1_id = next(m["id"] for m in members if m["email"] == "child1@example.com")

    # Give child1 a task
    _create_and_approve_task(client, parent_token, child1_token, child1_id,
                             name="Child1 task", exbucks=10, day_of_week="Monday")

    resp = client.get("/api/dashboard", headers={
        "Authorization": f"Bearer {parent_token}",
    })

    data = resp.json()
    assert len(data["children"]) == 1
    assert data["children"][0]["id"] == child1_id
    assert data["children"][0]["exbucks_earned"] == 10

    # Monday overview shows child1
    monday = data["weekly_overview"]["Monday"]
    assert len(monday) == 1
    assert monday[0]["child_id"] == child1_id


def test_child_cannot_access_dashboard(client):
    _parent_token, child_token, _child_id = _setup_family_with_child(client)

    resp = client.get("/api/dashboard", headers={
        "Authorization": f"Bearer {child_token}",
    })

    assert resp.status_code == 403


def test_parent_without_family_gets_400(client):
    parent_token = _register_and_login(client, email="solo@example.com")

    resp = client.get("/api/dashboard", headers={
        "Authorization": f"Bearer {parent_token}",
    })

    assert resp.status_code == 400
