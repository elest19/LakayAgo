# Copilot Handoff

This document captures the complete context required for a new Copilot Chat to continue backend integration work for the `lakay-ago` repository. It is written for an AI coding assistant and assumes the assistant will inspect the repository before making edits.

---

## 1. PROJECT OVERVIEW

- Project: `lakay-ago`
- Purpose: A multi-restaurant operations dashboard (attendance, payroll, inventory, sales, expenses, reports) used by restaurant staff and admins.
- Intended users: restaurant Admin / SuperAdmin / Staff users.
- Frontend: Next.js (App Router present), React, TypeScript. Legacy UI components live in `legacy-pages/` and are mounted by `App.tsx`.
- Backend/runtime: Next.js API routes (serverless functions) running on Vercel.
- Database: Supabase PostgreSQL (Supabase schema provided by user in the chat — authoritative SQL schema included in conversation). Database is expected to be hosted in Supabase.
- Authentication approach (current implementation): Custom backend-managed accounts stored in `users` table; passwords hashed with bcrypt; session tokens are HMAC-signed and stored in HttpOnly cookies. The repo currently implements a minimal auth API.
- Deployment/hosting: Frontend and API are intended for Vercel; database hosted in Supabase.
- Important libraries added/used in repo: `@supabase/supabase-js`, `bcryptjs`, `next`, `react`, `react-dom`, `xlsx`, `lucide-react`, `recharts`.
- External services: Supabase (Postgres). Vercel for hosting.

Files of interest (top-level):
- `package.json` — scripts and dependencies.
- `App.tsx` — main client app that mounts legacy pages and contains global app context.
- `legacy-pages/` — existing UI pages and forms (Login, Employees, Attendance import, Payroll, Inventory, Sales, etc.).
- `lib/` — server helpers recently added (`supabaseServer.ts`, `auth.ts`).
- `app/api/` — server API routes (currently `auth/login` and `auth/me`).

---

## 2. CURRENT ARCHITECTURE

Overview:
- Frontend: Single Next.js app using client-side `App.tsx` which mounts many `legacy-pages/*` components. The UI is already complete and functional using local state and mock data.
- Backend: Next.js API route endpoints under `app/api/*`. Server code is expected to run on Vercel serverless functions.
- Database: Supabase PostgreSQL (schema provided by the user). Backend talks to Supabase using the server-side `service_role` key via `@supabase/supabase-js`.

Important frontend files and why they matter (examples):
- `App.tsx` — central UI; provides `AppContext` with app state and functions such as `transferToKitchen`, `kitchenSelfProduce`, and stores mock inventories and stock.
- `legacy-pages/Login.tsx` — initial login UI. It originally used a stubbed local flow; it now calls `/api/auth/login` to authenticate.
- `legacy-pages/ImportAttendance.tsx` and `utils/fingerprintAttendanceParser.ts` — frontend Excel import functionality and parser. The frontend already reads Excel files and performs client-side processing.
- `legacy-pages/Employees.tsx` — employees UI (uses local/mock data currently).
- `data/mockData.ts` — initial mock records used across the UI.

Important backend/server files:
- `lib/supabaseServer.ts` — server-side Supabase client factory (uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from environment variables). This client MUST only be used server-side.
- `lib/auth.ts` — minimal HMAC-signed session helpers (`signSession`, `verifySession`) and TTL constants. Uses `SESSION_SECRET`.
- `app/api/auth/login/route.ts` — POST login route. Uses `supabaseServer` to select user by email, verifies password via `bcryptjs.compare`, signs session token, sets HttpOnly `session` cookie.
- `app/api/auth/me/route.ts` — GET route to read `session` cookie and return user data.

How frontend communicates with backend:
- The frontend uses Fetch in `Login.tsx` to call `/api/auth/login`. Other pages currently use mock data and local state; no standard data fetching abstraction exists yet.

How backend communicates with Supabase/Postgres:
- Via `lib/supabaseServer.ts` using the service role key.

Security/middleware:
- No global middleware implemented yet. Session verification is done per-route using `lib/auth.ts` token verification (cookie parsing inside each route).
- `SUPABASE_SERVICE_ROLE_KEY` is expected to be server-only. The code and documentation emphasize it must not be exposed to the client.


