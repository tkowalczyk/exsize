# Plan: ExSize MVP

> Source PRD: [GitHub Issue #1](https://github.com/tkowalczyk/exsize/issues/1)

## Architectural decisions

Durable decisions that apply across all phases:

- **Architecture style**: Web application (SPA + API). MVP is web-only; iOS planned post-MVP.
- **Data model key entities**: User (parent/child/admin roles), Family, Task, WeeklyPlan, Transaction (ExBucks ledger), Reward, Badge, Subscription.
- **Authentication**: Email/password + Google/Apple OAuth. Session-based or token-based auth. Per-account language preference (PL/EN).
- **Authorization model**: Role-based — Admin (platform-wide reward management), Parent (family management, task CRUD, approvals), Child (task completion, reward purchase).
- **Family structure**: Family has a unique PIN code. Free tier: max 2 parents + 1 child. SizePass: unlimited members.
- **Economy**: ExBucks is the single virtual currency. XP = ExBucks earned. Cannot be purchased with real money. Cannot be traded between children.
- **Reward catalog**: System-wide, managed by admin. Same catalog for all families. Fixed prices in ExBucks.
- **Gamification**: 50 levels with progressive XP thresholds. Streaks based on consecutive days of 100% task completion. Badges: 1 on Free, many on SizePass (unlocked at level milestones).
- **Monetization**: SizePass subscription (monthly/annual). No ads, no pay-to-win.
- **Infrastructure budget**: Zero — all services must run on free tiers.
- **Internationalization**: Polish + English from day one, per-account language selection.
- **GDPR**: Full account deletion with cascading data removal. Special handling for minors under 16.
- **Privacy**: No public child profiles. No inter-family communication. No ExBucks trading.

---

## Phase 1: Auth

**User stories**: 1, 2, 3

### What to build

End-to-end authentication flow: a registration page where a user signs up via email/password or Google/Apple sign-in, a login page, and a settings page where the user can switch their preferred language (PL/EN). After login, the user lands on an empty dashboard shell (placeholder for future phases). The user role (parent/child) is selected during registration. Language preference is stored per account and applied to the entire UI.

### Acceptance criteria

- [ ] User can register with email/password
- [ ] User can register and log in with Google sign-in
- [ ] User can register and log in with Apple sign-in
- [ ] User selects role (parent or child) during registration
- [ ] User can set language preference (PL or EN) in settings
- [ ] Language preference persists across sessions and switches all UI text
- [ ] Authenticated user sees a dashboard shell; unauthenticated user is redirected to login

---

## Phase 2: Family Setup

**User stories**: 7, 8, 9, 10, 11

### What to build

Family creation and membership flow. When a parent registers (or after first login if no family exists), they can create a family, which generates a unique PIN code displayed to the parent. A child (or second parent) enters this PIN during registration to join the family. The parent sees a family management page listing all members with their roles. The parent can remove a child from the family. Free tier limits are enforced: max 2 parents, max 1 child (SizePass gating is a placeholder flag for now — actual payment comes in Phase 10).

### Acceptance criteria

- [ ] Parent can create a family and receives a unique PIN code
- [ ] PIN code is displayed on the family management page
- [ ] Child can join a family by entering the PIN during registration
- [ ] Second parent can join the family using the same PIN
- [ ] Family management page shows all members with roles
- [ ] Parent can remove a child from the family
- [ ] Free tier enforces max 2 parents and 1 child (additional members blocked with upgrade prompt)

---

## Phase 3: Task Lifecycle

**User stories**: 12, 14, 17, 18, 20

### What to build

Core task loop end-to-end. Parent creates a one-time task (name, description, ExBucks value) and assigns it to a specific child. The child sees their task list for today. The child marks a task as completed (checkbox). The parent sees pending tasks awaiting approval and can approve or reject each one. Approved tasks are marked as done; rejected tasks return to the child's list. No ExBucks are credited yet (that comes in Phase 4) — this phase focuses on the task state machine.

### Acceptance criteria

- [ ] Parent can create a one-time task with name, description, and ExBucks value
- [ ] Parent can assign a task to a specific child in the family
- [ ] Child sees their assigned tasks for today
- [ ] Child can mark a task as completed
- [ ] Parent sees a list of tasks pending approval
- [ ] Parent can approve a completed task (status → done)
- [ ] Parent can reject a completed task (status → back to assigned)
- [ ] Task states are clearly visible: assigned → completed (pending review) → approved/rejected

---

## Phase 4: ExBucks Economy

**User stories**: 22, 24, 25

### What to build

Wire ExBucks into the task approval flow. When a parent approves a task, the child's ExBucks balance increases by the task's value. A transaction is recorded in the ledger. The child sees their current balance prominently in the UI. The parent can view a full transaction history per child (earned, spent, penalties — though spending and penalties come in later phases, the ledger structure supports all types from the start).

### Acceptance criteria

- [ ] Child's ExBucks balance increases when a parent approves a task
- [ ] A transaction record is created for each approval (type: earned, amount, task reference, timestamp)
- [ ] Child sees their current ExBucks balance on their main view
- [ ] Parent can view transaction history for each child
- [ ] Transaction history shows type, amount, description, and timestamp
- [ ] Balance is accurate and reflects all transactions

---

## Phase 5: Reward Shop

**User stories**: 26, 27, 28, 29, 30, 31

### What to build

Admin-managed reward catalog and child purchase flow. An admin panel (accessible only to the platform admin) allows creating, editing, and removing rewards (name, description, ExBucks price). All families see the same catalog. A child browses available rewards and purchases one instantly if they have enough ExBucks — no parent approval needed. ExBucks are deducted, a transaction is recorded, and the purchase appears in the child's purchase history. The parent can see all reward purchases across their children.

### Acceptance criteria

- [x] Admin can create a reward with name, description, and ExBucks price
- [x] Admin can edit and remove rewards
- [x] All children across all families see the same reward catalog
- [x] Child can browse rewards and see prices
- [x] Child can purchase a reward if ExBucks balance is sufficient
- [x] Purchase is instant — ExBucks deducted immediately, transaction recorded
- [x] Purchase is blocked with clear message if balance is insufficient
- [x] Child sees their purchase history
- [x] Parent sees all reward purchases across their children

---

## Phase 6: Weekly Plans & Task Controls

**User stories**: 13, 15, 16, 21, 23

### What to build

Extend the task engine with weekly planning, full task editing, and penalties. Parent can create a weekly plan by assigning tasks to specific days of the week for a child. Parent can edit any task at any time (name, description, value, assignment) and delete tasks. Child can accept or reject an assigned task. Parent can assign negative ExBucks (penalties) to a child — this creates a negative transaction in the ledger and reduces the child's balance.

### Acceptance criteria

- [ ] Parent can create a weekly plan by assigning tasks to specific days (Mon–Sun)
- [ ] Child sees their weekly plan organized by day
- [ ] Parent can edit any task at any time (name, description, ExBucks value, assigned child)
- [ ] Parent can delete any task at any time
- [ ] Child can accept an assigned task
- [ ] Child can reject an assigned task (parent is notified)
- [ ] Parent can assign negative ExBucks (penalty) to a child with a reason
- [ ] Penalty creates a negative transaction and reduces balance
- [ ] Balance can go below zero from penalties

---

## Phase 7: Gamification Core

**User stories**: 32, 33, 34, 35

### What to build

XP accumulation, level progression, and streak tracking. When a task is approved, XP equal to the ExBucks value is added to the child's profile. The child progresses through 50 levels with increasing XP thresholds. The child sees their current level, XP, and progress bar to the next level. Streak counter tracks consecutive days where the child completed all assigned tasks. Missing a day resets the streak to zero. Streak is visible on the child's main view.

### Acceptance criteria

- [ ] XP is credited equal to ExBucks value when a task is approved
- [ ] Child progresses through 50 levels with increasing XP thresholds
- [ ] Child sees current level number, XP count, and progress bar to next level
- [ ] Level names/titles are displayed for each level
- [ ] Streak counter increments for each consecutive day with 100% task completion
- [ ] Streak resets to zero when child misses completing all tasks for a day
- [ ] Current streak count is visible on the child's main view

---

## Phase 8: Player Profile

**User stories**: 39, 40

### What to build

A dedicated, game-like profile page for the child. Displays level, XP with progress bar, current streak, earned badges (just the Freemium badge for Free users at this point — SizePass badges come in Phase 10), and transaction/purchase history. The profile should feel rewarding and engaging — visual emphasis on achievements and progress. Only visible to the child themselves and their parents.

### Acceptance criteria

- [ ] Child has a dedicated profile page accessible from main navigation
- [ ] Profile shows current level with title, XP, and progress to next level
- [ ] Profile shows current streak count
- [ ] Profile shows earned badges (Freemium badge for Free users)
- [ ] Profile shows transaction history (earned, spent, penalties)
- [ ] Profile is visually game-like and engaging
- [ ] Profile is only visible to the child and their parents (not other families)

---

## Phase 9: Parent Dashboard

**User stories**: 41, 42

### What to build

A dashboard for parents showing per-child statistics and a weekly overview. For each child: percentage of tasks completed this week, current streak, total ExBucks earned and spent. A weekly overview showing task completion across all children in a calendar-like view so the parent can spot trends (e.g., which days are weakest).

### Acceptance criteria

- [ ] Parent sees a dashboard as their main view after login
- [ ] Dashboard shows per-child stats: % tasks completed, current streak, ExBucks earned/spent
- [ ] Dashboard shows a weekly overview of task completion across all children
- [ ] Weekly overview is organized by day, making trends visible
- [ ] Dashboard updates in real-time as tasks are approved/rejected
- [ ] Dashboard handles single-child (Free) and multi-child (SizePass) families

---

## Phase 10: SizePass & Feature Gating

**User stories**: 9, 10, 19, 36, 37, 38, 43, 44, 45, 46, 47

### What to build

Subscription management and premium feature gating. Parent can subscribe to SizePass (monthly or annual plan) through a payment gateway. Upon subscription: family member limits are lifted (unlimited children and parents), child can attach photos as proof of task completion, SizePass badges are unlocked at level milestones, sibling leaderboard becomes available, and parent gets advanced statistics on the dashboard. Parent can manage (view plan, cancel) their subscription. Feature gating checks subscription status before allowing access to premium features. Cancellation maintains access until end of billing period.

### Acceptance criteria

- [ ] Parent can subscribe to SizePass (monthly or annual plan)
- [ ] Payment processes successfully through payment gateway
- [ ] SizePass removes family member limits (unlimited children and parents)
- [ ] Child on SizePass can attach photos as proof of task completion
- [ ] SizePass badges unlock at level milestones
- [ ] Sibling leaderboard is visible for SizePass families with multiple children
- [ ] Parent on SizePass sees advanced statistics on dashboard
- [ ] Parent can view current plan details and cancel subscription
- [ ] Cancellation maintains access until end of current billing period
- [ ] Free users see upgrade prompts when attempting premium features

---

## Phase 11: Account Management & GDPR

**User stories**: 4, 5, 6

### What to build

Full account deletion flows compliant with GDPR. Parent can delete a child's account — this removes the child from the family and permanently deletes all their data (tasks, transactions, badges, profile). Parent can delete their own account — if they are the last parent in the family, all family data is deleted (including children's data with appropriate notice). Child can request account deletion — for children under 16, the request goes to the parent for approval. All deletions are permanent and irreversible, with a confirmation step and clear warning.

### Acceptance criteria

- [ ] Parent can delete a child's account from family management
- [ ] Deleting a child's account removes all their data (tasks, transactions, badges, profile, photos)
- [ ] Parent can delete their own account
- [ ] If last parent is deleted, all family data is cascaded (with warning and confirmation)
- [ ] Child can request account deletion
- [ ] For children under 16, deletion request requires parent approval
- [ ] All deletions show a clear warning and require confirmation
- [ ] Deleted data is permanently removed and not recoverable
- [ ] Deletion is reflected immediately in family membership and all related views
