import type {
  ImageMetadataDTO,
  RenditionName,
  RenditionSpec,
} from "@assetx/shared-types";

export type { ImageMetadataDTO, RenditionName, RenditionSpec };

export interface ImageInfo {
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
}

export interface ProcessedRendition {
  name: RenditionName;
  data: Buffer;
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
}

export interface ImageProcessor {
  /** Read intrinsic information about an image buffer. */
  inspect(input: Buffer): Promise<ImageInfo>;
  /** Produce all requested renditions from a source image buffer. */
  process(input: Buffer, specs: RenditionSpec[]): Promise<ProcessedRendition[]>;
  /**
   * Extract embedded EXIF/IPTC/XMP/ICC metadata, normalized to a
   * JSON-serializable shape. Returns null when the image carries no readable
   * metadata or cannot be parsed.
   */
  extractMetadata(input: Buffer): Promise<ImageMetadataDTO | null>;
}

/** Default rendition set per the PRD (§3.2). */
export const DEFAULT_RENDITIONS: RenditionSpec[] = [
  { name: "thumb", maxDimension: 480, quality: 90, format: "webp", fit: "cover" },
  { name: "standard", maxDimension: 1024, quality: 86, format: "webp", fit: "inside" },
  { name: "large", maxDimension: 2048, quality: 84, format: "webp", fit: "inside" },
  { name: "original", format: "original", fit: "inside" },
];
