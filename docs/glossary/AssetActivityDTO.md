# AssetActivityDTO

**Category:** Data transfer object

## Description

`AssetActivityDTO` is the public representation of an
[AssetActivity](./AssetActivity.md), with structured `details` parsed from JSON and
the actor's email resolved.

## Shape

| Field | Type | Notes |
|---|---|---|
| `id` | string | Activity id. |
| `accountId` | string | Owning account. |
| `assetId` | string | Target [Asset](./Asset.md). |
| `actorId` | string \| null | Acting user id. |
| `actorEmail` | string \| null | Acting user email. |
| `type` | string | [AssetActivityType](./AssetActivityType.md). |
| `summary` | string | Human-readable description. |
| `details` | object \| null | Structured details. |
| `createdAt` | string (ISO) | Timestamp. |
