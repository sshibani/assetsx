# AccountMembershipDTO

**Category:** Data transfer object

## Description

`AccountMembershipDTO` is the public representation of an
[AccountMembership](./AccountMembership.md), enriched with the member's email.

## Shape

| Field | Type | Notes |
|---|---|---|
| `id` | string | Membership id. |
| `accountId` | string | [Account](./Account.md) id. |
| `userId` | string | [User](./User.md) id. |
| `email` | string | Member email (convenience). |
| `role` | string | [AccountRole](./AccountRole.md). |
| `status` | string | [MembershipStatus](./MembershipStatus.md). |
| `createdAt` / `updatedAt` | string (ISO) | Timestamps. |
