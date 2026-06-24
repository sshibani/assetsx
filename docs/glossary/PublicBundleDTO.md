# PublicBundleDTO

**Category:** Data transfer object

## Description

`PublicBundleDTO` is the read-only, unauthenticated view of a shared
[Bundle](./Bundle.md), returned when a valid [BundleShare](./BundleShare.md)
token is resolved. It deliberately omits internal identifiers (account, owner,
ids, timestamps) so a public share leaks no tenant information.

## Fields

| Field | Type | Notes |
|---|---|---|
| `title` | string | Bundle title. |
| `description` | string \| null | Optional description. |
| `items` | [BundleAssetDTO](./BundleAssetDTO.md)[] | The bundle's assets, ordered by `position` then `createdAt`. |

## Returned by

- `GET /api/shared/bundles/:token` (public, no authentication)
