# ImageProcessor

**Category:** Infrastructure abstraction (package: `@assetx/image-processing`)

## Description

`ImageProcessor` is the interface for turning a source image into a set of
[Rendition](./Rendition.md)s according to [RenditionSpec](./RenditionSpec.md)s. It
abstracts the underlying imaging library so it can be replaced or mocked in tests.

## Responsibilities

- Probe source dimensions/format.
- Generate resized/reformatted outputs per spec (cover/inside fit, max dimension).
- Return output buffers and metadata for persistence via the [StorageProvider](./StorageProvider.md).

## Implementations

- `SharpImageProcessor` — built on the `sharp` library.
