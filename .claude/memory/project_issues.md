---
name: GitHub Issues Map
description: ExSize MVP GitHub issues (#1-#12), their dependencies, and mapping to phases
type: project
---

GitHub issues map to plan phases. User will invoke `/tdd <issue_number>` to work on each.

| Issue | Title | Blocked by |
|-------|-------|------------|
| #1 | PRD | — |
| #2 | Auth: Registration & Login | None |
| #3 | Family: Creation, PIN & Member Management | #2 |
| #4 | Tasks: Create, Assign, Complete & Approve | #3 |
| #5 | ExBucks: Balance, Credits & Transaction History | #4 |
| #6 | Reward Shop: Admin Catalog & Child Purchase | #5 |
| #7 | Tasks: Weekly Plans, Edit/Delete, Accept/Reject & Penalties | #5 |
| #8 | Gamification: XP, Levels & Streaks | #5 |
| #9 | Player Profile Page | #8 |
| #10 | Parent Dashboard & Statistics | #7, #8 |
| #11 | SizePass: Subscription & Feature Gating (Stripe) | #9, #10 |
| #12 | Account Deletion & GDPR Compliance | #3 |

**Why:** User confirmed they'll run TDD skill with GH issue numbers, so this mapping is needed to quickly understand scope and dependencies.
**How to apply:** When `/tdd N` is invoked, look up issue #N for acceptance criteria and blocked-by chain.
