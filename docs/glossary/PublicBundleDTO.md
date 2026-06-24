# PublicBundleDTO

**Category:** Data transfer object

## Description

`PublicBundleDTO` is the read-only, unauthenticated view of a shared
[Bundle](./Bundle.md), returned when a valid [BundleShare](./BundleShare.md)
token is resolved. It deliberately omits internal identifiers (account, owner,
ids, timestamps) so a public share leaks no tenant information. Its `items`
carry a **minimal `PublicAssetDTO`** rather than the full internal `AssetDTO`:
no asset/account/owner ids, no checksum, no status/metadata provenance, and no
original full-resolution download URL — only viewable renditions (thumb /
standard / large).

## Fields

| Field | Type | Notes |
|---|---|---|
| `title` | string | Bundle title. |
| `description` | string \| null | Optional description. |
| `items` | `PublicBundleAssetDTO[]` | `{ position, asset: PublicAssetDTO }`, ordered by `position` then `createdAt`, capped defensively. |

### PublicAssetDTO

| Field | Type | Notes |
|---|---|---|
| `title` | string \| null | Asset title. |
| `originalName` | string | Uploaded filename. |
| `format` | string | Detected format. |
| `width` / `height` | number \| null | Pixel dimensions. |
| `renditions` | `{ name, width, height, url }[]` | Viewable renditions only (thumb/standard/large). No original URL. |

## Returned by

- `GET /api/shared/bundles/:token` (public, no authentication)
