# ImageProcessor

**Category:** Infrastructure abstraction (package: `@assetx/image-processing`)

## Description

`ImageProcessor` is the interface for turning a source image into a set of
[Rendition](./Rendition.md)s according to [RenditionSpec](./RenditionSpec.md)s. It
abstracts the underlying imaging library so it can be replaced or mocked in tests.

## Responsibilities

- Probe source dimensions/format (`inspect`).
- Generate resized/reformatted outputs per spec (`process`; cover/inside fit, max dimension).
- Return output buffers and metadata for persistence via the [StorageProvider](./StorageProvider.md).
- Extract embedded EXIF/IPTC/XMP/ICC metadata (`extractMetadata`) into a
  normalized [ImageMetadataDTO](./ImageMetadataDTO.md) (or null), used by the worker.

## Implementations

- `SharpImageProcessor` — built on the `sharp` library; `extractMetadata` uses `exifr`.
