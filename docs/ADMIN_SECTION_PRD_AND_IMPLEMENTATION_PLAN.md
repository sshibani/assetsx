# AssetX Admin Section, Self-Service Sign-Up, and Account Settings PRD

| | |
|---|---|
| Product | AssetX |
| Document Type | PRD + Implementation Plan |
| Status | Draft |
| Last Updated | 2026-06-24 |
| Owner | Engineering |

## 1. Summary

AssetX already has a multi-tenant authorization model: `Account` is the tenant boundary, `AccountMembership` links users to accounts with account-scoped roles (`account_owner`, `account_admin`, `asset_manager`, `asset_viewer`), and a global `super_user` role exists for platform administration. The backend exposes account and member endpoints, and a centralized authorization module (`authorization.ts`, `auth-guard.ts`) enforces permissions in the service layer.

What is missing is the **administration experience**: there are no web pages for managing accounts, users, and permissions; there is no platform-wide user management for super users; there is no self-service sign-up; and accounts have no configurable settings (such as datetime format).

This initiative delivers:

1. **A two-tier admin section in the web app:**
   - **Platform admin** (super user only): manage all accounts, all users, and per-account memberships across the platform; promote/demote super users.
   - **Account admin** (account owners/admins): manage members and per-member roles within their account, plus account-level configuration (e.g., datetime format, timezone).
2. **Self-service sign-up:** a public page that creates a new `Account` and a `User` attached as `account_owner`.
3. **Account settings:** a new `AccountSettings` model holding account-level configuration, starting with datetime format and timezone, surfaced in the admin UI and applied across the web app's date/time rendering.

This PRD reuses the existing permission model and authorization module; it does **not** introduce a new permission framework.

## 2. Goals

