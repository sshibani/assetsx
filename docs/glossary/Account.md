# Account

**Category:** Data model

## Description

An `Account` is the tenant boundary in AssetX. It owns assets, members, publishing
history, and configuration. Every non-super-user request is evaluated in the context
of one active account. New accounts are created via self-service sign-up (first user
becomes [account_owner](./AccountRole.md)) or by a super user.

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Primary key. |
| `name` | string | Human-readable account name. |
| `slug` | string | Unique URL-safe identifier. |
| `status` | string | [AccountStatus](./AccountStatus.md): `active` or `disabled`. |
| `createdAt` / `updatedAt` | datetime | Timestamps. |

## Relations

- `memberships` → [AccountMembership](./AccountMembership.md)
- `assets` → [Asset](./Asset.md)
- `comments` → [AssetComment](./AssetComment.md)
- `activities` → [AssetActivity](./AssetActivity.md)
- `settings` → [AccountSettings](./AccountSettings.md) (1:1)

## Notes

- Disabling an account blocks non-super-user access via membership/account status checks.
- The public-facing shape is [AccountDTO](./AccountDTO.md).
