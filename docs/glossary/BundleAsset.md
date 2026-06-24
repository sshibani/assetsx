# BundleAsset

**Category:** Data model

## Description

`BundleAsset` is the join record that links an [Asset](./Asset.md) to a
[Bundle](./Bundle.md). It is the first many-to-many relationship in the schema
and follows the explicit join-model convention established by
[AccountMembership](./AccountMembership.md) (a dedicated model with its own
columns rather than a Prisma implicit relation). It carries a `position` so the
assets in a bundle can be presented in a defined order.

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Primary key. |
| `bundleId` | string | Foreign key to [Bundle](./Bundle.md). |
| `assetId` | string | Foreign key to [Asset](./Asset.md). |
| `position` | int | Ordering within the bundle (default `0`). |
| `createdAt` | datetime | Timestamp. |

## Constraints

- `@@unique([bundleId, assetId])` — an asset can appear in a bundle at most once
  (a duplicate add returns HTTP 409).
- Indexed on `bundleId` and `assetId`.
- Both foreign keys cascade on delete, so deleting a bundle or an asset removes
  the join rows.

## Notes

- When an asset is added to a bundle, the service verifies the asset belongs to
  the bundle's account; assets from other accounts are rejected as not found.
- The public-facing shape is [BundleAssetDTO](./BundleAssetDTO.md).
