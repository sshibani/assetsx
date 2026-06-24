# UserIdentity

**Category:** Data model

## Description

`UserIdentity` records how a [User](./User.md) authenticates through a given identity
provider. For local email/password users this is a `local` identity; the model exists
so future OIDC/SAML providers can map external subjects to internal users without
changing account membership or permission logic.

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Primary key. |
| `userId` | string | Foreign key to [User](./User.md). |
| `provider` | string | `local` or a future provider key. |
| `providerSubject` | string | Stable subject id from the provider. |
| `email` | string \| null | Optional provider-supplied email. |
| `createdAt` / `updatedAt` | datetime | Timestamps. |

## Constraints

- `@@unique([provider, providerSubject])` — one identity per provider subject.
- Indexed on `userId`; `onDelete: Cascade` with the user.

## Notes

- Sensitive provider tokens are never stored here or in AssetX JWTs.
