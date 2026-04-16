import os

os.environ.setdefault("ADMIN_SECRET", "test-admin-secret")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from exsize.database import Base
from exsize.models import AppSetting, AvatarItem, User
from exsize.app import _seed_admin, _seed_app_settings, _seed_avatar_items


def _make_db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


class TestSeedAdmin:
    def test_creates_admin_user(self):
        db = _make_db()
        _seed_admin(db)

        admin = db.query(User).filter(User.role == "admin").first()
        assert admin is not None
        assert admin.email == "admin@exsize.app"
        assert admin.role == "admin"
        assert admin.language == "en"

    def test_does_not_duplicate_on_second_call(self):
        db = _make_db()
        _seed_admin(db)
        _seed_admin(db)

        admins = db.query(User).filter(User.role == "admin").all()
        assert len(admins) == 1


class TestSeedAppSettings:
    def test_creates_max_exbucks_setting(self):
        db = _make_db()
        _seed_app_settings(db)

        setting = db.query(AppSetting).filter(AppSetting.key == "max_exbucks_per_task").first()
        assert setting is not None
        assert setting.value == "50"

    def test_does_not_duplicate_on_second_call(self):
        db = _make_db()
        _seed_app_settings(db)
        _seed_app_settings(db)

        settings = db.query(AppSetting).filter(AppSetting.key == "max_exbucks_per_task").all()
        assert len(settings) == 1


class TestSeedAvatarItems:
    def test_creates_16_items(self):
        db = _make_db()
        _seed_avatar_items(db)

        items = db.query(AvatarItem).all()
        assert len(items) == 16

    def test_creates_8_icons_and_8_backgrounds(self):
        db = _make_db()
        _seed_avatar_items(db)

        icons = db.query(AvatarItem).filter(AvatarItem.type == "icon").all()
        backgrounds = db.query(AvatarItem).filter(AvatarItem.type == "background").all()
        assert len(icons) == 8
        assert len(backgrounds) == 8

    def test_includes_free_defaults(self):
        db = _make_db()
        _seed_avatar_items(db)

        free_icon = db.query(AvatarItem).filter(AvatarItem.type == "icon", AvatarItem.price == 0).first()
        free_bg = db.query(AvatarItem).filter(AvatarItem.type == "background", AvatarItem.price == 0).first()
        assert free_icon is not None
        assert free_icon.value == "👤"
        assert free_bg is not None
        assert free_bg.value == "#F48FB1"

    def test_all_items_are_default_and_active(self):
        db = _make_db()
        _seed_avatar_items(db)

        items = db.query(AvatarItem).all()
        assert all(item.is_default for item in items)
        assert all(item.active_in_shop for item in items)

    def test_does_not_duplicate_on_second_call(self):
        db = _make_db()
        _seed_avatar_items(db)
        _seed_avatar_items(db)

        items = db.query(AvatarItem).all()
        assert len(items) == 16


class TestLifespanIntegration:
    def test_startup_seeds_all_data(self):
        db = _make_db()
        _seed_admin(db)
        _seed_app_settings(db)
        _seed_avatar_items(db)

        assert db.query(User).filter(User.role == "admin").count() == 1
        assert db.query(AppSetting).filter(AppSetting.key == "max_exbucks_per_task").count() == 1
        assert db.query(AvatarItem).count() == 16

    def test_public_settings_returns_seeded_data(self):
        from fastapi.testclient import TestClient
        from exsize.app import app
        from exsize.database import get_db

        test_engine = create_engine("sqlite:///test_seed.db", connect_args={"check_same_thread": False})
        Session = sessionmaker(bind=test_engine)
        Base.metadata.create_all(bind=test_engine)

        db = Session()
        _seed_app_settings(db)
        db.close()

        def override_get_db():
            s = Session()
            try:
                yield s
            finally:
                s.close()

        app.dependency_overrides[get_db] = override_get_db
        client = TestClient(app)

        client.post("/api/auth/register", json={
            "email": "parent@test.com", "password": "pass123", "role": "parent",
        })
        token = client.post("/api/auth/login", json={
            "email": "parent@test.com", "password": "pass123",
        }).json()["access_token"]

        resp = client.get("/api/admin/settings/public", headers={
            "Authorization": f"Bearer {token}",
        })
        assert resp.status_code == 200
        assert resp.json()["max_exbucks_per_task"] == 50

        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=test_engine)

        import os
        try:
            os.remove("test_seed.db")
        except FileNotFoundError:
            pass
