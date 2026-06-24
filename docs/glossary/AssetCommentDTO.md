# AssetCommentDTO

**Category:** Data transfer object

## Description

`AssetCommentDTO` is the public representation of an [AssetComment](./AssetComment.md),
enriched with the author's email.

## Shape

| Field | Type | Notes |
|---|---|---|
| `id` | string | Comment id. |
| `accountId` | string | Owning account. |
| `assetId` | string | Target [Asset](./Asset.md). |
| `authorId` | string | Author [User](./User.md) id. |
| `authorEmail` | string | Author email (convenience). |
| `body` | string | Comment text. |
| `createdAt` / `updatedAt` | string (ISO) | Timestamps. |
