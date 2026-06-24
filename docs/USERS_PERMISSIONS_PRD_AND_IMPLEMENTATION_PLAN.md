# AssetX Users, Permissions, Accounts, and JWT Identity PRD

| | |
|---|---|
| Product | AssetX |
| Document Type | PRD + Implementation Plan |
| Status | Draft |
| Last Updated | 2026-06-19 |
| Owner | Engineering |

## 1. Summary

AssetX currently supports email/password login, JWT access tokens, rotating refresh tokens, and a simple global `admin` / `user` role model. Assets are scoped to the creating user through `ownerId`; admins can access every asset.

This initiative adds a multi-tenant authorization model based on accounts. Users can belong to one or more accounts, permissions are evaluated within an account, and assets are scoped to an account. A global super user role is added for platform administration across all accounts. JWT claims are expanded so the token format can support the current local auth flow and later external identity provider integrations.

## 2. Goals

- Introduce `Account` as the tenant boundary for assets, publishing history, memberships, and future billing/integrations.
- Replace global `admin` / `user` asset authorization with account-scoped roles and permissions.
- Add a global `super_user` capability for platform-level support and tenant administration.
- Keep current email/password login working.
- Prepare JWT claims and user identity storage for future identity providers such as OIDC/SAML-backed login.
- Preserve existing assets and users during migration by assigning them to a default account.
- Provide a clear API and UI path for account/user management.

## 3. Non-Goals

- Full OIDC/SAML login implementation in this phase.
- Fine-grained per-asset ACLs.
- Billing, subscription limits, or account plan enforcement.
- Public self-service account signup unless explicitly enabled later.
- Replacing JWTs with opaque sessions.

## 4. Current State

- `User` has `email`, `passwordHash`, and string `role` with values `admin` or `user`.
- `Asset` has `ownerId`; non-admin users only access assets where `ownerId` matches their user id.
- JWT access and refresh tokens contain `sub`, `role`, `type`, `iat`, `exp`, and `jti`.
- Refresh tokens are stored by `userId` and `tokenHash`.
- Seed creates a single admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## 5. Product Requirements

### 5.1 Accounts

- Every asset belongs to exactly one account.
- Every non-super-user request to asset and publishing APIs is evaluated in the context of one active account.
- A user may belong to multiple accounts.
- A user may have different roles in different accounts.
- Account membership can be active or disabled.
- Accounts have:
  - `id`
  - `name`
  - `slug`
  - `status`: `active` | `disabled`
  - timestamps

### 5.2 Users and Identities

- A user remains the durable internal identity.
- Users can authenticate with local email/password in this phase.
- Users can later authenticate through external identity providers without changing account membership or permission logic.
- Add a separate identity model for external providers:
  - `provider`: `local` | future provider id
  - `providerSubject`: stable IdP subject
  - `userId`
  - optional provider email/display metadata
- For local users, keep `passwordHash` on `User` in this phase, but design so it can later move to a local credentials table if needed.

### 5.3 Roles and Permissions

Use role-based access control with account-scoped roles and a global super user role.

Global roles:

| Role | Scope | Purpose |
|---|---|---|
| `super_user` | Platform-wide | Manage all accounts, users, and assets for support/admin operations. |
| `user` | Global default | Normal user identity; account permissions come from memberships. |

Account roles:

| Role | Scope | Permissions |
|---|---|---|
| `account_owner` | Account | Full account administration, user membership management, asset management, publishing. |
| `account_admin` | Account | Manage assets, publish, manage non-owner memberships. |
| `asset_manager` | Account | Upload, edit, delete, publish account assets. |
| `asset_viewer` | Account | View and download account assets only. |

Permission constants:

| Permission | Description |
|---|---|
| `account:read` | View account details. |
| `account:update` | Edit account details. |
| `members:read` | View account members. |
| `members:manage` | Invite, update, disable account members. |
| `assets:read` | List and view account assets. |
| `assets:create` | Upload assets to the account. |
| `assets:update` | Edit asset metadata. |
| `assets:delete` | Delete assets. |
| `assets:publish` | Publish/unpublish assets. |
| `platform:manage` | Super-user-only platform administration. |

### 5.4 Super User

- A super user can access all accounts and assets.
- A super user can create, disable, and update accounts.
- A super user can create or promote other super users.
- Super-user access must be explicit in UI and API responses; avoid silently treating it as ordinary account access.
- Seed supports a super user via environment variables:
  - `SUPER_USER_EMAIL`
  - `SUPER_USER_PASSWORD`
- In local/dev, if no super-user env is set, seed may fall back to the existing `ADMIN_EMAIL` / `ADMIN_PASSWORD` for backward compatibility.

### 5.5 JWT Requirements

JWTs must support current local auth and future identity provider integration.

Access token claims:

