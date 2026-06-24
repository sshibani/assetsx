# AuthAccountContext

**Category:** Authorization contract

## Description

`AuthAccountContext` bundles everything the client needs about one account the
current user can act in: the account, the user's membership in it, and the resolved
permissions. It is returned in [AuthTokens](./AuthTokens.md) and from `GET /api/auth/me`,
and drives the account switcher and permission-gated UI.

## Shape

| Field | Type | Notes |
|---|---|---|
| `account` | [AccountDTO](./AccountDTO.md) | The account. |
| `membership` | [AccountMembershipDTO](./AccountMembershipDTO.md) | The user's membership. |
| `permissions` | [Permission](./Permission.md)[] | Permissions the user holds in this account. |

## Notes

- For a [super_user](./GlobalRole.md), the API returns a context for **every** active
  account (with a synthetic owner-level membership) so they can switch into any account.
