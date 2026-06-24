# AssetTimelineItemDTO

**Category:** Data transfer object

## Description

`AssetTimelineItemDTO` is a discriminated-union item used to render an asset's
collaboration timeline, merging comments and activities into one chronological list.

## Shape

A union discriminated by `kind`:

| `kind` | Payload | Notes |
|---|---|---|
| `"comment"` | `comment: ` [AssetCommentDTO](./AssetCommentDTO.md) | A user comment. |
| `"activity"` | `activity: ` [AssetActivityDTO](./AssetActivityDTO.md) | A system activity entry. |

Both variants also carry `id` and `createdAt` (ISO string) for sorting/keying.