| Claim | Description |
|---|---|
| `sub` | Internal AssetX user id. |
| `iss` | AssetX issuer URL/configured issuer. |
| `aud` | AssetX API audience. |
| `jti` | Unique token id. |
| `typ` or `type` | `access`. |
| `globalRole` | `super_user` or `user`. |
| `accountId` | Active account id for account-scoped requests, nullable for super-user platform actions. |
| `accountRole` | Active account role, nullable when no account context. |
| `permissions` | Permission strings for the active account context. |
| `identityProvider` | `local` for current login; future provider id later. |
| `authTime` | Time user authenticated. |

Refresh token claims:

| Claim | Description |
|---|---|
| `sub` | Internal AssetX user id. |
| `jti` | Unique refresh token id. |
| `type` | `refresh`. |
| `identityProvider` | Provider used for the session. |
| `sessionId` | Server-side session id for revocation/audit. |

Rules:

- Access tokens are short-lived.
- Refresh tokens remain rotating and revocable.
- Permission-sensitive requests must not trust only token claims when membership may be disabled; the API should validate the user, account, and membership status for protected operations.
- Token claims should be compact and stable; do not include all account memberships in every token.
- If a user belongs to multiple accounts, the client selects an active account and receives tokens for that account context.

### 5.6 API Requirements

Authentication:

- `POST /api/auth/login` continues accepting email/password.
- Login returns tokens plus the user profile and available accounts.
- If the user has one account, it may become the default active account.
- If the user has multiple accounts, the response includes account options and either:
  - issues a token for the last/default account, or
  - requires account selection before account-scoped API calls.
- Add `POST /api/auth/switch-account` to issue a new access/refresh pair for another account membership.
- `GET /api/auth/me` returns:
  - user id/email/global role
  - active account context
  - account memberships visible to the user
  - permissions for the active account

Account and user management:

- `GET /api/accounts` lists accounts visible to the current user.
- `POST /api/accounts` creates an account; super user only in v1.
- `GET /api/accounts/:accountId` returns account details if user has `account:read`.
- `PATCH /api/accounts/:accountId` requires `account:update`.
- `GET /api/accounts/:accountId/members` requires `members:read`.
- `POST /api/accounts/:accountId/members` requires `members:manage`.
- `PATCH /api/accounts/:accountId/members/:membershipId` requires `members:manage`.

Asset and publishing APIs:

- List/get/update/delete/publish assets within the active account by default.
- Super users may pass an explicit account context for cross-account support workflows.
- Asset create uses the active account id and stores the creating user as `ownerId`.

### 5.7 UI Requirements

- Show current account in the app shell.
- If the user belongs to multiple accounts, provide an account switcher.
- Hide or disable actions based on permissions:
  - upload requires `assets:create`
  - edit metadata requires `assets:update`
  - delete requires `assets:delete`
  - publish requires `assets:publish`
  - member management requires `members:manage`
- Add account/member administration screens for account owners/admins.
- Add super-user platform administration screens:
  - account list
  - account detail
  - user lookup
  - membership management
- Keep existing asset gallery and detail workflows, but scope them to the active account.

## 6. Data Model

Recommended Prisma models and changes:

```prisma
model Account {
  id          String              @id @default(uuid())
  name        String
  slug        String              @unique
  status      String              @default("active") // active | disabled
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
  memberships AccountMembership[]
  assets      Asset[]
}

model User {
  id             String              @id @default(uuid())
  email          String              @unique
  passwordHash   String?
  globalRole     String              @default("user") // user | super_user
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt
  memberships    AccountMembership[]
  identities     UserIdentity[]
  assets         Asset[]
  refreshTokens  RefreshToken[]
}

model UserIdentity {
  id              String   @id @default(uuid())
  userId          String
  provider        String   // local | future provider key
  providerSubject String
  email           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerSubject])
  @@index([userId])
}

model AccountMembership {
  id        String   @id @default(uuid())
  accountId String
  userId    String
  role      String   // account_owner | account_admin | asset_manager | asset_viewer
  status    String   @default("active") // active | disabled
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  account   Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([accountId, userId])
  @@index([userId])
  @@index([accountId])
}
```

Modify existing models:

- `Asset`
  - Add `accountId String`.
  - Add relation to `Account`.
  - Keep `ownerId` as the creating user id.
  - Add indexes for `[accountId]` and `[accountId, createdAt]`.
- `RefreshToken`
  - Add `sessionId String`.
  - Add optional `accountId String?`.
  - Consider storing `identityProvider String`.
- Existing `User.role` should be migrated to `globalRole`.

Migration defaults:

- Create one default account named `Default`.
- Existing users become members of the default account.
- Existing `admin` users become `account_owner`.
- Existing `user` users become `asset_manager`.
- Existing assets receive `accountId = defaultAccount.id`.
- If an existing admin user matches super-user seed configuration, promote that user to `globalRole = "super_user"`.

## 7. Authorization Design

Add a central authorization module instead of scattering role checks in services.

Core APIs:

