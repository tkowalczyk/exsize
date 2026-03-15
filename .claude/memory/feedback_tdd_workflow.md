---
name: TDD with issue numbers
description: User wants to invoke /tdd with GitHub issue numbers to drive development
type: feedback
---

User will run `/tdd <github_issue_number>` to start TDD on a specific feature. The argument is the GH issue number, not the plan phase number.

**Why:** User explicitly said "i will run tdd skill with gh issue number"
**How to apply:** When `/tdd N` is received, fetch issue #N from GitHub for acceptance criteria and context, then follow the TDD workflow against those criteria.
