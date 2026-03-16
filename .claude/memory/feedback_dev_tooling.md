---
name: Dev tooling commands
description: How to run pytest, uvicorn, and other tools in this repo — use uv run prefix
type: feedback
---

Project uses **uv** for Python package management. Always use `uv run` to run tools.

- Run tests: `uv run pytest tests/ -x`
- Run server: `uv run uvicorn exsize.app:app --reload`
- Add dependency: `uv add <package>`
- Sync deps: `uv sync`

**Why:** The old `.venv/bin/` approach broke with uvicorn `--reload` on macOS — `.pth` files weren't processed in spawned subprocesses, causing `ModuleNotFoundError: No module named 'exsize'`. Switching to uv + hatchling build backend fixed this.
**How to apply:** Never use `.venv/bin/pytest` or `.venv/bin/uvicorn` directly. Always prefix with `uv run`.
