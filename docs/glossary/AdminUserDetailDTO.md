# AdminUserDetailDTO

**Category:** Data transfer object

## Description

`AdminUserDetailDTO` is a [UserDTO](./UserDTO.md) extended with the user's
memberships across all accounts, used in the platform admin user detail view
(`GET /api/admin/users/:userId`, super-user only).

## Shape

Extends [UserDTO](./UserDTO.md) with:

| Field | Type | Notes |
|---|---|---|
| `memberships` | [AccountMembershipDTO](./AccountMembershipDTO.md)[] | The user's memberships across all accounts. |