---

## 3. DATABASE / SQL CONTEXT

NOTE: The authoritative SQL schema was provided in the conversation (very detailed). The schema is not stored in the repository files; it must be applied to the Supabase database externally. The schema includes:

High-level modules:
- Restaurants
- Users
- Employees
- Leave types, employee leave balances, leave requests
- Deductions/deduction types
- Report periods
- Attendance
- Audit logs
- Expenses
- Production stock
- Kitchen stock
- Inventory (linked inventory may reference kitchen_stock)
- Inventory display view `inventory_display`
- Sales
- Stock transactions with triggers (`set_stock_transaction_restaurant`) that derive `restaurants_id` and enforce transfer product name equality

Important database features and constraints (taken from SQL schema):
- Passwords in `users.password` MUST store bcrypt hashes (no plaintext).
- `inventory` table enforces that `category = 'Menu Item'` must have a `kitchen_id` and that linked inventory rows derive `name` and `stock` from `kitchen_stock`.
- `stock_transactions` must follow strict checks for `TRANSFER`, `SELF_PRODUCE`, `SALE` combinations and rely on trigger `trg_set_stock_transaction_restaurant` which populates `restaurants_id` based on destination side.
- The SQL schema seeds the two restaurants: `Aroo` and `Lakay Ago`.
- The schema enables Row Level Security (RLS) on all application tables but does not create policies (intentional). The architecture expects backend to use the service role key and handle authorization.

Views, functions, triggers:
- `inventory_display` view: resolves `name` and `stock` from linked `kitchen_stock` when applicable.
- Function `set_stock_transaction_restaurant()` and trigger `trg_set_stock_transaction_restaurant` to derive `restaurants_id` and enforce transfer product equality.

Indexes and constraints: the schema includes many indexes (employees by restaurant, attendance indexes, sales indexes, unique constraints such as `unique (restaurant_id, source_employee_id)` in `employees`, and generated/stored columns in `sales` for `gross_amount` and `net_amount`).

Important: CURRENT IMPLEMENTATION vs PLANNED
- CURRENT in repo: the SQL schema file is only present in conversation text (not a SQL file checked into repo). No migration / DB client code to run SQL in repo.
- PLANNED: apply the provided SQL to Supabase and use `lib/supabaseServer.ts` for server-side DB operations.
- NEEDS VERIFICATION: whether the Supabase project has the schema applied — UNKNOWN.


---

## 4. AUTHENTICATION AND SECURITY

Current implementation (in repo):
- Login route: `app/api/auth/login/route.ts`.
  - Accepts `{ email, password }` JSON.
  - Queries `users` table via Supabase using `supabaseServer.from('users').select(...).eq('email', email)`.
  - Verifies bcrypt password using `bcryptjs.compare`.
  - Signs an HMAC session token using `lib/auth.ts::signSession(payload)` and sets it as an HttpOnly cookie named `session`.
- Current session mechanism: stateless HMAC-signed token stored in HttpOnly cookie.
  - `lib/auth.ts` signs JSON payload (including `user_id`, `role`, `restaurant_id`) and includes `iat`/`exp` claims.
  - TTL currently 7 days (configurable in `lib/auth.ts`).
- Current `me` route: `app/api/auth/me/route.ts` reads `session` cookie, verifies it using `verifySession`, and returns user data from `users` table.

Password hashing/storage:
- Repo uses `bcryptjs` for comparison in login. Creation of users (registration) is not implemented in server routes yet. The `users` table in the SQL schema requires bcrypt-hashed passwords.

Secrets & environment variables (do NOT expose):
- `SUPABASE_SERVICE_ROLE_KEY` — must be server-only and never prefixed with `NEXT_PUBLIC_`.
- `SUPABASE_URL` — Supabase project URL.
- `SESSION_SECRET` — HMAC secret used for session tokens.

Storage of auth state: HttpOnly cookie `session`.

Authorization and roles:
- Roles defined at DB level: `Admin`, `SuperAdmin`, `Staff` (enforced in `users.role` check constraint in SQL schema).
- SuperAdmin may not be associated with a single restaurant.
- Backend is responsible for authorization and restaurant scoping — do not rely on frontend-only checks.

