# AssetStatus

**Category:** Value set (enum)

## Description

`AssetStatus` is the lifecycle state of an [Asset](./Asset.md) as it moves through
upload and background processing.

## Values

| Value | Description |
|---|---|
| `pending` | Uploaded; awaiting processing. |
| `processing` | Renditions are being generated. |
| `ready` | Processing complete; renditions available. |
| `failed` | Processing failed. |
