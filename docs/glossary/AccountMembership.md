# AccountMembership

**Category:** Data model

## Description

`AccountMembership` is the join record that links a [User](./User.md) to an
[Account](./Account.md) and assigns the user's [AccountRole](./AccountRole.md)
within that account. It is how multi-tenant authorization is expressed: a user
may have memberships in several accounts, each with a different role and status.

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Primary key. |
| `accountId` | string | Foreign key to [Account](./Account.md). |
| `userId` | string | Foreign key to [User](./User.md). |
| `role` | string | [AccountRole](./AccountRole.md): `account_owner`, `account_editor`, `account_viewer`. |
| `status` | string | [MembershipStatus](./MembershipStatus.md): `active` or `disabled`. |
| `createdAt` / `updatedAt` | datetime | Timestamps. |

## Constraints

- `@@unique([accountId, userId])` — one membership per user per account.
- Indexed on `userId` and `accountId`.

## Notes

- **Last-owner protection:** the system refuses to demote/disable/remove the final
  active `account_owner` of an account (returns HTTP 409).
- The public-facing shape is [AccountMembershipDTO](./AccountMembershipDTO.md).
