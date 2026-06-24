# AuthTokens

**Category:** Authorization contract

## Description

`AuthTokens` is the response returned by login, sign-up, refresh, and switch-account.
It carries the JWTs plus the user profile and the account contexts available to them.

## Shape

| Field | Type | Notes |
|---|---|---|
| `accessToken` | string | Short-lived JWT for API calls. |
| `refreshToken` | string | Rotating, revocable JWT (see [RefreshToken](./RefreshToken.md)). |
| `user` | [UserDTO](./UserDTO.md) (optional) | The authenticated user. |
| `activeAccount` | [AuthAccountContext](./AuthAccountContext.md) \| null (optional) | The currently selected account context. |
| `accounts` | [AuthAccountContext](./AuthAccountContext.md)[] (optional) | All account contexts available to the user. |

## Notes

- The web app persists only the access token client-side.
- Access tokens are signed/verified by the [TokenService](./TokenService.md).
