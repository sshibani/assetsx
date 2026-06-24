# BundleShare

**Category:** Data model

## Description

`BundleShare` is a revocable, optionally-expiring share link for a
[Bundle](./Bundle.md). Creating a share generates a high-entropy random token;
only the **SHA-256 hash** of the token is stored (mirroring
[RefreshToken](./RefreshToken.md)), and the raw token is returned exactly once at
creation time. Anyone holding the token can open a read-only view of the bundle
without signing in, until the share is revoked or expires.

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Primary key. |
| `bundleId` | string | Foreign key to [Bundle](./Bundle.md). |
| `tokenHash` | string | SHA-256 of the raw token; the token itself is never stored. |
| `createdById` | string | The [User](./User.md) who created the share. |
| `expiresAt` | datetime \| null | Optional expiry; `null` means no expiry. |
| `revokedAt` | datetime \| null | Set when the share is revoked. |
| `createdAt` | datetime | Timestamp. |

## Constraints

- `@@unique([tokenHash])` — token hashes are unique.
- Indexed on `bundleId`.
- Cascade-deletes with its [Bundle](./Bundle.md).

## Notes

- Creating/revoking a share requires the `bundles:share`
  [Permission](./Permission.md) (account owner or editor) and is account-scoped.
- Public resolution (`GET /api/shared/bundles/:token`) is unauthenticated and
  rejects unknown, revoked, or expired tokens with HTTP 404 (so existence is not
  leaked). It returns a [PublicBundleDTO](./PublicBundleDTO.md).
- The one-time creation response is a
  [BundleShareCreatedDTO](./BundleShareCreatedDTO.md).