RLS & Supabase usage:
- The supplied SQL schema enables RLS, but does not add policies (intentional). The backend is expected to use the `service_role` key which bypasses RLS. If the app ever lets browsers talk to Supabase directly, policies must be added.


---

## 5. CURRENT FEATURES (IMPLEMENTED IN REPO)

Note: "Implemented" here refers to code present in the repository, not necessarily connected to the database.

### Global / App shell
- Main client app `App.tsx` with navigation, context (`AppContext`), toast system, global state placeholders (inventory, production, kitchen stock, sales, expenses).

### Authentication
- Login UI: `legacy-pages/Login.tsx` — now calls `/api/auth/login`.
- Server auth endpoints implemented: `app/api/auth/login` and `app/api/auth/me`.

### Inventory / Production / Kitchen (frontend-only)
- UI pages present under `legacy-pages`:
  - `InventoryCatalog.tsx`
  - `ProductionCatalog.tsx`
  - `KitchenCatalog.tsx`
- `App.tsx` holds mock production and kitchen stock arrays and in-memory functions for `transferToKitchen`, `kitchenSelfProduce`, and `sellMenuItem`.

### Attendance / Payroll / Leave (frontend-only)
- `ImportAttendance.tsx`, `ImportHistory.tsx`, `AttendanceRecords.tsx` present in `legacy-pages` and use `utils/fingerprintAttendanceParser.ts` for Excel parsing.
- Payroll pages exist in `legacy-pages` (PayrollPeriods, ProcessPayroll, Payslips) but backend support for payroll processing is not implemented.

### Sales & Expenses (frontend-only)
- `Sales.tsx`, `SalesSummary.tsx`, and `Expenses.tsx` exist in `legacy-pages` and use mock data.

### Audit Logs
- `AuditLogs.tsx` exists (frontend). Backend audit logging is not implemented (TODO).

---

## 6. RECENT CHANGES (THIS CONVERSATION)

All changes made in this conversation are included here. No code changes will be made further in this document.

1. Add server Supabase client
   - Files added:
     - `lib/supabaseServer.ts`
   - Purpose: central server-only Supabase client using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

2. Add simple session helpers
   - Files added:
     - `lib/auth.ts`
   - Purpose: sign/verify minimal HMAC-signed session tokens stored in HttpOnly cookie `session`. Uses `SESSION_SECRET`.
   - Decisions: use builtin `crypto` for HMAC, avoid extra JWT libs for now.

3. Implement minimal auth API
   - Files added:
     - `app/api/auth/login/route.ts` (POST)
     - `app/api/auth/me/route.ts` (GET)
   - Behavior: `login` checks `users` table via Supabase client, uses `bcryptjs.compare` to verify password, signs session token and sets cookie. `me` uses cookie to return user row.
   - Notes: these endpoints assume `users` table exists and has bcrypt-hashed passwords.

4. Update frontend login
   - Files changed:
     - `legacy-pages/Login.tsx` — replaced local-stubbed login behavior with a fetch POST to `/api/auth/login` and handles the response (sets UI toast and navigates to dashboard).
   - Decision: minimal frontend change to switch to backend auth for login only.

5. Environment file and docs
   - Files added/changed:
     - `.env.example` (safe placeholders and instructions)
     - `.env.local` (placeholder at repo root; ignored)
     - `.gitignore` updated to allow committing `.env.example` (added `!.env.example`).
     - `README_BACKEND_SETUP.md` added with setup steps and notes.
   - Purpose: document required env vars and keep secrets out of VCS.

Rationale and important decisions made during changes:
- The frontend must not be rewritten. Minimal frontend changes only (login wired to backend).
- `SUPABASE_SERVICE_ROLE_KEY` must remain server-side; backend uses it via `lib/supabaseServer.ts`.
- Session token is stored as HttpOnly cookie `session` to avoid exposing secrets to client.

Files intentionally NOT changed:
- Any `legacy-pages/*` components other than `Login.tsx` (per user rule to minimize frontend changes).
- No database migration SQL was added to repo — SQL schema remains external and authoritative based on conversation.

---

## 7. CURRENT PROBLEMS / BUGS

List of unresolved items and known unknowns as of this conversation:

