# ExSize — Developer Notes

## Running commands

This project uses **uv** for Python package management. Always use `uv run` to execute tools.

```bash
# Run tests
uv run pytest tests/ -x

# Run server (--app-dir src is required for --reload to work on macOS)
uv run uvicorn --app-dir src exsize.app:app --reload

# Add a dependency
uv add <package>

# Sync dependencies
uv sync
```

**Do NOT** use `.venv/bin/pytest`, `.venv/bin/uvicorn`, or bare `pytest`/`uvicorn` — they cause `ModuleNotFoundError` due to `.pth` files not being processed in uvicorn's `--reload` subprocess on macOS.

## Database

SQLite with SQLAlchemy. `Base.metadata.create_all()` only creates new tables — it does **not** migrate existing ones. After any schema change, delete `exsize.db` and restart the server.

Browse the database in a web UI:

```bash
uvx datasette exsize.db
```

## Deployment

Backend is deployed on **Render** (free tier). Database is **Neon PostgreSQL**.

- Render dashboard: the service auto-deploys from `main` branch
- Environment variables on Render: `DATABASE_URL` (Neon connection string), `CORS_ORIGINS`, `PORT`
- Cold starts on free tier take ~30s — the frontend shows a "server is waking up" message after 3s
