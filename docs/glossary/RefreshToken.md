# RefreshToken

**Category:** Data model

## Description

`RefreshToken` is the server-side record of a refresh-token session for a
[User](./User.md). AssetX uses rotating, revocable refresh tokens: each refresh
revokes the used token and issues a new pair. The stored row enables revocation
(logout), rotation-reuse detection, and session auditing.

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Primary key. |
| `userId` | string | Foreign key to [User](./User.md). |
| `accountId` | string \| null | Active account context for the session. |
| `sessionId` | string | Server-side session id for revocation/audit. |
| `identityProvider` | string | Provider used (default `local`). |
| `tokenHash` | string | SHA-256 of the refresh token (unique). |
| `expiresAt` | datetime | Expiry (default 7 days). |
| `revokedAt` | datetime \| null | Set on rotation/logout. |
| `createdAt` | datetime | Timestamp. |

## Notes

- The raw refresh token is never stored — only its hash.
- A disabled membership cannot refresh into an active account context (re-validated on refresh).
