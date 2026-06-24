# TokenService

**Category:** Infrastructure abstraction (package: `@assetx/auth`)

## Description

`TokenService` signs and verifies AssetX JWTs. It issues short-lived **access** tokens
and rotating **refresh** tokens using separate secrets, with a configured issuer and
audience, and distinguishes the two by a `type` claim.

## Responsibilities

- `signAccessToken(claims)` / `verifyAccessToken(token)`
- `signRefreshToken(claims)` / `verifyRefreshToken(token)`

## Token claims

Access tokens carry: `sub` (user id), `globalRole`, `accountId`, `accountRole`,
`permissions`, `identityProvider`, `sessionId`, `authTime`, plus standard
`iss`/`aud`/`jti`/`iat`/`exp`/`type`. Refresh tokens carry `sub`, `jti`, `type`,
`identityProvider`, and `sessionId`.

## Notes

- Persisted refresh sessions are tracked as [RefreshToken](./RefreshToken.md) rows.
- The login/refresh response shape is [AuthTokens](./AuthTokens.md).
- Permission-sensitive requests re-validate user/account/membership status against the
  database rather than trusting token claims alone.
