# Asset

**Category:** Data model

## Description

An `Asset` is an uploaded image or PDF together with its metadata. Every asset
belongs to exactly one [Account](./Account.md) and records the creating user as
its owner. After upload, a background job processes the asset into one or more
[Rendition](./Rendition.md)s and sets its [AssetStatus](./AssetStatus.md).

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Primary key. |
| `accountId` | string | Owning [Account](./Account.md). |
| `ownerId` | string | Creating [User](./User.md). |
| `originalName` | string | Uploaded filename. |
| `status` | string | [AssetStatus](./AssetStatus.md). |
| `checksum` | string | Content hash for dedupe/integrity. |
| `width` / `height` | int \| null | Pixel dimensions when known. |
| `format` | string | Detected format (e.g. `jpeg`, `pdf`). |
| `sizeBytes` | int | Original file size. |
| `title` / `description` | string \| null | Editable metadata. |
| `metadataSource` | string | [MetadataSource](./MetadataSource.md): `manual` or `llm`. |
| `expiresAt` | datetime \| null | Optional expiry. |
| `createdAt` / `updatedAt` | datetime | Timestamps. |

## Relations

- `account` → [Account](./Account.md); `owner` → [User](./User.md)
- `renditions` → [Rendition](./Rendition.md)
- `publications` → [Publication](./Publication.md)
- `comments` → [AssetComment](./AssetComment.md)
- `activities` → [AssetActivity](./AssetActivity.md)

## Notes

- Asset operations are gated by `assets:*` [Permission](./Permission.md)s.
- The public-facing shape is [AssetDTO](./AssetDTO.md).
