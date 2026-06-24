# RenditionDTO

**Category:** Data transfer object

## Description

`RenditionDTO` is the public representation of a [Rendition](./Rendition.md), with a
resolvable delivery `url` instead of an internal storage key.

## Shape

| Field | Type | Notes |
|---|---|---|
| `id` | string | Rendition id. |
| `name` | string | [RenditionName](./RenditionName.md). |
| `width` / `height` | number | Output dimensions. |
| `format` | string | Output format. |
| `sizeBytes` | number | Output size. |
| `url` | string | Public/delivery URL. |
