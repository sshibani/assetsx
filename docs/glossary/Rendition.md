# Rendition

**Category:** Data model

## Description

A `Rendition` is a processed, resized variant of an [Asset](./Asset.md) produced by
the [ImageProcessor](./ImageProcessor.md) from the original upload. Renditions back
the thumbnails and previews shown in the UI and the files delivered to publishing
channels. Each asset has at most one rendition per [RenditionName](./RenditionName.md).

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Primary key. |
| `assetId` | string | Foreign key to [Asset](./Asset.md). |
| `name` | string | [RenditionName](./RenditionName.md): `thumb`, `standard`, `large`, `original`. |
| `storageKey` | string | Key in the [StorageProvider](./StorageProvider.md). |
| `width` / `height` | int | Output dimensions. |
| `format` | string | Output format (e.g. `webp`). |
| `sizeBytes` | int | Output file size. |

## Constraints

- `@@unique([assetId, name])` — one rendition per name per asset.

## Notes

- The generation recipe is described by [RenditionSpec](./RenditionSpec.md).
- The public-facing shape is [RenditionDTO](./RenditionDTO.md) (includes a resolvable `url`).
