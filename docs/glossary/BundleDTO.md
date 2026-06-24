# BundleDTO

**Category:** Data transfer object

## Description

`BundleDTO` is the public-facing representation of a [Bundle](./Bundle.md)
returned by the bundles API for list responses and write operations. It includes
an `assetCount` rather than the full asset list; the hydrated asset list is only
returned by the detail endpoint via [BundleDetailDTO](./BundleDetailDTO.md).

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | Bundle id. |
| `accountId` | string | Owning account. |
| `ownerId` | string | Creating user. |
| `title` | string | Bundle title. |
| `description` | string \| null | Optional description. |
| `assetCount` | number | Number of assets in the bundle. |
| `createdAt` / `updatedAt` | string (ISO) | Timestamps. |

## Returned by

- `GET /api/bundles` (as `{ items: BundleDTO[] }`)
- `POST /api/bundles`
- `PATCH /api/bundles/:id`
- `POST /api/bundles/:id/assets` (returns the updated bundle)
