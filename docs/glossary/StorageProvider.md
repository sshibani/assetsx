# StorageProvider

**Category:** Infrastructure abstraction (package: `@assetx/storage`)

## Description

`StorageProvider` is the interface for persisting and serving binary files (original
uploads and [Rendition](./Rendition.md) outputs). It decouples the application from
the storage backend so implementations can be swapped (e.g. disk now, S3 later).

## Interface

| Method | Description |
|---|---|
| `put(key, data, contentType)` | Persist data under a key (overwrites). Returns `StoredObject`. |
| `get(key)` | Read an object as a stream; rejects if missing. |
| `exists(key)` | Whether an object exists. |
| `getUrl(key)` | A retrievable URL/path for the object. |
| `delete(key)` | Remove an object (no-op if missing). |

## Implementations

- `DiskStorageProvider` — stores files on the local filesystem and serves them via `/files/*`.

## Related

- `StoredObject` — `{ key, sizeBytes, contentType }` returned by `put`.
