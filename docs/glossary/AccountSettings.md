# AccountSettings

**Category:** Data model

## Description

`AccountSettings` holds per-account configuration. There is exactly one settings
row per [Account](./Account.md) (1:1, keyed by `accountId`). It currently stores
date/time presentation preferences that the web app applies wherever dates are
rendered for that account context. The model is designed to grow with additional
typed settings over time.

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Primary key. |
| `accountId` | string | Unique foreign key to [Account](./Account.md). |
| `dateTimeFormat` | string | [DateTimeFormat](./DateTimeFormat.md): `ISO`, `US`, or `EU` (default `ISO`). |
| `timezone` | string | IANA timezone id (default `UTC`). |
| `createdAt` / `updatedAt` | datetime | Timestamps. |

## Relations

- `account` → [Account](./Account.md) (`onDelete: Cascade`)

## Notes

- Created with defaults on account creation (sign-up, super-user create, seed/backfill).
- Reading/writing requires `account:read` / `account:update` ([Permission](./Permission.md)).
- The public-facing shape is [AccountSettingsDTO](./AccountSettingsDTO.md).
