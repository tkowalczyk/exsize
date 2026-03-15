---
name: SQLite has no auto-migration
description: SQLAlchemy create_all does not alter existing tables — must delete DB when schema changes
type: feedback
---

`Base.metadata.create_all()` only creates **new** tables. It does NOT add columns to existing tables or modify them. When models change (new columns, new FKs), the dev DB (`exsize.db`) must be deleted and recreated.

**Why:** Hit this in issue #3 — added `Family` model and `User.family_id` FK, but the existing `exsize.db` didn't get updated, causing 500 errors on all endpoints.
**How to apply:** After any model schema change, remind the user to `rm exsize.db` and restart the server. Consider suggesting Alembic if migrations become frequent.