1. Database schema status
- Problem: The authoritative SQL schema exists in the conversation but is NOT applied to any database from within the repo.
- Expected: Supabase database should contain the provided schema.
- Current: UNKNOWN — requires verification with Supabase project.
- Files involved: none in repo (schema only in chat). Status: Unresolved.

2. Other backend APIs missing
- Problem: Only auth endpoints implemented; other modules (employees, attendance storage, inventory CRUD, sales, stock_transactions, deductions, payroll calculations, audit logging) are not implemented.
- Expected: Backend endpoints must be implemented to map to frontend behavior.
- Current: Not implemented. Files involved: many planned endpoints. Status: Unresolved.

3. Session format & compatibility
- Problem: Custom HMAC session format is implemented; other parts of the app do not yet rely on it.
- Expected: A consistent session verification to be used by all server routes.
- Current: `login` and `me` use it. Status: Partially resolved (needs usage across routes).

4. Frontend still depends on mock data
- Problem: Many UI pages continue to use `data/mockData.ts` and in-memory state in `App.tsx`.
- Expected: Replace or augment these with API calls mapped to the SQL schema.
- Current: Not migrated. Status: Unresolved.

5. TypeScript/build status
- Problem: TypeScript build not run after changes; there may be type or server build issues.
- Expected: Run `npm run build` to verify compilation.
- Current: NOT VERIFIED. Status: Needs verification.

6. Supabase RLS settings
- Problem: the SQL schema enables RLS with zero policies; that is intentional. If any client-side Supabase access is added later, policies must be added.
- Status: Not a bug, but important to keep.


---

## 8. USER REQUIREMENTS AND PREFERENCES

These constraints were explicitly given and must be followed:
- Do NOT rewrite or redesign the existing frontend. Preserve UI, components, styling, animations, layouts, forms, modals, navigation and user workflows.
- Implement backend/database integration to match the provided SQL schema exactly (schema is authoritative).
- Prefer adapting the backend API responses to the existing frontend shapes rather than changing many frontend components.
- Use server-side Supabase client with `service_role` key on the backend only; never expose it to the browser.
- Authentication must remain application-managed (users table), password hashes must be bcrypt.
- RLS should remain enabled in DB; backend uses service role key and is responsible for authorization.
- Do not add unnecessary third-party frameworks or large refactors.
- Respect cross-restaurant inventory relationships (production -> kitchen -> inventory may cross restaurants); do not enforce same-restaurant composite constraints if not in SQL schema.
- Keep stock transaction restaurant ownership logic aligned with the DB trigger rule (trigger derives restaurants_id from destination side).


---

## 9. IMPORTANT BUSINESS LOGIC (must be preserved)

- Restaurants
  - Two seeded restaurants: `Aroo` and `Lakay Ago`.

- Inventory relationships
  - Inventory items of `category = 'Menu Item'` must be linked (`kitchen_id` non-null).
  - Linked Inventory derives `name` and `stock` from `kitchen_stock`.
  - Cross-restaurant relationships allowed: `kitchen_stock` referenced by `inventory` may belong to a different restaurant.

- Stock transactions
  - Types: `TRANSFER` (production -> kitchen), `SELF_PRODUCE` (kitchen internal production), `SALE` (kitchen -> menu).
  - DB trigger `set_stock_transaction_restaurant()` derives `stock_transactions.restaurants_id` from destination side and enforces product equality for TRANSFER.
  - Applications must not attempt to manually assign `restaurants_id` for stock transactions; the trigger overwrites passed values.

- Attendance / Payroll
  - Attendance rows are unique per `(employee_id, work_date)`.
  - `report_periods` represents attendance reporting periods (start/end/tabulation_date).
  - Payroll calculations may be present on the frontend; do not move them to backend unless necessary.

- Authentication & Authorization
  - Passwords must be stored as bcrypt hashes.
  - Roles: `Admin`, `SuperAdmin`, `Staff`.
  - SuperAdmin may have `restaurant_id` null.

- Audit logs
  - Important user actions should be recorded in `audit_logs` with `user_id`, `restaurant_id`, `action`, `table_name`, `record_id`, `old_data`, `new_data`.


---

## 10. IMPORTANT FILES

