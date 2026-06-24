# AccountSettingsDTO

**Category:** Data transfer object

## Description

`AccountSettingsDTO` is the public representation of
[AccountSettings](./AccountSettings.md).

## Shape

| Field | Type | Notes |
|---|---|---|
| `accountId` | string | Owning [Account](./Account.md) id. |
| `dateTimeFormat` | string | [DateTimeFormat](./DateTimeFormat.md). |
| `timezone` | string | IANA timezone id. |
| `createdAt` / `updatedAt` | string (ISO) | Timestamps. |
