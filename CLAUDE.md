# ExSize — Developer Notes

## Running commands

This project uses **uv** for Python package management. Always use `uv run` to execute tools.

```bash
# Run tests
uv run pytest tests/ -x

# Run server
uv run uvicorn exsize.app:app --reload

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
