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


def _setup_family_with_children(client, parent_email="parent@test.com", child_emails=None):
    """Create a family with SizePass and children. Returns (parent_token, [child_tokens], family_id)."""
    if child_emails is None:
        child_emails = ["child1@test.com", "child2@test.com"]
    parent_token = _register_and_login(client, parent_email, role="parent")
    resp = client.post("/api/family", headers={"Authorization": f"Bearer {parent_token}"})
    family = resp.json()
    family_id = family["id"]
    pin = family["pin"]

    # Activate SizePass
    db = next(client.app.dependency_overrides[get_db]())
    db.add(Subscription(family_id=family_id, plan="monthly", status="active"))
    db.commit()

    child_tokens = []
    for email in child_emails:
        token = _register_and_login(client, email, role="child")
        client.post("/api/family/join", json={"pin": pin}, headers={"Authorization": f"Bearer {token}"})
        child_tokens.append(token)

    return parent_token, child_tokens, family_id


def _set_child_fields(client, email, **fields):
    db = next(client.app.dependency_overrides[get_db]())
    user = db.query(User).filter(User.email == email).first()
    for k, v in fields.items():
        setattr(user, k, v)
    db.commit()


# --- Slice 1: streak ---


def test_family_leaderboard_includes_streak(client):
    parent_token, [c1_token, c2_token], _ = _setup_family_with_children(client)
    _set_child_fields(client, "child1@test.com", xp=100, streak=5)
    _set_child_fields(client, "child2@test.com", xp=200, streak=12)

    resp = client.get("/api/leaderboard", headers={"Authorization": f"Bearer {parent_token}"})
    assert resp.status_code == 200
    entries = resp.json()["entries"]
    assert entries[0]["streak"] == 12  # child2 first (more XP)
    assert entries[1]["streak"] == 5


# --- Slice 2: avatar ---


def _equip_avatar(client, email, icon_value="🦊", bg_value="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"):
    """Create avatar items and equip them on a user. Returns (icon_item, bg_item)."""
    db = next(client.app.dependency_overrides[get_db]())
    icon = AvatarItem(type="icon", value=icon_value, label="Fox", price=0, is_default=False, active_in_shop=True)
    bg = AvatarItem(type="background", value=bg_value, label="Purple", price=0, is_default=False, active_in_shop=True)
    db.add_all([icon, bg])
    db.flush()

    user = db.query(User).filter(User.email == email).first()
    # Add to inventory
    db.add(UserInventory(user_id=user.id, avatar_item_id=icon.id))
    db.add(UserInventory(user_id=user.id, avatar_item_id=bg.id))
    # Equip
    user.equipped_icon_id = icon.id
    user.equipped_background_id = bg.id
    db.commit()
    return icon.value, bg.value


def test_family_leaderboard_includes_avatar_data(client):
    parent_token, [c1_token, c2_token], _ = _setup_family_with_children(client)
    icon_val, bg_val = _equip_avatar(client, "child1@test.com")
    _set_child_fields(client, "child1@test.com", xp=100)

    resp = client.get("/api/leaderboard", headers={"Authorization": f"Bearer {parent_token}"})
    assert resp.status_code == 200
    entries = resp.json()["entries"]
    # child1 has avatar equipped
    c1_entry = next(e for e in entries if e["email"] == "child1@test.com")
    assert c1_entry["avatar_icon"] == icon_val
    assert c1_entry["avatar_background"] == bg_val
    # child2 has no avatar
    c2_entry = next(e for e in entries if e["email"] == "child2@test.com")
    assert c2_entry["avatar_icon"] is None
    assert c2_entry["avatar_background"] is None
