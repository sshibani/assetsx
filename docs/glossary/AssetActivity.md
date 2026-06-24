# AssetActivity

**Category:** Data model

## Description

`AssetActivity` is an append-only audit entry describing something that happened to
an [Asset](./Asset.md) (for example, it was created or updated). Activities and
[AssetComment](./AssetComment.md)s are merged into a single chronological timeline
in the UI.

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Primary key. |
| `accountId` | string | Owning [Account](./Account.md). |
| `assetId` | string | Foreign key to [Asset](./Asset.md). |
| `actorId` | string \| null | Acting [User](./User.md), if known. |
| `type` | string | [AssetActivityType](./AssetActivityType.md). |
| `summary` | string | Human-readable description. |
| `detailsJson` | string \| null | JSON-encoded structured details. |
| `createdAt` | datetime | Timestamp. |

## Relations

- `account` → [Account](./Account.md); `asset` → [Asset](./Asset.md)
- `actor` → [User](./User.md) (`onDelete: SetNull` — preserves the entry if the user is removed)

## Notes

- Entries are immutable (append-only).
- The public-facing shape is [AssetActivityDTO](./AssetActivityDTO.md).
