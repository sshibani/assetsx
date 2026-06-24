# GlobalRole

**Category:** Role (enum)

## Description

`GlobalRole` is the platform-wide role carried on a [User](./User.md)
(`User.globalRole`). It is independent of any account and determines whether a user
has platform-administration capabilities.

## Values

| Value | Description |
|---|---|
| `super_user` | Platform administrator. Can access and manage **all** accounts and users, promote/demote other super users, and bypasses account-scoped permission checks. Carries the `platform:manage` [Permission](./Permission.md). |
| `user` | Normal identity. Account capabilities come solely from [AccountMembership](./AccountMembership.md) / [AccountRole](./AccountRole.md). |

## Notes

- Self-service sign-up always creates a `user` (never a `super_user`).
- **Last-super-user protection:** the system refuses to demote the final active
  `super_user` (returns HTTP 409).
