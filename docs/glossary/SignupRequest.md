# SignupRequest

**Category:** Data transfer object

## Description

`SignupRequest` is the request body for self-service sign-up
(`POST /api/auth/signup`). It provisions a new [Account](./Account.md), a new
[User](./User.md) attached as [account_owner](./AccountRole.md), and default
[AccountSettings](./AccountSettings.md), then returns [AuthTokens](./AuthTokens.md).

## Shape

| Field | Type | Notes |
|---|---|---|
| `accountName` | string | Name for the new account (1–100 chars). |
| `email` | string | New user's email (must be unique). |
| `password` | string | New user's password (min 8 chars). |

## Notes

- Duplicate email returns HTTP 409; validation failure returns HTTP 400.
- Never accepts a [GlobalRole](./GlobalRole.md); sign-up always creates a `user`.