| File | Purpose | Why it matters |
|---|---|---|
| `App.tsx` | Main client app / context | Central state and UI flow; must not be rewritten. |
| `legacy-pages/*` | UI pages (Login, Employees, Attendance, Inventory, Sales, Payroll, etc.) | Existing UX; backend must adapt to these shapes. |
| `data/mockData.ts` | Mock data used by frontend | Temporarily backs many UIs; will be replaced by API responses. |
| `lib/supabaseServer.ts` | Server-side Supabase client | Centralized DB client using service role — security-critical. |
| `lib/auth.ts` | Session token helpers | Sign/verify sessions; used by API endpoints. |
| `app/api/auth/login/route.ts` | Login endpoint | Auth integration point; uses bcrypt and supabase. |
| `app/api/auth/me/route.ts` | Current user endpoint | Used to verify session and return user info. |
| `.env.example` | Example env vars | Provides names and guidance for required env vars. |
| `.env.local` | Local env placeholders (ignored) | Contains local placeholders — fill with real values. |
| `README_BACKEND_SETUP.md` | Backend setup notes | Quick-start info for next developer. |


---

## 11. ENVIRONMENT VARIABLES

List of environment variables expected by the repo (names only):

- `SUPABASE_URL` — Supabase project URL. (Backend-only)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key. (Backend-only, must never be exposed to client)
- `SESSION_SECRET` — HMAC secret to sign session cookies. (Backend-only)

Notes:
- Do not prefix `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_`.
- `.env.example` and `.env.local` exist at repo root.


---

## 12. DEPLOYMENT

Commands (from `package.json`):
- Development: `npm run dev` (Next dev server on port 8443 as configured)
- Build: `npm run build` (Next build)
- Start (production server): `npm run start` (Next start)

Hosting:
- Frontend and API: Vercel (user stated this; repo is Next.js app)
- Database: Supabase Postgres

