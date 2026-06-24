# AssetX — Agent Guide

This document orients any AI agent (or new contributor) working in this repository.
It describes **what the project is**, **how it is structured**, and the
**development philosophy** that all changes must follow.

---

## 1. What is AssetX?

AssetX is an **Image Asset Management System**: a Node.js/TypeScript monorepo for
uploading, processing, enriching, and publishing image (and PDF) assets. It is
multi-tenant — assets, members, and settings are scoped to an **Account**, and users
can belong to multiple accounts with per-account roles.

See [docs/PRD.md](./docs/PRD.md) for the full product specification,
[docs/glossary/](./docs/glossary/) for definitions of every system object, and the
`*_PRD_AND_IMPLEMENTATION_PLAN.md` files in [docs/](./docs/) for feature plans.

## 2. Tech stack

| Concern | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Language | TypeScript (strict), Node `>=20` |
| Backend API | Fastify + Prisma (SQLite in dev) |
| Background worker | BullMQ + Redis |
| Frontend | Next.js (App Router, React 19) |
| Image processing | sharp |
| Auth | argon2 password hashing + JWT (rotating refresh tokens) |
| Validation | zod |
| Tests | Vitest |

## 3. Repository layout

```
apps/
  api/      Fastify REST API (auth, accounts, assets, publishing, admin)
  worker/   BullMQ consumers (process-asset, publish-asset)
  web/      Next.js UI (login, signup, gallery, asset detail, admin)
packages/
  shared-types/      Shared DTOs, enums, roles & permissions (source of truth)
  storage/           StorageProvider abstraction + DiskStorageProvider
  image-processing/  ImageProcessor abstraction + SharpImageProcessor
  auth/              Password hashing + JWT TokenService
  publishing/        ChannelPublisher abstraction + channels + registry
  queue/             JobQueue abstraction (BullMQ + in-memory)
docs/
  PRD.md                                      Product spec (v1)
  USERS_PERMISSIONS_PRD_AND_IMPLEMENTATION_PLAN.md
  COMMENTS_ACTIVITY_PRD_AND_IMPLEMENTATION_PLAN.md
  ADMIN_SECTION_PRD_AND_IMPLEMENTATION_PLAN.md
  glossary/                                   One markdown file per system object
```

### Architectural conventions
- **`packages/shared-types` is the single source of truth** for roles, permissions,
  enums, and DTOs. Change it first; apps consume the built `dist/` output.
- **Authorization lives in the service layer**, centralized in
  `apps/api/src/authorization.ts` + `auth-guard.ts`. Routes only wire validation and
  call services; they contain no role logic.
- **Permissions** map from `AccountRole` via `permissionsForAccountRole()`. Super
  users (`globalRole: super_user`) bypass account checks and carry `platform:manage`.
- **Infrastructure is abstracted behind interfaces** (`StorageProvider`,
  `ImageProcessor`, `ChannelPublisher`, `JobQueue`) so implementations can be swapped
  (e.g. disk → S3) without touching business logic.
- **Security**: never trust client-supplied account/user ids — `authGuard`
  re-validates user/membership/account status against the DB. Never expose
  `passwordHash`. Refresh tokens are rotating and revocable.

## 4. Development philosophy: Test-Driven Development (TDD)

**This project is built fully via TDD. It is non-negotiable for all implementation
work.** Follow the **Red → Green → Validate** cycle:

1. **🔴 RED** — Write a failing test that captures the desired behavior. Run it and
   confirm it fails for the right reason.
2. **🟢 GREEN** — Write the minimal code to make the test pass. Nothing more.
3. **🔵 VALIDATE** — Run typecheck + the full/relevant test suite; verify quality and
   that nothing else broke.

### TDD rules
- No production code without a failing test first.
- Write only enough test to fail, and only enough code to pass.
- Keep tests **FIRST**: Fast, Isolated, Repeatable, Self-validating, Timely.
- Prefer editing existing files over creating new ones; keep changes minimal and
  focused.

### Test conventions
- Tests live in a `src/test/` directory within each package/app.
- Integration tests use an isolated SQLite DB + temp storage per test
  (`createTestContext` in `apps/api/src/test/test-helpers.ts`).
- When the Prisma schema changes, also update the raw-SQL schema in `test-helpers.ts`
  and the idempotent backfill in `apps/api/prisma/backfill-accounts.ts`.

## 5. Commands

```bash
# Install
pnpm install

# Build all workspace packages (apps resolve to dist/)
pnpm --filter "./packages/*" build

# Test
pnpm -r test                       # everything
pnpm --filter @assetx/api test     # one workspace
pnpm --filter @assetx/api test auth  # one file/pattern

# Quality gates
pnpm -r typecheck

# Run (3 terminals)
pnpm --filter @assetx/api dev      # http://localhost:3001
pnpm --filter @assetx/worker dev
pnpm --filter @assetx/web dev      # http://localhost:3000
```

### Local environment
- Start Redis with `docker compose up -d redis` (Colima or Docker Desktop).
- Create/seed the dev DB:
  ```bash
  cd apps/api
  DATABASE_URL="file:./dev.sqlite" pnpm prisma db push
  DATABASE_URL="file:./dev.sqlite" pnpm db:seed   # admin@assetx.local / admin12345
  ```

## 6. Workflow expectations for agents

- **Plan first** for multi-step work; track progress as you go.
- **Follow TDD**: write the failing test, then implement, then validate.
- **Run typecheck and tests before considering work done.** All must be green.
- **Match existing style** (naming, structure, conventions); read neighboring files
  first.
- **Keep DTOs/roles/permissions in `shared-types`** and rebuild it so apps pick up
  changes.
- **Schema changes** require: Prisma model + `db push` + test-helper SQL + backfill +
  seed defaults, all kept in sync.
- **Git/PR hygiene**: only commit/push/PR when explicitly asked. Use concise,
  conventional commit messages (`feat:`, `fix:`, `docs:`, `chore:`, `feat!:` for
  breaking changes). Inspect `git status`/`diff` before committing; never commit
  secrets.
- **Documentation**: update [docs/glossary/](./docs/glossary/) when adding or changing
  a system object; keep planning/spec docs under [docs/](./docs/) current and add a new
  `*_PRD_AND_IMPLEMENTATION_PLAN.md` for substantial features (mirror the existing format).

## 7. Domain model (quick reference)

- **User** — durable identity; `globalRole` is `super_user` or `user`.
- **Account** — tenant boundary; owns assets, members, settings.
- **AccountMembership** — links a user to an account with an `AccountRole`
  (`account_owner` | `account_editor` | `account_viewer`) and status. A user may
  belong to many accounts.
- **AccountSettings** — per-account config (datetime format, timezone).
- **Asset / Rendition / Publication** — uploaded file, processed variants, publish
  records.
- **AssetComment / AssetActivity** — collaboration timeline.

For full definitions, see [docs/glossary/README.md](./docs/glossary/README.md).
