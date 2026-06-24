# User

**Category:** Data model

## Description

A `User` is the durable internal identity in AssetX. It is the account-independent
record a person authenticates as. Users can log in with local email/password today
and (by design) through external identity providers later via [UserIdentity](./UserIdentity.md).
A user can belong to many accounts through [AccountMembership](./AccountMembership.md),
holding a different [AccountRole](./AccountRole.md) in each.

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Primary key. |
| `email` | string | Unique login identifier. |
| `passwordHash` | string \| null | argon2 hash; null for IdP-only users. |
| `globalRole` | string | [GlobalRole](./GlobalRole.md): `super_user` or `user`. |
| `createdAt` / `updatedAt` | datetime | Timestamps. |

## Relations

- `memberships` → [AccountMembership](./AccountMembership.md)
- `identities` → [UserIdentity](./UserIdentity.md)
- `assets` → [Asset](./Asset.md) (as owner)
- `comments` → [AssetComment](./AssetComment.md)
- `activities` → [AssetActivity](./AssetActivity.md) (as actor)
- `refreshTokens` → [RefreshToken](./RefreshToken.md)

## Notes

- A `super_user` can access and administer every account regardless of memberships.
- The public-facing shape is [UserDTO](./UserDTO.md); `passwordHash` is never exposed.
