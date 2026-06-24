# DateTimeFormat

**Category:** Value set (enum)

## Description

`DateTimeFormat` is a named preset controlling how dates/times are presented for an
account. It is stored on [AccountSettings](./AccountSettings.md) and applied by the
web app's shared date/time formatter (together with the account's timezone).

## Values

| Value | Description | Example (2026-06-24 13:45 UTC) |
|---|---|---|
| `ISO` | Machine-friendly, 24-hour, in the configured timezone. | `2026-06-24 13:45:30` |
| `US` | en-US locale, 12-hour clock. | `06/24/2026, 01:45 PM` |
| `EU` | en-GB locale, day-first, 24-hour clock. | `24/06/2026, 13:45` |
