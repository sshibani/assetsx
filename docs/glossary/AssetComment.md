# AssetComment

**Category:** Data model

## Description

An `AssetComment` is a free-text comment authored by a [User](./User.md) on an
[Asset](./Asset.md), scoped to the asset's [Account](./Account.md). Comments power
the collaboration timeline on the asset detail page.

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Primary key. |
| `accountId` | string | Owning [Account](./Account.md). |
| `assetId` | string | Foreign key to [Asset](./Asset.md). |
| `authorId` | string | Authoring [User](./User.md). |
| `body` | string | Comment text. |
| `createdAt` / `updatedAt` | datetime | Timestamps. |

## Relations

- `account` → [Account](./Account.md); `asset` → [Asset](./Asset.md)
- `author` → [User](./User.md) (`onDelete: Restrict` — a user with comments cannot be hard-deleted)

## Notes

- Reading requires `comments:read`; creating requires `comments:create` ([Permission](./Permission.md)).
- The public-facing shape is [AssetCommentDTO](./AssetCommentDTO.md).
