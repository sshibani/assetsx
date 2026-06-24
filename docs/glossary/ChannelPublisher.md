# ChannelPublisher

**Category:** Infrastructure abstraction (package: `@assetx/publishing`)

## Description

`ChannelPublisher` is the interface for a publishing destination (a "channel") that an
[Asset](./Asset.md) can be published to. Each publish attempt produces a
[Publication](./Publication.md) record. Channels are looked up by id from a registry.

## Interface

| Member | Description |
|---|---|
| `id` | Unique channel identifier. |
| `label` | Human-readable channel name. |
| `publish(asset)` | Publish a `PublishableAsset`; returns a `PublishResult` (`success`/`failed`). |
| `unpublish(reference)` | Remove a previously published asset by its reference. |

## Implementations

- `LocalPublicChannel` — exposes the asset at a local public base URL.
- `WebhookChannel` — POSTs the asset payload to a configured webhook endpoint.

## Related

- `ChannelInfo` — `{ id, label }` summary used by the API/UI.
- `PublishableAsset` / `PublishResult` — input and output shapes for `publish`.
