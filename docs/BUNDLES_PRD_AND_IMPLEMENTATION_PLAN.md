# Bundles PRD and Implementation Plan

## Summary

Add **Bundles** to AssetX: account-scoped, named collections that group a list
of [Asset](./glossary/Asset.md)s. Users can create bundles, add and remove
assets, edit a bundle's title/description, and delete bundles. Bundles can be
managed from a dedicated Bundles section in the web app, and an asset can be
added to a bundle directly from the asset detail page.

This introduces the first many-to-many relationship in the schema
(`Bundle` ↔ `Asset`), modeled with an explicit `BundleAsset` join record
following the same convention as `AccountMembership`.

The feature is account-scoped for the current multi-tenant model: a bundle and
the assets it references belong to the same account, and access follows the same
account-membership and permission rules used elsewhere.

> **Phasing.** This document covers **Phase 1** (the Bundle entity, asset
> add/remove, CRUD API, permissions, and web UI). **Phase 2** — shareable,
> revocable links for read-only external access — is tracked separately and is
> intentionally out of scope here.

## Product Goals

- Let permitted users create, read, update, and delete bundles.
- Let permitted users add assets to and remove assets from a bundle.
- Present a bundle's assets in a defined order.
- Manage bundles in the web app: a list page and a detail page with asset
  management.
- Let users add an asset to a bundle from the asset detail page.
- Keep bundles and their membership strictly scoped to the asset's account.

## Non-Goals

- No shareable links in Phase 1 (Phase 2).
- No editing of assets through a bundle (bundles only reference assets).
- No nested bundles.
- No per-asset permissions within a bundle.
- Does not replace the existing publishing/channel mechanism.

## User Stories

- As an account editor or owner, I can create a bundle with a title and optional
  description.
- As an account editor or owner, I can add assets to a bundle and remove them.
- As any account user with read access, I can view a bundle and its assets.
- As a viewer, I can read bundles but cannot create or modify them.
- As a user, I can add the asset I'm looking at to one of my bundles from the
  asset detail page.

## Permissions

Bundle-specific permissions were added to the shared permission model:

- `bundles:read`
- `bundles:create`
- `bundles:update`
- `bundles:delete`

Role mapping:

| Role | read | create | update | delete |
| --- | --- | --- | --- | --- |
| `account_owner` | Yes | Yes | Yes | Yes |
| `account_editor` | Yes | Yes | Yes | Yes |
| `account_viewer` | Yes | No | No | No |

Authorization lives in the service layer (`load → assert account + permission →
act → toDTO`), matching `AssetService`. Cross-account access is denied unless the
caller is a super user. Adding an asset verifies the asset belongs to the
bundle's account (otherwise treated as 404 to avoid leaking existence).

## Data Model

### Bundle

See [Bundle](./glossary/Bundle.md). `id`, `accountId`, `ownerId`, `title`,
`description`, `createdAt`, `updatedAt`. Indexed on `accountId`,
`(accountId, createdAt)`, `ownerId`. Cascade-deletes from `Account` and `User`.

### BundleAsset (join)

See [BundleAsset](./glossary/BundleAsset.md). `id`, `bundleId`, `assetId`,
`position`, `createdAt`. `@@unique([bundleId, assetId])`; indexed on `bundleId`
and `assetId`; cascade deletes from both `Bundle` and `Asset`.

Schema changes were synced across the four required locations: `schema.prisma`,
`prisma db push` (via `prisma generate`), the raw-SQL `schemaStatements` in
`apps/api/src/test/test-helpers.ts`, and (not needed) seed/backfill.

## API

All routes use `authGuard`. List responses are wrapped as `{ items }`; single
resources are returned directly. Request bodies are validated with zod
(`safeParse` → 400). A `BundleError` carries a `statusCode` mapped by a local
`handleError`.

| Method | Path | Description | Codes |
|---|---|---|---|
| `GET` | `/api/bundles` | List bundles for the account | 200 |
| `POST` | `/api/bundles` | Create a bundle (`title`, optional `description`) | 201 / 400 / 403 |
| `GET` | `/api/bundles/:id` | Get bundle + hydrated, ordered asset list | 200 / 403 / 404 |
| `PATCH` | `/api/bundles/:id` | Update `title` / `description` | 200 / 400 / 403 / 404 |
| `DELETE` | `/api/bundles/:id` | Delete the bundle (cascades join rows) | 204 / 403 / 404 |
| `POST` | `/api/bundles/:id/assets` | Add an asset (`assetId`, optional `position`) | 201 / 400 / 404 / 409 |
| `DELETE` | `/api/bundles/:id/assets/:assetId` | Remove an asset from the bundle | 204 / 403 / 404 |

DTOs: [BundleDTO](./glossary/BundleDTO.md),
[BundleDetailDTO](./glossary/BundleDetailDTO.md),
[BundleAssetDTO](./glossary/BundleAssetDTO.md).

## Web

Built with the existing all-client, no-extra-deps conventions (client
components, `useAuth()` + the shared `ApiClient`, the 50 ms localStorage
auth-guard, and global CSS classes).

- **API client** (`apps/web/src/lib/api-client.ts`): `listBundles`, `getBundle`,
  `createBundle`, `updateBundle`, `deleteBundle`, `addAssetToBundle`,
  `removeAssetFromBundle`.
- **Bundles list** (`/bundles`): lists the account's bundles, with an inline
  "Create a bundle" form gated by `bundles:create`. A `Bundles` link was added to
  the gallery appbar, gated by `bundles:read`.
- **Bundle detail** (`/bundles/[id]`): editable title/description, the bundle's
  assets with a per-asset Remove action, and an "Add assets" panel that selects
  from account assets not already in the bundle. Delete is gated by
  `bundles:delete`; write actions by `bundles:update`.
- **Asset detail** (`/assets/[id]`): an "Add to bundle" panel (gated by
  `bundles:update`) that adds the current asset to a chosen bundle, surfacing the
  409 "already in bundle" case gracefully.

## Testing

- API: `apps/api/src/test/bundles.test.ts` (integration, Vitest) covers
  create/list/get/update/delete, add/remove asset, duplicate add (409),
  cross-account isolation (403), viewer-cannot-create (403), and rejecting an
  asset from another account (404). Built test-first (RED → GREEN).
- Web: `apps/web/src/test/api-client.test.ts` covers all new client methods
  (URL/method/body via a mock `fetchFn`).
