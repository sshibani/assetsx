# Permission

**Category:** Authorization (enum)

## Description

A `Permission` is a single capability string evaluated during authorization. The API
enforces permissions in the service layer via a centralized authorization module.
[AccountRole](./AccountRole.md)s map to permission sets; a [super_user](./GlobalRole.md)
bypasses account checks and carries `platform:manage`.

## Values

| Permission | Description |
|---|---|
| `account:read` | View account details and settings. |
| `account:update` | Edit account details and settings. |
| `account:delete` | Delete/disable the account (owner-only). |
| `members:read` | View account members. |
| `members:manage` | Add, update, disable, or remove members. |
| `members:manage_admins` | Assign/revoke the `account_owner` role and transfer ownership (owner-only). |
| `assets:read` | List and view account assets. |
| `assets:create` | Upload assets. |
| `assets:update` | Edit asset metadata. |
| `assets:delete` | Delete assets. |
| `assets:publish` | Publish/unpublish assets. |
| `comments:read` | Read comments. |
| `comments:create` | Create comments. |
| `platform:manage` | Super-user-only platform administration. |

## Notes

- `hasPermission(user, permission)` returns `true` for super users automatically.
- Owner-only permissions (`account:delete`, `members:manage_admins`) are held by
  `account_owner` only.
