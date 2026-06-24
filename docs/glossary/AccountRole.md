# AccountRole

**Category:** Role (enum)

## Description

`AccountRole` is the account-scoped role assigned to a [User](./User.md) within an
[Account](./Account.md) via [AccountMembership](./AccountMembership.md). It maps to a
set of [Permission](./Permission.md)s through `permissionsForAccountRole()`. AssetX
uses a reduced three-role model.

## Values

| Value | Description | Capabilities |
|---|---|---|
| `account_owner` | Full account administrator. | Everything: manage members and roles (incl. assigning owners and ownership transfer), edit/delete the account and its settings, full asset and comment management. |
| `account_editor` | Content manager. | Full asset management (create, update, delete, publish) and commenting. **No** member management and **no** account settings/update. |
| `account_viewer` | Read-only collaborator. | View/download assets and read comments only. |

## Permission matrix

| Permission | owner | editor | viewer |
|---|:---:|:---:|:---:|
| `account:read` | ✓ | ✓ | ✓ |
| `account:update` | ✓ | | |
| `account:delete` | ✓ | | |
| `members:read` | ✓ | | |
| `members:manage` | ✓ | | |
| `members:manage_admins` | ✓ | | |
| `assets:read` | ✓ | ✓ | ✓ |
| `assets:create` | ✓ | ✓ | |
| `assets:update` | ✓ | ✓ | |
| `assets:delete` | ✓ | ✓ | |
| `assets:publish` | ✓ | ✓ | |
| `comments:read` | ✓ | ✓ | ✓ |
| `comments:create` | ✓ | ✓ | |

## Notes

- A [super_user](./GlobalRole.md) implicitly satisfies every account permission.
- The first user of a newly signed-up account becomes `account_owner`.
