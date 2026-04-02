import os

os.environ.setdefault("ADMIN_SECRET", "test-admin-secret")

from exsize.database import get_db
from exsize.models import AvatarItem, User, UserInventory


def _seed_avatars(client):
    """Trigger avatar seeding by accessing DB after app startup."""
    db = next(client.app.dependency_overrides[get_db]())
    from exsize.app import _seed_avatar_items
    _seed_avatar_items(db)
    return db


def _register_and_login(client, email="parent@test.com", password="pass123", role="parent"):
    client.post("/api/auth/register", json={"email": email, "password": password, "role": role})
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    return resp.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _setup_family_with_child(client):
    db = _seed_avatars(client)
    parent_token = _register_and_login(client, "parent@test.com", "pass123", "parent")
    family = client.post("/api/family", headers=_auth(parent_token)).json()
    child_token = _register_and_login(client, "child@test.com", "pass123", "child")
    client.post("/api/family/join", json={"pin": family["pin"]}, headers=_auth(child_token))
    members = client.get("/api/family", headers=_auth(parent_token)).json()["members"]
    child_id = next(m["id"] for m in members if m["role"] == "child")
    return parent_token, child_token, child_id, db


def test_seed_creates_16_avatar_items(client):
    db = _seed_avatars(client)
    items = db.query(AvatarItem).all()
    assert len(items) == 16


def test_seed_creates_7_icons_and_7_backgrounds_plus_2_free(client):
    db = _seed_avatars(client)
    icons = db.query(AvatarItem).filter(AvatarItem.type == "icon").all()
    backgrounds = db.query(AvatarItem).filter(AvatarItem.type == "background").all()
    assert len(icons) == 8  # 7 + 1 free default
    assert len(backgrounds) == 8  # 7 + 1 free default


def test_seed_has_two_free_defaults(client):
    db = _seed_avatars(client)
    free = db.query(AvatarItem).filter(AvatarItem.price == 0, AvatarItem.is_default == True).all()
    assert len(free) == 2
    types = {item.type for item in free}
    assert types == {"icon", "background"}


def test_seed_is_idempotent(client):
    db = _seed_avatars(client)
    from exsize.app import _seed_avatar_items
    _seed_avatar_items(db)
    items = db.query(AvatarItem).all()
    assert len(items) == 16


def test_seed_icons_have_escalating_prices(client):
    db = _seed_avatars(client)
    icons = db.query(AvatarItem).filter(
        AvatarItem.type == "icon", AvatarItem.price > 0
    ).order_by(AvatarItem.price).all()
    assert len(icons) == 7
    prices = [i.price for i in icons]
    assert prices == sorted(prices)
    assert prices[0] > 0


def test_seed_all_items_marked_default_and_active(client):
    db = _seed_avatars(client)
    items = db.query(AvatarItem).all()
    assert all(item.is_default for item in items)
    assert all(item.active_in_shop for item in items)


# --- Default assignment on child join ---


def test_child_gets_default_items_in_inventory_on_join(client):
    _, _, child_id, db = _setup_family_with_child(client)
    inventory = db.query(UserInventory).filter(UserInventory.user_id == child_id).all()
    assert len(inventory) == 2
    item_ids = {inv.avatar_item_id for inv in inventory}
    free_items = db.query(AvatarItem).filter(AvatarItem.price == 0, AvatarItem.is_default == True).all()
    assert item_ids == {item.id for item in free_items}


def test_child_has_defaults_equipped_on_join(client):
    _, _, child_id, db = _setup_family_with_child(client)
    child = db.query(User).filter(User.id == child_id).first()
    free_icon = db.query(AvatarItem).filter(AvatarItem.type == "icon", AvatarItem.price == 0, AvatarItem.is_default == True).first()
    free_bg = db.query(AvatarItem).filter(AvatarItem.type == "background", AvatarItem.price == 0, AvatarItem.is_default == True).first()
    assert child.equipped_icon_id == free_icon.id
    assert child.equipped_background_id == free_bg.id


def _admin_login(client):
    db = next(client.app.dependency_overrides[get_db]())
    from exsize.app import _seed_admin
    _seed_admin(db)
    resp = client.post("/api/auth/admin-login", json={"admin_secret": "test-admin-secret"})
    return resp.json()["access_token"]


