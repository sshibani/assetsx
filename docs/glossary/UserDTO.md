# UserDTO

**Category:** Data transfer object

## Description

`UserDTO` is the public, API-safe representation of a [User](./User.md). It never
includes the password hash.

## Shape

| Field | Type | Notes |
|---|---|---|
| `id` | string | User id. |
| `email` | string | Login email. |
| `globalRole` | string | [GlobalRole](./GlobalRole.md). |
| `createdAt` | string (ISO) | Creation timestamp. |

## Notes

- Extended by [AdminUserDTO](./AdminUserDTO.md) and [AdminUserDetailDTO](./AdminUserDetailDTO.md).
