# AssetDTO

**Category:** Data transfer object

## Description

`AssetDTO` is the public representation of an [Asset](./Asset.md), including its
[Rendition](./Rendition.md)s and a resolvable URL to the original.

## Shape

| Field | Type | Notes |
|---|---|---|
| `id` | string | Asset id. |
| `accountId` | string | Owning account. |
| `ownerId` | string | Creating user. |
| `originalName` | string | Uploaded filename. |
| `status` | string | [AssetStatus](./AssetStatus.md). |
| `checksum` | string | Content hash. |
| `width` / `height` | number \| null | Dimensions. |
| `format` | string | Detected format. |
| `sizeBytes` | number | Original size. |
| `title` / `description` | string \| null | Metadata. |
| `metadataSource` | string | [MetadataSource](./MetadataSource.md). |
| `metadata` | [ImageMetadataDTO](./ImageMetadataDTO.md) \| null | Extracted EXIF/IPTC/XMP metadata; null until the worker processes the image (and for non-image/EXIF-free files). |
| `renditions` | [RenditionDTO](./RenditionDTO.md)[] | Generated variants. |
| `originalUrl` | string | URL to the original file. |
| `expiresAt` | string \| null | Optional expiry. |
| `createdAt` / `updatedAt` | string (ISO) | Timestamps. |
