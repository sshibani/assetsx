# Publication

**Category:** Data model

## Description

A `Publication` records the outcome of publishing an [Asset](./Asset.md) to a
publishing channel (see [ChannelPublisher](./ChannelPublisher.md)). It provides an
audit trail of where and when an asset was published and whether it succeeded.

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Primary key. |
| `assetId` | string | Foreign key to [Asset](./Asset.md). |
| `channelId` | string | Identifier of the target channel. |
| `status` | string | [PublicationStatus](./PublicationStatus.md): `success` or `failed`. |
| `reference` | string \| null | Channel-returned reference (e.g. URL/id). |
| `error` | string \| null | Failure detail when `status = failed`. |
| `createdAt` | datetime | Timestamp. |

## Notes

- Publishing requires the `assets:publish` [Permission](./Permission.md).
- The public-facing shape is [PublicationDTO](./PublicationDTO.md).