# --- Admin CRUD ---


def test_admin_creates_avatar_item(client):
    _seed_avatars(client)
    token = _admin_login(client)
    resp = client.post("/api/avatar/items", json={
        "type": "icon",
        "value": "🐱",
        "label": "Cat",
        "price": 25,
    }, headers=_auth(token))
    assert resp.status_code == 201
    data = resp.json()
    assert data["type"] == "icon"
    assert data["value"] == "🐱"
    assert data["label"] == "Cat"
    assert data["price"] == 25
    assert data["is_default"] is False
    assert data["active_in_shop"] is True


def test_admin_edits_avatar_item(client):
    db = _seed_avatars(client)
    token = _admin_login(client)
    item = db.query(AvatarItem).first()
    resp = client.patch(f"/api/avatar/items/{item.id}", json={
        "label": "Updated Label",
        "price": 999,
    }, headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["label"] == "Updated Label"
    assert data["price"] == 999


def test_admin_soft_deletes_avatar_item(client):
    db = _seed_avatars(client)
    token = _admin_login(client)
    item = db.query(AvatarItem).first()
    resp = client.delete(f"/api/avatar/items/{item.id}", headers=_auth(token))
    assert resp.status_code == 200
    db.refresh(item)
    assert item.active_in_shop is False


def test_soft_deleted_item_stays_in_inventory(client):
    parent_token, child_token, child_id, db = _setup_family_with_child(client)
    admin_token = _admin_login(client)
    # Get the free default icon (which child has in inventory)
    free_icon = db.query(AvatarItem).filter(AvatarItem.type == "icon", AvatarItem.price == 0).first()
    # Soft-delete it
    resp = client.delete(f"/api/avatar/items/{free_icon.id}", headers=_auth(admin_token))
    assert resp.status_code == 200
    # Child still has it in inventory
    inventory = db.query(UserInventory).filter(
        UserInventory.user_id == child_id,
        UserInventory.avatar_item_id == free_icon.id,
    ).first()
    assert inventory is not None


def test_admin_edit_active_in_shop(client):
    db = _seed_avatars(client)
    token = _admin_login(client)
    item = db.query(AvatarItem).first()
    resp = client.patch(f"/api/avatar/items/{item.id}", json={
        "active_in_shop": False,
    }, headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["active_in_shop"] is False


def test_parent_does_not_get_default_items_on_join(client):
    db = _seed_avatars(client)
    parent_token = _register_and_login(client, "p2@test.com", "pass123", "parent")
    # Parent creates family — no inventory should be assigned
    client.post("/api/family", headers=_auth(parent_token))
    parent = db.query(User).filter(User.email == "p2@test.com").first()
    inventory = db.query(UserInventory).filter(UserInventory.user_id == parent.id).all()
    assert len(inventory) == 0


# --- Auth guards ---


def test_parent_cannot_create_avatar_item(client):
    _seed_avatars(client)
    token = _register_and_login(client, "guard@test.com", "pass123", "parent")
    resp = client.post("/api/avatar/items", json={
        "type": "icon", "value": "🐱", "label": "Cat", "price": 25,
    }, headers=_auth(token))
    assert resp.status_code == 403


def test_child_cannot_edit_avatar_item(client):
    db = _seed_avatars(client)
    token = _register_and_login(client, "kidguard@test.com", "pass123", "child")
    item = db.query(AvatarItem).first()
    resp = client.patch(f"/api/avatar/items/{item.id}", json={"label": "Hacked"}, headers=_auth(token))
    assert resp.status_code == 403


def test_child_cannot_delete_avatar_item(client):
    db = _seed_avatars(client)
    token = _register_and_login(client, "kidguard2@test.com", "pass123", "child")
    item = db.query(AvatarItem).first()
    resp = client.delete(f"/api/avatar/items/{item.id}", headers=_auth(token))
    assert resp.status_code == 403


# --- Parent sees child's avatar ---


def test_parent_sees_child_equipped_avatar(client):
    parent_token, child_token, child_id, db = _setup_family_with_child(client)
    resp = client.get(f"/api/avatar/equipped/{child_id}", headers=_auth(parent_token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["icon"]["value"] == "👤"
    assert data["background"]["value"] == "#F48FB1"


# --- Shop, Purchase, Equip ---


def _give_child_exbucks(db, child_id, amount):
    from exsize.models import User
    child = db.query(User).filter(User.id == child_id).first()
    child.exbucks_balance = amount
    db.commit()


def test_shop_returns_active_items(client):
    _seed_avatars(client)
    child_token = _register_and_login(client, "shopkid@test.com", "pass123", "child")
    resp = client.get("/api/avatar/shop", headers=_auth(child_token))
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 16
    assert all(item["active_in_shop"] for item in items)


def test_inventory_returns_owned_items(client):
    _, child_token, child_id, db = _setup_family_with_child(client)
    resp = client.get("/api/avatar/inventory", headers=_auth(child_token))
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 2


def test_purchase_avatar_item(client):
    _, child_token, child_id, db = _setup_family_with_child(client)
    _give_child_exbucks(db, child_id, 100)
    # Find a non-free icon to buy
    icon = db.query(AvatarItem).filter(AvatarItem.type == "icon", AvatarItem.price > 0).order_by(AvatarItem.price).first()
    resp = client.post(f"/api/avatar/purchase/{icon.id}", headers=_auth(child_token))
    assert resp.status_code == 200
    # Check balance deducted
    child = db.query(User).filter(User.id == child_id).first()
    db.refresh(child)
    assert child.exbucks_balance == 100 - icon.price
    # Check item in inventory
    inv_resp = client.get("/api/avatar/inventory", headers=_auth(child_token))
    assert len(inv_resp.json()) == 3  # 2 defaults + 1 purchased


def test_purchase_insufficient_balance(client):
    _, child_token, child_id, db = _setup_family_with_child(client)
    _give_child_exbucks(db, child_id, 0)
    icon = db.query(AvatarItem).filter(AvatarItem.type == "icon", AvatarItem.price > 0).first()
    resp = client.post(f"/api/avatar/purchase/{icon.id}", headers=_auth(child_token))
    assert resp.status_code == 400


def test_purchase_inactive_item_rejected(client):
    _, child_token, child_id, db = _setup_family_with_child(client)
    _give_child_exbucks(db, child_id, 1000)
    icon = db.query(AvatarItem).filter(AvatarItem.type == "icon", AvatarItem.price > 0).first()
    icon.active_in_shop = False
    db.commit()
    resp = client.post(f"/api/avatar/purchase/{icon.id}", headers=_auth(child_token))
    assert resp.status_code == 400


def test_equip_owned_item(client):
    _, child_token, child_id, db = _setup_family_with_child(client)
    _give_child_exbucks(db, child_id, 100)
    icon = db.query(AvatarItem).filter(AvatarItem.type == "icon", AvatarItem.price > 0).order_by(AvatarItem.price).first()
    client.post(f"/api/avatar/purchase/{icon.id}", headers=_auth(child_token))
    resp = client.post(f"/api/avatar/equip/{icon.id}", headers=_auth(child_token))
    assert resp.status_code == 200
    child = db.query(User).filter(User.id == child_id).first()
    db.refresh(child)
    assert child.equipped_icon_id == icon.id


def test_equip_unowned_item_rejected(client):
    _, child_token, child_id, db = _setup_family_with_child(client)
    icon = db.query(AvatarItem).filter(AvatarItem.type == "icon", AvatarItem.price > 0).first()
    resp = client.post(f"/api/avatar/equip/{icon.id}", headers=_auth(child_token))
    assert resp.status_code == 400


def test_unequip_reverts_to_default(client):
    _, child_token, child_id, db = _setup_family_with_child(client)
    resp = client.post("/api/avatar/unequip/icon", headers=_auth(child_token))
    assert resp.status_code == 200
    child = db.query(User).filter(User.id == child_id).first()
    db.refresh(child)
    free_icon = db.query(AvatarItem).filter(AvatarItem.type == "icon", AvatarItem.price == 0, AvatarItem.is_default == True).first()
    assert child.equipped_icon_id == free_icon.id
