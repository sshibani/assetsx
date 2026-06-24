# Bundle

**Category:** Data model

## Description

A `Bundle` is an account-scoped, named collection that groups a list of
[Asset](./Asset.md)s. Bundles let users organize assets into collections (for a
campaign, a delivery, etc.) without copying the underlying files. Each bundle
belongs to exactly one [Account](./Account.md) and records the creating user as
its owner. Assets are linked to a bundle through the [BundleAsset](./BundleAsset.md)
join record.

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Primary key. |
| `accountId` | string | Owning [Account](./Account.md). |
| `ownerId` | string | Creating [User](./User.md). |
| `title` | string | Required, human-readable name. |
| `description` | string \| null | Optional description. |
| `createdAt` / `updatedAt` | datetime | Timestamps. |

## Relations

- `account` → [Account](./Account.md); `owner` → [User](./User.md)
- `items` → [BundleAsset](./BundleAsset.md) (the assets in the bundle)

## Constraints

- Indexed on `accountId`, `(accountId, createdAt)`, and `ownerId`.

## Notes

- Bundle operations are gated by `bundles:*` [Permission](./Permission.md)s
  (`bundles:read`, `bundles:create`, `bundles:update`, `bundles:delete`).
- Bundles are strictly account-scoped; cross-account access is denied.
- The public-facing shapes are [BundleDTO](./BundleDTO.md) and
  [BundleDetailDTO](./BundleDetailDTO.md).
