# ImageMetadataDTO

**Category:** Data transfer object

## Description

`ImageMetadataDTO` is the normalized, JSON-serializable representation of an
image's embedded metadata (EXIF / IPTC / XMP / ICC), extracted during worker
processing and stored on [Asset](./Asset.md)`.metadataJson`. It is surfaced
read-only via [AssetDTO](./AssetDTO.md)`.metadata`.

All fields are optional/nullable — most images carry only a subset, and many
(plus all PDFs) carry none, in which case the whole object is `null`. This is
machine-derived data and does **not** change [MetadataSource](./MetadataSource.md).

## Shape

| Field | Type | Notes |
|---|---|---|
| `cameraMake` | string \| null | Camera manufacturer. |
| `cameraModel` | string \| null | Camera model. |
| `lens` | string \| null | Lens model/description. |
| `software` | string \| null | Creating software. |
| `capturedAt` | string \| null | Capture time (ISO-8601), from EXIF DateTimeOriginal. |
| `exposureTime` | string \| null | Shutter speed as a fraction, e.g. `"1/250"`. |
| `fNumber` | number \| null | Aperture f-number. |
| `iso` | number \| null | ISO sensitivity. |
| `focalLength` | number \| null | Focal length in mm. |
| `flash` | boolean \| null | Whether the flash fired. |
| `gps` | `ImageGpsDTO` \| null | Capture location (decimal degrees). |
| `orientation` | number \| null | EXIF orientation. |
| `colorSpace` | string \| null | Color space / ICC profile name. |
| `dpi` | number \| null | Resolution in DPI. |
| `keywords` | string[] \| null | IPTC/XMP keywords. |
| `creator` | string \| null | Artist / creator / by-line. |
| `copyright` | string \| null | Copyright / rights. |

### ImageGpsDTO

| Field | Type | Notes |
|---|---|---|
| `lat` | number | Latitude in decimal degrees. |
| `lng` | number | Longitude in decimal degrees. |
| `altitude` | number \| null | Altitude in metres, if present. |

## Notes

- Extraction is performed in the worker via `exifr` (see
  [ImageProcessor](./ImageProcessor.md)`.extractMetadata`); GPS rationals are
  converted to decimal degrees.
- Exposed to anyone with `assets:read`; GPS coordinates are shown on the asset
  detail page (with a map) for all such users.
