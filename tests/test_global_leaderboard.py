import unittest.mock

from exsize.database import get_db
from exsize.models import AvatarItem, Subscription, User, UserInventory


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


def _set_child_xp(client, child_email, xp):
    """Directly set XP on a child in the DB."""
    db = next(client.app.dependency_overrides[get_db]())
    user = db.query(User).filter(User.email == child_email).first()
    user.xp = xp
    db.commit()


# --- Tests ---


def test_global_leaderboard_returns_top_50_sorted_by_xp(client):
    """Create 3 children across 2 families, verify sorted by XP desc."""
    _setup_family_with_child(client, "p1@test.com", "c1@test.com")
    _setup_family_with_child(client, "p2@test.com", "c2@test.com")
    # Add a third child to family 1
    c3_token = _register_and_login(client, "c3@test.com", role="child")
    # Join family 1
    db = next(client.app.dependency_overrides[get_db]())
    family_id = db.query(User).filter(User.email == "c1@test.com").first().family_id
    from exsize.models import Family
    pin = db.query(Family).filter(Family.id == family_id).first().pin
    client.post("/api/family/join", json={"pin": pin}, headers={"Authorization": f"Bearer {c3_token}"})

    _set_child_xp(client, "c1@test.com", 100)
    _set_child_xp(client, "c2@test.com", 300)
    _set_child_xp(client, "c3@test.com", 200)

    resp = client.get("/api/leaderboard/global", headers={
        "Authorization": f"Bearer {c3_token}",
    })
    assert resp.status_code == 200
    data = resp.json()
    entries = data["entries"]
    assert len(entries) == 3
    assert entries[0]["email"] == "c2@test.com"
    assert entries[0]["xp"] == 300
    assert entries[0]["position"] == 1
    assert entries[1]["email"] == "c3@test.com"
    assert entries[1]["xp"] == 200
    assert entries[1]["position"] == 2
    assert entries[2]["email"] == "c1@test.com"
    assert entries[2]["xp"] == 100
    assert entries[2]["position"] == 3
    # user_entry should be None since c3 is in top 50
    assert data["user_entry"] is None


def test_user_outside_top_50_gets_their_position(client):
    """When requesting child is outside top N, user_entry includes their position."""
    # Create one family with one child
    _, child_token = _setup_family_with_child(client, "p@test.com", "child@test.com")
    _set_child_xp(client, "child@test.com", 5)

    # Patch TOP_N to 0 so the child is always "outside"
    with unittest.mock.patch("exsize.routers.leaderboard.TOP_N", 0):
        resp = client.get("/api/leaderboard/global", headers={
            "Authorization": f"Bearer {child_token}",
        })
    assert resp.status_code == 200
    data = resp.json()
    assert data["entries"] == []
    assert data["user_entry"] is not None
    assert data["user_entry"]["email"] == "child@test.com"
    assert data["user_entry"]["xp"] == 5
    assert data["user_entry"]["position"] == 1


def test_global_leaderboard_requires_auth(client):
    resp = client.get("/api/leaderboard/global")
    assert resp.status_code in (401, 403)


def test_global_leaderboard_does_not_require_sizepass(client):
    """Free users (no SizePass) can access global leaderboard."""
    _, child_token = _setup_family_with_child(client, "p@test.com", "c@test.com")
    # No SizePass activated — should still work
    resp = client.get("/api/leaderboard/global", headers={
        "Authorization": f"Bearer {child_token}",
    })
    assert resp.status_code == 200


def test_global_leaderboard_works_without_family(client):
    """A child not in any family can still access global leaderboard."""
    child_token = _register_and_login(client, "solo@test.com", role="child")
    resp = client.get("/api/leaderboard/global", headers={
        "Authorization": f"Bearer {child_token}",
    })
    assert resp.status_code == 200
    # The solo child still appears in the global ranking
    assert len(resp.json()["entries"]) == 1
    assert resp.json()["entries"][0]["email"] == "solo@test.com"


def test_global_leaderboard_includes_streak_and_level(client):
    _, child_token = _setup_family_with_child(client, "p@test.com", "c@test.com")
    db = next(client.app.dependency_overrides[get_db]())
    child = db.query(User).filter(User.email == "c@test.com").first()
    child.xp = 500
    child.level = 3
    child.streak = 7
    db.commit()

    resp = client.get("/api/leaderboard/global", headers={
        "Authorization": f"Bearer {child_token}",
    })
    entry = resp.json()["entries"][0]
    assert entry["streak"] == 7
    assert entry["level"] == 3
    assert entry["xp"] == 500
    # Avatar/nickname are null for now
    assert entry["nickname"] is None
    assert entry["avatar_icon"] is None
    assert entry["avatar_background"] is None


def test_global_leaderboard_handles_fewer_than_50_children(client):
    """With only 2 children, returns exactly 2 entries."""
    _setup_family_with_child(client, "p1@test.com", "c1@test.com")
    _, c2_token = _setup_family_with_child(client, "p2@test.com", "c2@test.com")

    resp = client.get("/api/leaderboard/global", headers={
        "Authorization": f"Bearer {c2_token}",
    })
    assert resp.status_code == 200
    assert len(resp.json()["entries"]) == 2


def test_global_leaderboard_parents_excluded_from_ranking(client):
    """Parents should not appear in the leaderboard entries."""
    parent_token, child_token = _setup_family_with_child(client, "p@test.com", "c@test.com")
    # Set parent XP high
    db = next(client.app.dependency_overrides[get_db]())
    parent = db.query(User).filter(User.email == "p@test.com").first()
    parent.xp = 9999
    db.commit()

    resp = client.get("/api/leaderboard/global", headers={
        "Authorization": f"Bearer {child_token}",
    })
    entries = resp.json()["entries"]
    emails = [e["email"] for e in entries]
    assert "p@test.com" not in emails
    assert "c@test.com" in emails


def test_global_leaderboard_includes_equipped_avatar(client):
    """When a child has equipped avatar items, global leaderboard returns their values."""
    _, child_token = _setup_family_with_child(client, "p@test.com", "c@test.com")
    db = next(client.app.dependency_overrides[get_db]())
    child = db.query(User).filter(User.email == "c@test.com").first()

    # Create and equip avatar items
    icon = AvatarItem(type="icon", value="🦊", label="Fox", price=0, is_default=False, active_in_shop=True)
    bg = AvatarItem(type="background", value="#ff0000", label="Red", price=0, is_default=False, active_in_shop=True)
    db.add_all([icon, bg])
    db.flush()
    db.add(UserInventory(user_id=child.id, avatar_item_id=icon.id))
    db.add(UserInventory(user_id=child.id, avatar_item_id=bg.id))
    child.equipped_icon_id = icon.id
    child.equipped_background_id = bg.id
    db.commit()

    resp = client.get("/api/leaderboard/global", headers={
        "Authorization": f"Bearer {child_token}",
    })
    entry = resp.json()["entries"][0]
    assert entry["avatar_icon"] == "🦊"
    assert entry["avatar_background"] == "#ff0000"
