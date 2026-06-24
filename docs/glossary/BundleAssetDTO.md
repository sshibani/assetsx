# BundleAssetDTO

**Category:** Data transfer object

## Description

`BundleAssetDTO` is the public-facing representation of a
[BundleAsset](./BundleAsset.md) entry, returned inside
[BundleDetailDTO](./BundleDetailDTO.md). It carries the asset's position within
the bundle and the fully hydrated [AssetDTO](./AssetDTO.md) so the detail view
can render each asset (including its renditions) without extra requests.

## Fields

| Field | Type | Notes |
|---|---|---|
| `assetId` | string | The asset's id. |
| `position` | number | Ordering within the bundle. |
| `asset` | [AssetDTO](./AssetDTO.md) | The hydrated asset. |