```ts
type Permission =
  | "account:read"
  | "account:update"
  | "members:read"
  | "members:manage"
  | "assets:read"
  | "assets:create"
  | "assets:update"
  | "assets:delete"
  | "assets:publish"
  | "platform:manage";

interface AuthContext {
  userId: string;
  globalRole: "user" | "super_user";
  accountId: string | null;
  accountRole: AccountRole | null;
  permissions: Permission[];
}
```

Rules:

- Super user has `platform:manage` and can act across accounts.
- Account role maps to permissions through a single role-permission table/function.
- Protected services accept `AuthContext`, not raw JWT payloads.
- Services query by `accountId` and permission, not only `ownerId`.
- Membership status is checked server-side before sensitive actions.

## 8. Implementation Plan

### Phase 1: Shared Types and Authorization Foundation

- Add shared role and permission constants:
  - `GLOBAL_ROLES`
  - `ACCOUNT_ROLES`
  - `PERMISSIONS`
- Add `AuthContext`, `AccountDTO`, `AccountMembershipDTO`, and updated `UserDTO`.
- Add role-to-permission mapping and tests.
- Refactor `AuthUser` to include global/account context.

### Phase 2: Database and Migration

- Update Prisma schema with `Account`, `AccountMembership`, `UserIdentity`, `globalRole`, and `Asset.accountId`.
- Create migration or `db push` compatible update matching the project workflow.
- Add migration script/backfill logic for existing local/dev data:
  - create default account
  - create memberships
  - backfill assets
  - migrate `User.role` to `User.globalRole`
- Update test-helper SQL schemas.
- Regenerate Prisma client.

### Phase 3: JWT and Auth Service

- Expand token claim types.
- Add issuer/audience config:
  - `JWT_ISSUER`
  - `JWT_AUDIENCE`
- Include active account context in access tokens.
- Store refresh token session metadata.
- Update login to return available accounts and selected account context.
- Add account-switch endpoint.
- Keep refresh token rotation.
- Ensure disabled memberships cannot refresh into an active account context.

### Phase 4: Account-Scoped Services

- Update asset upload/list/get/update/delete to require account-scoped permissions.
- Add `accountId` to asset serialization where useful for clients.
- Update publish service to require `assets:publish` and constrain publications through asset account.
- Replace existing `admin` bypass logic with centralized authorization.
- Add super-user support for explicit cross-account access.

### Phase 5: Account and Member APIs

- Add account routes.
- Add membership routes.
- Add input validation with zod.
- Add tests for account owner/admin/member/viewer behavior.
- Add tests for super-user platform access.

### Phase 6: Web UI

- Extend API client and auth context for:
  - current user
  - active account
  - memberships
  - permissions
- Add account switcher.
- Gate UI controls by permission.
- Add account/member administration views.
- Add super-user platform views.
- Ensure gallery/detail pages refresh after account switch.

### Phase 7: Tests and Hardening

- API tests:
  - user cannot access assets from another account
  - account owner can manage members
  - viewer can read but not upload/edit/delete/publish
  - asset manager can upload/edit/delete/publish but not manage members
  - super user can access all accounts
  - disabled membership loses access
  - account switch rejects accounts without active membership
- Token tests:
  - access token includes issuer, audience, global role, account context, and permissions
  - refresh token rotation still works
  - refresh token cannot restore disabled account membership
- Web typecheck and focused UI tests/manual checks.

## 9. Security Requirements

- Do not trust client-supplied account ids without verifying membership/permission.
- Super-user routes require `platform:manage`.
- All membership mutations should be audit-log ready, even if audit logs are implemented later.
- Account owners cannot accidentally remove the last active owner without replacing them.
- JWT secret configuration must remain environment-driven.
- Future IdP integration must map external identities to internal users before issuing AssetX JWTs.
- Do not include sensitive provider tokens in AssetX access tokens.

## 10. Rollout Plan

1. Ship schema and compatibility migration with default account backfill.
2. Deploy backend changes while preserving existing login behavior.
3. Enable account-scoped asset queries.
4. Add UI account display/switcher.
5. Add account/member management.
6. Enable super-user platform workflows.
7. Later: add external IdP login using the `UserIdentity` model.

## 11. Acceptance Criteria

- Existing local users can still log in after migration.
- Existing assets appear under the default account.
- Users only see assets for their active account unless they are super users.
- Account roles enforce the permissions matrix.
- Super users can administer all accounts.
- JWTs contain account context and are compatible with future IdP-backed sessions.
- API and worker tests pass.
- Web typecheck passes.

## 12. Open Questions

- Should normal users be allowed to create new accounts, or is account creation super-user-only in v1?
- Should account invitations be email-based now, or should admins add existing users only for the first implementation?
- Should the first implementation include audit logs, or only design the mutation points for audit logging later?
- Should account switching rotate both access and refresh tokens, or issue only a new access token while keeping the existing refresh session?
