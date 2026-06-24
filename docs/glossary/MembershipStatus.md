# MembershipStatus

**Category:** Value set (enum)

## Description

`MembershipStatus` indicates whether an [AccountMembership](./AccountMembership.md)
is currently in effect.

## Values

| Value | Description |
|---|---|
| `active` | Membership grants the assigned role's permissions. |
| `disabled` | Membership is suspended; the user loses access to the account. |

## Notes

- Disabling the last active `account_owner` is blocked (last-owner protection).
