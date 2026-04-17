def test_docs_endpoint_returns_200(client):
    """FastAPI interactive docs are accessible at /docs."""
    resp = client.get("/docs")
    assert resp.status_code == 200
    assert "swagger" in resp.text.lower() or "openapi" in resp.text.lower()


def test_public_settings_returns_seeded_data(client):
    """Public settings endpoint returns seeded data after startup."""
    from exsize.app import app, _seed_app_settings
    from exsize.database import get_db

    db = next(app.dependency_overrides[get_db]())
    _seed_app_settings(db)

    from tests.test_admin_settings import _register_and_login
    token = _register_and_login(client)

    resp = client.get("/api/admin/settings/public", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert "max_exbucks_per_task" in resp.json()


def test_cors_allows_configured_origin(client):
    """CORS middleware allows origin from CORS_ORIGINS env var."""
    resp = client.options(
        "/api/admin/settings/public",
        headers={
            "Origin": "https://exsize.pages.dev",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.headers.get("access-control-allow-origin") == "https://exsize.pages.dev"


def test_cors_rejects_unknown_origin(client):
    """When CORS_ORIGINS is set, unknown origins are rejected."""
    resp = client.options(
        "/api/admin/settings/public",
        headers={
            "Origin": "https://evil.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.headers.get("access-control-allow-origin") != "https://evil.com"
