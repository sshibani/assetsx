import type { RenditionName, RenditionSpec } from "@assetx/shared-types";

export type { RenditionName, RenditionSpec };

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
}

/** Default rendition set per the PRD (§3.2). */
export const DEFAULT_RENDITIONS: RenditionSpec[] = [
  { name: "thumb", maxDimension: 200, format: "webp", fit: "cover" },
  { name: "standard", maxDimension: 1024, format: "webp", fit: "inside" },
  { name: "large", maxDimension: 2048, format: "webp", fit: "inside" },
  { name: "original", format: "original", fit: "inside" },
];
