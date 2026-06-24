# BundleDetailDTO

**Category:** Data transfer object

## Description

`BundleDetailDTO` extends [BundleDTO](./BundleDTO.md) with the bundle's full,
ordered list of assets. It is returned by the bundle detail endpoint so the UI
can render the assets in a bundle in one request.

## Fields

| Field | Type | Notes |
|---|---|---|
| _(all [BundleDTO](./BundleDTO.md) fields)_ | | id, accountId, ownerId, title, description, assetCount, timestamps. |
| `items` | [BundleAssetDTO](./BundleAssetDTO.md)[] | The assets in the bundle, ordered by `position` then `createdAt`. |

## Returned by

- `GET /api/bundles/:id`
