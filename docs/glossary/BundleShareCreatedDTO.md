# BundleShareCreatedDTO

**Category:** Data transfer object

## Description

`BundleShareCreatedDTO` is returned **once**, when a
[BundleShare](./BundleShare.md) is created. In addition to the share metadata it
includes the raw `token` and the ready-to-use `url`. Because only the token's
hash is persisted, the raw token cannot be retrieved again — the caller must
capture the URL at creation time.

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | Share id (used to revoke). |
| `bundleId` | string | The shared bundle. |
| `createdById` | string | Creating user. |
| `expiresAt` | string (ISO) \| null | Optional expiry. |
| `revokedAt` | string (ISO) \| null | Always `null` at creation. |
| `createdAt` | string (ISO) | Timestamp. |
| `token` | string | The raw share token (shown only once). |
| `url` | string | The full shareable URL (`/shared/bundles/:token`). |

## Returned by

- `POST /api/bundles/:id/share`
