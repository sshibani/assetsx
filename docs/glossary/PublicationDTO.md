# PublicationDTO

**Category:** Data transfer object

## Description

`PublicationDTO` is the public representation of a [Publication](./Publication.md).

## Shape

| Field | Type | Notes |
|---|---|---|
| `id` | string | Publication id. |
| `assetId` | string | Published [Asset](./Asset.md). |
| `channelId` | string | Target channel. |
| `status` | string | [PublicationStatus](./PublicationStatus.md). |
| `reference` | string \| null | Channel reference. |
| `error` | string \| null | Failure detail. |
| `createdAt` | string (ISO) | Timestamp. |