- Provide a web **Account Admin** section for account owners/admins to manage members, assign roles, and edit account settings.
- Provide a web **Platform Admin** section for super users to manage all accounts and all users, including super-user promotion/demotion.
- Add **self-service sign-up** that provisions a new account and an `account_owner` user in one flow.
- Add an **`AccountSettings`** model (datetime format, timezone) and apply it to date/time rendering in the web app.
- Add the missing platform-level **user-management** API (list users, view a user's memberships, change `globalRole`).
- Fill the **API client gaps** in the web app for account create/update, member management, user management, and settings.
- Enforce **last-owner protection** when changing/removing the final `account_owner` of an account.
- Keep all existing login, account-switch, asset, and publishing behavior working.

## 3. Non-Goals

- Email-based invitations or transactional email (members are still added by email of an existing user, plus the new sign-up flow for net-new accounts). Email invitations are a future phase.
- Billing, plan limits, or quota enforcement.
- OIDC/SAML login (the `UserIdentity` model remains the future hook).
- A new permission framework or fine-grained per-asset ACLs.
- Audit-log storage/UI (mutation points should be structured to add audit logging later, but no `AuditLog` model is delivered here).
- Per-user personal preferences (settings are account-scoped only in this phase).
- Localized/i18n message catalogs beyond datetime/timezone formatting.

## 4. Current State

- **Data model** (`apps/api/prisma/schema.prisma`): `Account`, `User` (`globalRole`: `super_user` | `user`), `AccountMembership` (`role`, `status`), `UserIdentity`, `RefreshToken`, `Asset` (account-scoped). No `AccountSettings` model. No platform user-management endpoints.
- **Permissions** (`packages/shared-types/src/index.ts`): `ACCOUNT_ROLES`, `PERMISSIONS` (incl. `account:read`, `account:update`, `members:read`, `members:manage`, `platform:manage`), `ACCOUNT_ROLE_PERMISSIONS` map, and `permissionsForAccountRole()`. `account_owner` and `account_admin` currently map to **identical** permission sets. `platform:manage` is granted to super users in code, not via the role map.
- **Auth service / routes** (`apps/api/src/services/auth-service.ts`, `apps/api/src/routes/auth.ts`): `register()` already creates a User + local identity + personal Account + `account_owner` membership, but returns only a `UserDTO` (no tokens) and ignores any requested `globalRole`. `POST /api/auth/register` exists but the web app has no sign-up page using it. `login`, `refresh`, `switch-account`, `logout`, `me` all work.
- **Account service / routes** (`apps/api/src/services/account-service.ts`, `apps/api/src/routes/accounts.ts`): `GET/POST /api/accounts`, `GET/PATCH /api/accounts/:accountId`, `GET/POST /api/accounts/:accountId/members`, `PATCH /api/accounts/:accountId/members/:membershipId`. `POST /api/accounts` is super-user only. `addMember` requires the user to already exist. **No** endpoint to list all platform users, change `globalRole`, or view a user's memberships. **No** last-owner protection.
- **Authorization** (`apps/api/src/authorization.ts`, `apps/api/src/auth-guard.ts`): `authGuard` re-validates user/membership/account status against the DB and recomputes permissions; `hasPermission` returns `true` for super users.
- **Web app** (`apps/web`): pages for login, gallery, asset detail only. `client-context.tsx` exposes `user`, `accounts`, `activeAccount`, `permissions`. `api-client.ts` has **no** methods for account create/update, member management, user management, or settings. There is no sign-up page and no admin pages. Date/time values are rendered ad hoc without a shared formatter.

## 5. Product Requirements

### 5.1 Self-Service Sign-Up

- A public `/signup` page collects: account name, email, password (min 8), and password confirmation.
- On submit, the system creates:
  - a new `Account` (`status = active`) with a generated unique `slug` derived from the account name (collision-safe),
  - a new `User` (`globalRole = user`) with the provided email and an argon2 `passwordHash`, plus a `local` `UserIdentity`,
  - an `AccountMembership` with `role = account_owner`, `status = active`,
  - a default `AccountSettings` row for the new account.
- Sign-up returns **auth tokens** for the new account context (the user is logged in immediately) plus the user profile and active account, consistent with the `login` response shape (`AuthTokens`).
- Duplicate email returns `409`. The first user of a brand-new account is always `account_owner`; sign-up never creates `super_user` accounts.
- Sign-up is rate-limit ready (structure the handler so a rate limiter can be attached later); no email verification in this phase.
- The login page links to `/signup`, and the sign-up page links back to `/login`.

> Note: The existing `register()` flow names the account after the user's email and returns only a `UserDTO`. Sign-up introduces an explicit account name and returns tokens; `register()` is extended/replaced by a `signup()` service method (see §8). The legacy `POST /api/auth/register` may remain for backward compatibility but should delegate to or be superseded by the new flow.

### 5.2 Account Admin Section (account owners/admins)

Available to users whose active account membership grants `members:manage` and/or `account:update` (i.e., `account_owner`, `account_admin`). Scoped strictly to the **active account**.

- **Members management**
  - List members of the active account (email, role, status, created/updated) — requires `members:read`.
  - Add a member by email; the user must already exist; assign an account role — requires `members:manage`.
  - Change a member's account role — requires `members:manage`.
  - Disable/re-enable a member (`status`) — requires `members:manage`.
  - **Last-owner protection:** cannot change the role away from `account_owner` or disable a member if it would leave the account with zero active `account_owner` members. Return `409` with a clear message.
  - A member cannot change their own role or disable themselves if it violates last-owner protection.
- **Account settings**
  - View and edit account-level configuration — requires `account:update`:
    - `dateTimeFormat` (e.g., a named preset such as `ISO`, `US`, `EU`, or a token string),
    - `timezone` (IANA timezone id, e.g., `Europe/Paris`),
    - account `name` (already supported via `PATCH /api/accounts/:id`).
  - Changes apply to date/time rendering across the web app for that account context.
- The account admin section is reachable from the app shell when the user has the required permissions in the active account.

### 5.3 Platform Admin Section (super users only)

Available only to `globalRole = super_user` (guarded by `platform:manage`). Provides cross-account administration.

- **Accounts**
  - List all accounts (name, slug, status, member count, created date) with search/filter by name/slug/status.
  - Create a new account (super user only; existing `POST /api/accounts`).
  - View account detail: settings, member list, and basic asset counts.
  - Update account `name`, `slug`, `status` (`active` | `disabled`) and settings.
  - Disabling an account blocks non-super-user access (existing membership/account status checks already enforce this).
- **Users**
  - List all users platform-wide (email, `globalRole`, created date, account count) with search by email.
  - View a user's detail: their memberships across all accounts (account, role, status).
  - Change a user's `globalRole` between `user` and `super_user` (promote/demote).
    - A super user cannot demote themselves below `super_user` if they are the last active super user (last-super-user protection).
  - Add/update a user's membership in any account (cross-account member management), reusing member endpoints with super-user bypass.
- **Cross-account member management**
  - Super users can manage members of any account without being a member (the existing `assertAccountPermission` super-user bypass already supports this).

### 5.4 Roles and Permissions

This PRD reuses the existing role/permission model. Two clarifications/changes:

- **Differentiate `account_owner` from `account_admin`** so owner-only actions exist. Introduce two new permissions:

  | Permission | Description | account_owner | account_admin | asset_manager | asset_viewer |
  |---|---|:---:|:---:|:---:|:---:|
  | `account:read` | View account details/settings | ✓ | ✓ | ✓ | ✓ |
  | `account:update` | Edit account details/settings | ✓ | ✓ | | |
  | `members:read` | View account members | ✓ | ✓ | | |
  | `members:manage` | Add/update/disable members | ✓ | ✓ | | |
  | `account:delete` (new) | Delete the account / disable it from account admin | ✓ | | | |
  | `members:manage_admins` (new) | Assign/revoke the `account_owner` role and transfer ownership | ✓ | | | |
  | `platform:manage` | Super-user platform administration | (super user only) | | | |

- `account_admin` may manage `asset_manager`/`asset_viewer`/`account_admin` members but **cannot** create or remove `account_owner` members (that requires `members:manage_admins`, owner-only).
- `platform:manage` remains granted to super users in code (not via the account-role map). Super users implicitly satisfy every account permission via `hasPermission`'s super-user bypass.
- Account settings read/write are gated by `account:read` / `account:update`.

### 5.5 Account Settings

- Each account has exactly one `AccountSettings` row (1:1, keyed by `accountId`).
- Initial typed fields:
  - `dateTimeFormat: String` — default `"ISO"` (other presets: `"US"`, `"EU"`; or a format token string the web formatter understands).
  - `timezone: String` — default `"UTC"` (IANA id).
- Settings are created with defaults on account creation (sign-up, `POST /api/accounts`, and seed/backfill for existing accounts).
- Settings are returned as part of account detail and via a dedicated settings endpoint.
- The web app exposes a shared date/time formatter that reads the active account's settings and is used in gallery, asset detail, comments/activity timestamps, and admin tables.

### 5.6 API Requirements

Authentication / sign-up:

- `POST /api/auth/signup` (public): body `{ accountName, email, password }`. Creates account + owner user + default settings; returns `AuthTokens` (access + refresh + user + activeAccount + accounts). `409` on duplicate email; `400` on validation failure.
- Existing `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/switch-account`, `POST /api/auth/logout`, `GET /api/auth/me` unchanged.

Account settings:

- `GET /api/accounts/:accountId/settings` — requires `account:read`. Returns `AccountSettingsDTO`.
- `PUT /api/accounts/:accountId/settings` — requires `account:update`. Body `{ dateTimeFormat?, timezone? }`. Validates allowed values; returns updated `AccountSettingsDTO`.

Account management (existing, with additions):

- `GET /api/accounts` — list visible accounts (super user: all; else own active memberships). Add optional `?q=` search and `?status=` filter for super users.
- `POST /api/accounts` — super user only (unchanged).
- `GET /api/accounts/:accountId` — requires `account:read`; include settings and member count.
- `PATCH /api/accounts/:accountId` — requires `account:update`. Adds last-owner safety where relevant.
- `DELETE /api/accounts/:accountId` (new) — requires `account:delete` (owner) or super user. Soft-deletes by setting `status = disabled` in v1 (hard delete deferred).

Member management (existing, with additions):

- `GET /api/accounts/:accountId/members` — requires `members:read`.
- `POST /api/accounts/:accountId/members` — requires `members:manage` (and `members:manage_admins` when assigning `account_owner`). User must already exist (`404` otherwise).
- `PATCH /api/accounts/:accountId/members/:membershipId` — requires `members:manage` (and `members:manage_admins` when the target or new role is `account_owner`). Enforces last-owner protection (`409`).
- `DELETE /api/accounts/:accountId/members/:membershipId` (new) — requires `members:manage` (owner-only if target is `account_owner`). Enforces last-owner protection.

Platform user management (new; super user / `platform:manage` only):

- `GET /api/admin/users` — list all users with `?q=` (email search) and pagination. Returns `UserDTO[]` plus account counts.
- `GET /api/admin/users/:userId` — user detail including memberships (`AccountMembershipDTO[]`).
- `PATCH /api/admin/users/:userId` — change `globalRole` (`user` | `super_user`). Enforces last-super-user protection (`409`).

All new endpoints validate input with zod, funnel errors through the existing error handler, and rely on `authGuard` + service-layer permission checks (no role logic in route handlers beyond wiring).

### 5.7 UI Requirements

App shell / navigation:

- Add an **Admin** entry point in the app shell, visible when the user has `members:manage` or `account:update` in the active account (Account Admin) and/or is a super user (Platform Admin).
- Show the active account name (already present via the account switcher).

Sign-up:

- New `/signup` page: account name, email, password, confirm password; client-side validation; error display for `409`/`400`; on success, store tokens and redirect to `/`.
- Link between `/login` and `/signup`.

Account Admin (`/admin/account` or similar, scoped to active account):

- **Members tab:** table of members (email, role, status), add-member form (email + role select), inline role edit, enable/disable toggle, all gated by `members:manage`. Owner-only controls (assign/transfer `account_owner`) gated by `members:manage_admins`. Show last-owner errors clearly.
- **Settings tab:** form for account name, `dateTimeFormat` (select of presets), `timezone` (IANA select), gated by `account:update`. Live preview of formatted current date/time.

Platform Admin (`/admin/platform`, super user only):

- **Accounts view:** searchable/filterable list; create-account action; click into account detail (settings + members, reusing account-admin components with super-user privileges).
- **Users view:** searchable list; click into user detail showing memberships; promote/demote `globalRole` control with last-super-user guard messaging.
- Hide the entire Platform Admin area for non-super-users.

Cross-cutting:

- Add a shared date/time formatting utility driven by the active account's settings; apply it to gallery cards, asset detail, and comment/activity timestamps.
- Gate every control by the relevant permission (reuse `permissions` from `useAuth()` plus `user.globalRole` for super-user-only controls).
- Refresh data after mutations (member changes, settings save, role changes).

## 6. Data Model

New model:

```prisma
model AccountSettings {
  id             String   @id @default(uuid())
  accountId      String   @unique
  dateTimeFormat String   @default("ISO")   // ISO | US | EU | <token string>
  timezone       String   @default("UTC")   // IANA timezone id
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  account        Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
}
```

Modify existing models:

- `Account`
  - Add relation `settings AccountSettings?`.
- No other schema changes are required (sign-up, user management, and member management reuse `User`, `AccountMembership`, `UserIdentity`).

Migration / backfill defaults:

- Create one `AccountSettings` row per existing `Account` with defaults (`dateTimeFormat = "ISO"`, `timezone = "UTC"`).
- Update the test-helper SQL schemas to include `AccountSettings`.
- Regenerate the Prisma client.
- The project uses `prisma db push` for the dev SQLite database (no migration history); follow the existing workflow and update the backfill script (`apps/api/prisma/backfill-accounts.ts`) to create settings rows idempotently.

## 7. Authorization Design

Reuse and extend the central authorization module (`apps/api/src/authorization.ts`, `packages/shared-types/src/index.ts`).

```ts
type Permission =
  | "account:read"
  | "account:update"
  | "account:delete"          // new
  | "members:read"
  | "members:manage"
  | "members:manage_admins"   // new
  | "assets:read"
  | "assets:create"
  | "assets:update"
  | "assets:delete"
  | "assets:publish"
  | "comments:read"
  | "comments:create"
  | "platform:manage";
```

Rules:

- Update `ACCOUNT_ROLE_PERMISSIONS` so `account_owner` gains `account:delete` and `members:manage_admins`; `account_admin` keeps the prior owner/admin set minus those two; `asset_manager`/`asset_viewer` unchanged.
- Super users continue to bypass account-permission checks via `hasPermission`'s super-user branch and carry `platform:manage`.
- Platform user-management endpoints require super user (`isSuperUser`) or `platform:manage`; they must not be reachable by account admins.
- **Last-owner protection:** account-service member mutations must verify, within the same transaction, that at least one active `account_owner` remains. Violations throw a `409` domain error.
- **Last-super-user protection:** the user-management service must verify at least one active `super_user` remains before demotion.
- All membership/account/user/settings mutations should be structured at a single service entry point per action so audit logging can be added later without touching routes.
- Cross-account super-user actions continue to flow through `assertAccountPermission`'s super-user bypass.

## 8. Implementation Plan

Follow the repo's TDD Red-Green-Validate workflow. Test commands:
`corepack pnpm --filter @assetx/api test`, `corepack pnpm --filter @assetx/web typecheck`, and `pnpm -r test` for the full suite.

### Phase 1: Shared Types and Permissions

- Add `account:delete` and `members:manage_admins` to `PERMISSIONS` in `packages/shared-types/src/index.ts`.
- Update `ACCOUNT_ROLE_PERMISSIONS` to differentiate `account_owner` (gains the two new permissions) from `account_admin`.
- Add `AccountSettingsDTO` and a `SignupRequest` type; extend `AuthTokens` usage as needed.
- Add/adjust tests in `packages/shared-types/src/index.test.ts` for `permissionsForAccountRole` (owner vs admin difference) and the new permissions.
- Rebuild packages (`pnpm --filter "./packages/*" build`) so apps resolve to `dist/`.

### Phase 2: Database and Settings Persistence

- Add `AccountSettings` to `apps/api/prisma/schema.prisma` and the `Account.settings` relation.
- `prisma db push` and regenerate the client; update test-helper SQL schemas to include `AccountSettings`.
- Update `apps/api/prisma/backfill-accounts.ts` and `seed.ts` to create default settings rows idempotently.

### Phase 3: Sign-Up Service and Endpoint (RED → GREEN → VALIDATE)

- Add `signup({ accountName, email, password })` to `auth-service.ts`: transaction creating account + user + local identity + `account_owner` membership + default settings, then issue tokens (reuse `issueTokens`).
- Add `POST /api/auth/signup` route with zod validation; map duplicate email to `409`.
- Tests: success returns tokens + account context; duplicate email `409`; weak password `400`; slug uniqueness on name collision.

### Phase 4: Account Settings + Account/Member API Additions

- Add `getSettings` / `updateSettings` to `account-service.ts` (gated by `account:read` / `account:update`) and routes `GET`/`PUT /api/accounts/:accountId/settings` with allowed-value validation.
- Add `DELETE /api/accounts/:accountId/members/:membershipId` and `DELETE /api/accounts/:accountId` (soft-delete via `status = disabled`).
- Implement last-owner protection in `addMember` / `updateMember` / member delete and owner-role assignment gating (`members:manage_admins`).
- Tests: owner vs admin role-assignment rules; last-owner protection (`409`); settings read/write permissions; settings validation.

### Phase 5: Platform User-Management API

- Add `user-service.ts` (or extend account-service) with `listUsers`, `getUser` (with memberships), `setGlobalRole` (last-super-user protection).
- Add routes under `/api/admin/users` guarded by super user / `platform:manage`; register in `app.ts`.
- Add `?q=`/`?status=` search to `GET /api/accounts` for super users.
- Tests: non-super-user gets `403`; list/search; promote/demote; last-super-user `409`.

### Phase 6: Web API Client and Auth Context

- Extend `apps/web/src/lib/api-client.ts` with: `signup`, `getAccountSettings`, `updateAccountSettings`, `createAccount`, `updateAccount`, `deleteAccount`, `addMember`, `updateMember`, `removeMember`, `listAdminUsers`, `getAdminUser`, `setUserGlobalRole`.
- Surface a clean `isSuperUser` and per-account permission helpers from `client-context.tsx`.
- Add a shared date/time formatter utility driven by active-account settings; wire `apps/web/src/lib/types.ts` to re-export new DTOs.

### Phase 7: Web UI — Sign-Up and Admin Sections

- Add `/signup` page; link to/from `/login`.
- Add app-shell Admin entry point (permission-gated).
- Account Admin: Members tab + Settings tab (`/admin/account`).
- Platform Admin (super user only): Accounts view + Users view + detail screens (`/admin/platform`).
- Apply the shared date/time formatter in gallery, asset detail, and comment/activity timestamps.

### Phase 8: Tests and Hardening

- API tests: sign-up flow; settings CRUD permissions; last-owner and last-super-user protections; cross-account super-user management; account admin cannot assign `account_owner`.
- Web: `corepack pnpm --filter @assetx/web typecheck`, focused tests for `api-client` additions and the date/time formatter, manual checks of admin flows.
- Full suite: `pnpm -r test`.

## 9. Security Requirements

- Sign-up never creates `super_user` accounts and never accepts a client-supplied `globalRole`.
- Platform user-management and account-creation endpoints require super user / `platform:manage`; account admins cannot reach them.
- Account admins cannot create, remove, or transfer `account_owner` membership (requires `members:manage_admins`, owner-only).
- Last-owner and last-super-user protections are enforced server-side within transactions, not just in the UI.
- Do not trust client-supplied account/user ids without verifying membership/permission (reuse `authGuard` DB re-validation).
- Settings values are validated against allowlists (datetime presets, IANA timezones) to prevent injection into formatting logic.
- All admin mutations are structured at single service entry points to be audit-log ready.
- Passwords are hashed with argon2; never return `passwordHash` in any DTO.
- Rate-limit sign-up and login endpoints (structure handlers so a limiter can be attached).

## 10. Rollout Plan

1. Ship shared-types permission updates and rebuild packages.
2. Ship `AccountSettings` schema + backfill defaults for existing accounts.
3. Deploy sign-up service/endpoint while keeping existing login working.
4. Deploy account-settings and member API additions with last-owner protection.
5. Deploy platform user-management API.
6. Ship web sign-up page and Account Admin section.
7. Ship Platform Admin section (super user only).
8. Apply account-driven date/time formatting across the web app.

## 11. Acceptance Criteria

- A visitor can sign up, get a new account with themselves as `account_owner`, and be logged in immediately.
- Account owners/admins can manage members and roles within their active account; last-owner protection prevents removing the final owner.
- Account admins cannot assign or remove the `account_owner` role; owners can (and can transfer ownership).
- Account owners/admins can edit account settings (datetime format, timezone), and date/time rendering across the web app reflects those settings.
- Super users can list/search all accounts and users, view memberships, manage members in any account, and promote/demote super users (with last-super-user protection).
- Non-super-users cannot access platform admin APIs or UI.
- All existing login, account-switch, asset, and publishing behavior still works.
- API and worker tests pass (`pnpm -r test`); web typecheck passes.

## 12. Open Questions

- Should `dateTimeFormat` be a fixed set of named presets, a free-form token string, or both? (Affects validation and UI control.)
- Should account deletion be soft-delete (`status = disabled`) only, or include a hard-delete path with asset/data cleanup later?
- Should sign-up require email verification before the account becomes active, or activate immediately (current assumption)?
- Should the legacy `POST /api/auth/register` be removed once `POST /api/auth/signup` ships, or kept for backward compatibility?
- Should platform admin support impersonation / "act as account" beyond the existing super-user cross-account access?
- Should member additions support inviting non-existent users (email invitation) in this phase, or remain "existing users only" until the invitations phase?

## 13. Assumptions

- The dev database uses SQLite via `prisma db push` (no migration history); production follows the same Prisma workflow.
- The existing authorization module and `authGuard` DB re-validation remain the enforcement layer; routes only wire validation + service calls.
- Super users implicitly hold all account permissions via `hasPermission`'s super-user bypass.
- The web app continues to persist only the access token client-side; refresh handling is unchanged by this PRD.
- Datetime/timezone formatting is the only account setting in this phase; the model is designed to add more typed settings later.
