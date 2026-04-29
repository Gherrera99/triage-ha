# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hospital triage management system for emergency rooms. Manages the full patient flow: nursing triage → cashier payment → doctor consultation → admin reporting.

**Stack:** Vue 3 + Pinia + Vite (frontend), Node.js + Express + Prisma + Socket.io (backend), MySQL 8, Docker Compose.

## Development Commands

All development runs via Docker Compose. There is no local dev setup — everything runs in containers.

**Environment files (NOT in git):**
- `/.env` — root, used by `docker-compose.yml` for `MYSQL_ROOT_PASSWORD` and `MYSQL_PASSWORD`. Copy from `.env.example`.
- `/api/.env` — API config: `JWT_SECRET`, `DATABASE_URL`, `CORS_ORIGIN`, `PORT`. Copy from `api/.env.example`.
- `/web/.env` — frontend Vite vars (optional). Copy from `web/.env.example`.

```bash
# Start all services (requires .env files in place)
docker compose up -d --build

# First-time database setup
docker compose exec mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "GRANT ALL PRIVILEGES ON *.* TO 'triage'@'%' WITH GRANT OPTION; FLUSH PRIVILEGES;"
docker compose exec api npx prisma generate
docker compose exec api npx prisma migrate dev --name init
docker compose exec api npx prisma db seed

# After image rebuild (--build) you must regenerate the Prisma client
docker compose exec api npx prisma generate
docker compose restart api

# Run a new migration after schema changes
docker compose exec api npx prisma migrate dev --name <migration_name>

# Type-check (clean baseline expected)
docker compose exec api npx tsc --noEmit
docker compose exec web npx vue-tsc --noEmit

# View logs
docker compose logs -f api
docker compose logs -f web
```

**Access points:**
- Web UI: `http://localhost:5173`
- API: `http://localhost:3000`
- Adminer (DB UI): `http://localhost:8080`

**Default credentials (all users):** `Admin123*`
- `admin@hospital.local`, `triage@hospital.local`, `caja@hospital.local`, `doctor@hospital.local`

## Architecture

### Monorepo Structure
- `api/` — Express + TypeScript backend, port 3000
- `web/` — Vue 3 + TypeScript frontend, port 5173

### Backend (`api/src/`)

Pattern: `routes/` → `controllers/` → `prisma.ts` (single Prisma client instance)

- **Auth:** JWT tokens. Middleware lives in `middleware/auth.ts` only — exposes `requireAuth` and `requireRole(...roles)` (variadic, e.g. `requireRole("ADMIN", "CONSULTOR")`).
- **Async errors:** controllers without try/catch are wrapped in routes with `utils/asyncHandler.ts`. A global error middleware in `server.ts` catches anything that escapes and returns JSON.
- **Typed request user:** `req.user` and Socket.io `socket.user` are typed via `types/express.d.ts` and `types/socket.d.ts` — do NOT use `(req as any).user`.
- **Real-time:** Socket.io via `socket.ts` — notifies roles when patient state changes (e.g., paid → ready for doctor). Events: `triage:new`, `triage:updated`, `payment:paid`, `consultation:started`, `consultation:finished`, `report:updated`, `admin:updated`. The flow is **triage → caja → médico** — the doctor only learns of a patient via `payment:paid`, never on `triage:new`.
- **PDF generation:** `services/pdf/` using PDFKit. Assets (logos) in `api/src/assets/pdf/`.
- **Excel reports:** generated inline in `controllers/admin.reports.ctrl.ts` via ExcelJS — single endpoint `/admin-reports/attended-excel` with all columns.
- **Domain utilities:** `utils/triage.utils.ts` — `normalizeExpediente`, `isConsulta`, `slaMinutes` (VERDE:45, AMARILLO:30, ROJO:15). Reuse from here, do not duplicate.

### Frontend (`web/src/`)

Each role has its own Pinia store and view. The stores are large and contain most business logic.

| Role | View | Store |
|------|------|-------|
| NURSE_TRIAGE | `TriageNurseView.vue` | `triageNurse.ts` |
| CASHIER | `CashierView.vue` | `cashier.ts` |
| DOCTOR | `DoctorDashboardView.vue`, `DoctorConsultView.vue` | `doctor.ts` |
| ADMIN | `AdminDashboard.vue`, `AdminUsersView.vue` | `adminReports.ts`, `adminUsers.ts` |

- Router (`router/index.ts`) enforces role-based access; unauthenticated users redirect to `/login`
- `services/api.ts` — Axios instance with JWT interceptor (single source — there is no `api/http.ts` anymore)
- `services/socket.ts` + `composables/useSocket.ts` — Socket.io for real-time updates
- `services/speechAlert.ts` — Web Speech API singleton for "Nuevo paciente en espera" voice alerts. `primeSpeech()` is called from `LoginView` (user gesture required); `startKeepAlive()`/`stopKeepAlive()` mounted by Cashier and Doctor views to keep Windows SAPI warm.
- `utils/triage.ts` — frontend mirror of backend triage utilities (e.g., `slaMinutes`)

### Database (Prisma + MySQL)

Core flow: `Patient` → `TriageRecord` → `Payment` → `MedicalNote`

Key `TriageRecord` fields:
- `paidStatus`: PENDING | PAID
- `closedAt` + `closedReason`: `CASHIER_FINISHED` (paid, motivo no-CONSULTA) | `REFUSED_PAYMENT` (cashier refused) | `NO_SHOW` (doctor marked no-show) | `DOCTOR_FINISHED` (consultation completed)
- `refusedPayment`, `noShow`, `noShowReason`, `noShowAt`, `noShowDoctorId` — patient disposition tracking

**Closure is enforced server-side and atomic:**
- `finishConsultation` updates `MedicalNote.consultationFinishedAt` AND `TriageRecord.{closedAt, closedReason="DOCTOR_FINISHED"}` in a single `prisma.$transaction`.
- `payTriage`, `refusePayment`, `markNoShow`, `startConsultation`, `upsertNote` all guard against operating on triages that are already closed (`closedAt`, `refusedPayment`, or `noShow`) — they return HTTP 409 to prevent contradictory state.

`MedicalNote` has a `vigilanciaTexto` field (free text, replaces an older checkbox JSON structure that was dropped in migration `20260312185936_vigilancia_texto`).

## Key Conventions

- **Language:** UI text, field names, and comments are in Spanish (medical domain). Commit messages are also in Spanish, descriptive (not conventional commits).
- **Roles:** NURSE_TRIAGE, CASHIER, DOCTOR, ADMIN, CONSULTOR — enforced via `requireRole(...roles)` middleware on all protected routes. Variadic, NOT array.
- **Patient age:** Stored as a string (`age` field on `Patient`) to support "X años Y meses" format.
- **Timezone:** All date filters and PDFs use Mérida (`America/Merida`, UTC-06:00). When parsing date inputs in controllers, use ISO strings with explicit offset (e.g. `new Date(\`${date}T00:00:00-06:00\`)`) — never `setHours()` (applies UTC inside the container).
- **Migrations:** Located in `api/prisma/migrations/` — always run inside the `api` container.
- **No mocking the database in tests:** integration with a real Prisma instance only.
- **Sensitive config never committed:** `.env` files are gitignored. Secrets are documented in `.env.example` files at repo root, `api/`, and `web/`.