Important deployment notes:
- Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET` in Vercel Project Environment Variables (server scope) before deploying.
- Do not put service role key in client-facing env vars.
- Verify the Supabase database has the SQL schema applied before connecting the app.


---

## 13. GIT / REPOSITORY STATE

- Current branch: UNKNOWN (not available to chat). The workspace contains recent changes the assistant made (new files added in this conversation). Verify with local `git status`.
- Files added during this conversation:
  - `lib/supabaseServer.ts`
  - `lib/auth.ts`
  - `app/api/auth/login/route.ts`
  - `app/api/auth/me/route.ts`
  - `.env.local` (placeholder)
  - `.env.example`
  - `README_BACKEND_SETUP.md`
  - `COPILOT_HANDOFF.md` (this file)
- `.gitignore` was updated to include `!.env.example` so the example can be committed while `.env.local` remains ignored.
- No migrations or SQL files were added to the repo — the SQL exists in the chat and should be applied to Supabase manually or via a new migration script.


---

## 14. DECISIONS ALREADY MADE

### Decision
**Decision:** Do not rewrite or redesign the existing frontend. Only make minimal necessary changes to connect backend APIs.
**Reason:** Preserve existing UX and user's investment in frontend workflows.

### Decision
**Decision:** Use server-side Supabase service role key only (backend) and do not expose it to the browser.
**Reason:** Required by security model and the supplied SQL schema; RLS is enabled and backend is trusted.

### Decision
**Decision:** Use a minimal HMAC-signed session token in an HttpOnly cookie rather than adding a full JWT/OAuth system at this time.
**Reason:** Lightweight, easier to integrate quickly; can be swapped for JWT or a stronger system later if requested.

### Decision
**Decision:** Do not add RLS policies or change DB schema in repo; the provided SQL schema is authoritative and should be applied as-is to Supabase.
**Reason:** The SQL schema includes intentional constraints and triggers that must be respected for business logic.


---

## 15. DO NOT BREAK THESE THINGS

List of functionality to preserve exactly:
- The entire UI and workflows in `legacy-pages/*` and the main `App.tsx` — layout, modals, forms, animations, and client-side validation.
- Excel import/parsing logic (`legacy-pages/ImportAttendance.tsx` and `utils/fingerprintAttendanceParser.ts`) — do not rewrite this; connect it to backend only when necessary.
- Inventory cross-restaurant relationship behavior and DB trigger logic — backend must honor the DB trigger for `stock_transactions`.
- Password storage: must remain bcrypt hashes stored in `users.password`.


---

## 16. PENDING WORK

HIGH PRIORITY
- Implement backend APIs that map to the SQL schema for the following modules (one by one):
  - Employees: CRUD, restaurant scoping
  - Attendance: store imported attendance rows, list attendance per period/restaurant
  - Inventory/Production/Kitchen: CRUD, stock mutation endpoints, stock transaction creation (atomic)
  - Sales: endpoint to create sales (respect generated columns `gross_amount`/`net_amount`) and affect stock

MEDIUM PRIORITY
- Leave: leave types, balances, requests, approvals
- Payroll: deductions, deduction types, report periods, payroll processing endpoints (use frontend calculations first unless necessary to move logic server-side)
- Expenses: CRUD and reporting
- Audit logging: create helper to insert rows into `audit_logs` when important actions occur

LOW PRIORITY
- Add tests, TypeScript strictness verification, CI setup
- Add DB migration scripts or track schema in repo


---

## 17. NEXT STEP (exact next development action)

Implement `employees` and `attendance` backend endpoints first. Rationale: many parts of the frontend (attendance import, payroll, leave) depend on employee and attendance data.

What to do next (precise):
1. Inspect `legacy-pages/ImportAttendance.tsx`, `legacy-pages/Employees.tsx`, `legacy-pages/AttendanceRecords.tsx` to understand expected shapes and endpoints. Files to inspect first:
   - `legacy-pages/ImportAttendance.tsx`
   - `legacy-pages/AttendanceRecords.tsx`
   - `legacy-pages/Employees.tsx`
   - `utils/fingerprintAttendanceParser.ts`
2. Implement server routes (Next.js App Router route handlers) under `app/api/`:
   - `app/api/employees/*` — endpoints for list, get, create, update, deactivate/reactivate
   - `app/api/attendance/*` — endpoints to create attendance rows (bulk import), list by period/employee, update
3. Use `lib/supabaseServer.ts` to query/insert into `employees` and `attendance` tables. Validate inputs on server-side and enforce `restaurant_id` scoping using session token payload.
4. Ensure each operation logs to `audit_logs` where appropriate.

Constraints — DO NOT change:
- Do not change UI components unless a small adapter is necessary for API compatibility.
- Use `SESSION_SECRET` cookie-based sessions for authentication and derive `restaurant_id` and role for authorization.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to client.


---

## 18. INSTRUCTIONS FOR THE NEXT COPILOT CHAT

You are continuing development started by a previous Copilot Chat. Read this document fully and inspect the repository before making changes.

Key points to obey before making edits:
- Do not refactor or rewrite `legacy-pages/*` or the `App.tsx` UI.
- The SQL schema provided in the earlier conversation is the authoritative DB schema — apply it to Supabase before assuming it exists.
- Use `lib/supabaseServer.ts` for server-side DB access; it uses the `SUPABASE_SERVICE_ROLE_KEY` which must remain server-only.
- Authentication: use existing `lib/auth.ts` session helpers and `session` HttpOnly cookie. Extend session verification to other API routes you implement.
- Preserve business logic described in Section 9 (inventory rules, stock transaction trigger behavior, payroll/attendance rules).
- If a frontend component expects a specific JSON shape, prefer shaping the API response to match that frontend contract rather than changing the frontend.

Checklist to start work:
1. Confirm `.env.local` contains real values locally and that Vercel has the server env vars set.
2. Confirm the Supabase database has the SQL schema applied. If not, apply schema to Supabase.
3. Implement one backend module at a time (employees → attendance → inventory → sales → payroll → expenses), adding tests and TypeScript validation as you go.
4. Run `npm run build` and fix TypeScript issues before committing.

If anything is unclear or missing from this document, mark the item as `NEEDS VERIFICATION` and query the user or check Supabase directly.


---

# Final notes

- Items marked `UNKNOWN` or `NEEDS VERIFICATION` must be validated before making assumptions (database schema application, current git branch, build status).
- The repository currently contains the minimal backend wiring for auth and a number of frontend legacy pages using mock data. The critical next step is implementing core CRUD APIs and mapping them to the provided SQL schema.


---

(End of handoff)
