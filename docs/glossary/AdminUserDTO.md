# AdminUserDTO

**Category:** Data transfer object

## Description

`AdminUserDTO` is a [UserDTO](./UserDTO.md) extended with an account count, used in
the platform admin user list (`GET /api/admin/users`, super-user only).

## Shape

Extends [UserDTO](./UserDTO.md) with:

| Field | Type | Notes |
|---|---|---|
| `accountCount` | number | Number of accounts the user is a member of. |
