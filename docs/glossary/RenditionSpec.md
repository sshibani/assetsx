# RenditionSpec

**Category:** Data transfer object (configuration)

## Description

`RenditionSpec` is the recipe describing how to generate one
[Rendition](./Rendition.md) from a source image. The [ImageProcessor](./ImageProcessor.md)
consumes a set of specs to produce the asset's renditions.

## Shape

| Field | Type | Notes |
|---|---|---|
| `name` | string | Target [RenditionName](./RenditionName.md). |
| `maxDimension` | number (optional) | Longest-edge max in pixels; omit for the untouched original. |
| `format` | `"webp"` \| `"original"` | Output format. |
| `fit` | `"cover"` \| `"inside"` | Resize strategy. |
