# CBT Software — Claude Code Context

## Project Overview
Full-stack Computer-Based Testing platform for Nigerian secondary schools.
Multi-tenant (schools), role-based (Super Admin → School Admin → Teacher → Student).

**Live URLs**
- Frontend: https://cbtsoftware-cbt-app.vercel.app
- Backend: https://cbtsoftware.onrender.com
- Database: Supabase (PostgreSQL) — no RLS, application-layer access control

---

## Monorepo Structure

```
cbtsoftware/
├── artifacts/
│   ├── cbt-app/          # React 19 + Vite frontend (Vercel)
│   └── api-server/       # Node.js + Express backend (Render)
├── lib/
│   ├── db/               # Drizzle ORM schema + Supabase connection
│   ├── api-client-react/ # TanStack React Query hooks
│   └── api-zod/          # Zod validation schemas
└── pnpm-workspace.yaml
```

**Package manager:** pnpm (workspaces)
**Build order:** db → api-zod → api-server

---

## Commands

```bash
# Install all workspace deps
pnpm install

# Run frontend dev server
cd artifacts/cbt-app && pnpm dev

# Run backend dev server
cd artifacts/api-server && pnpm dev

# Build all packages (in order)
pnpm run build

# Run DB migrations (Drizzle)
cd lib/db && pnpm drizzle-kit push

# Lint
pnpm lint
```

---

## Tech Stack

**Frontend** (`artifacts/cbt-app`)
- React 19 + Vite + TypeScript
- Tailwind CSS v4
- Wouter (routing — NOT React Router)
- TanStack React Query (server state)
- Framer Motion (animations)
- SheetJS (bulk uploads)
- vite-plugin-pwa (offline/PWA)

**Backend** (`artifacts/api-server`)
- Node.js + Express + TypeScript
- Drizzle ORM (type-safe queries)
- express-session (cookie auth — NOT JWT)
- CORS configured for frontend domain

**Storage / DB**
- Supabase PostgreSQL (via DATABASE_URL)
- Supabase Storage buckets: `question-images`, `school-logos`, `student-images`, `profile-pictures`
- All buckets are public

---

## Architecture Rules

### Auth
- Cookie-based sessions (`httpOnly`, `secure`, `sameSite=none` in prod)
- Session stored in memory on backend (`req.session.userId`)
- `app.set('trust proxy', 1)` required for Render deployment
- Role enum: `super_admin | school_admin | teacher | student`
- Passwords are plain text in DB (⚠️ known issue — do NOT hash without migration plan)

### Multi-tenancy
- Every resource scoped by `school_code` (FK to `schools.code`)
- Super admin has no `school_code` — can access all schools
- Always validate `school_code` matches session user before mutating data

### API Structure
- All routes under `/api/`
- Schools: `/api/schools/:schoolCode/...`
- Auth: `/api/auth/login|logout|me`

### Database (Drizzle)
- Schema files in `lib/db/src/schema/`
- Key tables: `schools`, `users`, `exams`, `questions`, `results`, `result_answers`, `subject_scores`, `grading_schemes`, `subjects`
- No cascade deletes at DB level — handle in application layer
- `subject_scores` is the source of truth for final grades (mid_term + class_activity + exam → total out of 100)

### Grading Logic
```
cbtScaled = (correctAnswers / totalQuestions) * componentCbtMax
finalScore = cbtScaled + theoryScore
percentage = (finalScore / componentTotal) * 100
```
Grade boundaries configurable per school via `grading_schemes` table.
Theory/activity scores are LOCKED after entry (returns 403 on edit attempt).

### Question Groups
- Questions with same `group_id` stay together (not individually shuffled)
- Groups themselves are shuffled as blocks
- `group_image_url` shown once before first question in group
- `group_order` defines order within a group

---

## Frontend Conventions

- Components live in `src/components/` (reusable) and `src/pages/` (route-level)
- Auth context in `src/lib/auth.tsx`
- Supabase client in `src/lib/supabase.ts`
- Use TanStack React Query for ALL server state — no raw fetch in components
- Animations via Framer Motion — keep subtle
- Mobile-first: min touch target 44px, `overflow-x-auto` on all tables
- Sidebar: fixed on desktop (w-72 expanded, w-20 collapsed), hidden on mobile (hamburger)
- Modals: full-screen on mobile

---

## Backend Conventions

- Each route file handles one resource domain
- Always check `req.session.userId` before any DB operation
- Return `401` for unauthenticated, `403` for unauthorized, `404` for not found
- Denormalize `full_name` and `class` into `results` table (intentional — for result history integrity)
- `POST /:examId/submit` handles auto-grading inline — do not move this to a queue

---

## Environment Variables

**Frontend** (`.env`)
```
VITE_API_URL=https://cbtsoftware.onrender.com/api
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

**Backend** (`.env`)
```
DATABASE_URL=
PORT=8080
NODE_ENV=production
ADMIN_USER=
ADMIN_PASS=
SESSION_SECRET=
```

---

## Known Issues / Tech Debt

- Passwords stored as plain text — needs bcrypt migration before scaling
- No DB-level RLS — access control is 100% application-layer
- Sessions in-memory — will reset on Render free-tier restart (consider Redis)
- No rate limiting on auth endpoints
- No Zod validation on all routes (partial coverage)

---

## What NOT to do

- Do NOT switch routing library from Wouter to React Router without full audit
- Do NOT add RLS to Supabase without a full auth migration plan (will break everything)
- Do NOT modify `result_answers` schema — it's intentionally denormalized for result integrity
- Do NOT add optimistic updates to exam submission — must be server-confirmed
- Do NOT store exam answers anywhere except `localStorage` during active exam (by design for offline support)
- Do NOT change `sameSite=none` cookie config without testing cross-origin auth

---

## Deployment Notes

- **Frontend** deploys to Vercel automatically on push to main
- **Backend** deploys to Render (free tier — cold starts ~30s)
- `vercel.json` in `artifacts/cbt-app/` handles SPA rewrites
- Render requires `trust proxy` setting for secure cookies to work

---

## Current Term / Session Logic
- `schools.current_term`: "First Term" | "Second Term" | "Third Term"
- `schools.current_academic_session`: e.g., "2025/2026"
- New session start: promotes all students one class, deletes SSS3 graduates, resets to First Term
- Student exams filtered by `class` + `current_term` — always respect both filters
