---
name: Dev tooling commands
description: How to run pytest, uvicorn, and other tools in this repo — use .venv/bin/ prefix
type: feedback
---

Always use `.venv/bin/pytest` and `.venv/bin/uvicorn` to run tools. There is no global `python`, `pytest`, or `uv` on this machine.

**Why:** `python -m pytest`, `pytest`, and `uv run pytest` all fail. Only `.venv/bin/pytest` works.
**How to apply:** Prefix all CLI tool invocations with `.venv/bin/` (e.g. `.venv/bin/pytest tests/ -x`, `.venv/bin/uvicorn exsize.app:app --reload`).
