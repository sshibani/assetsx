import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { SharpImageProcessor } from "../sharp-image-processor.js";
import { DEFAULT_RENDITIONS } from "../types.js";

let landscape: Buffer; // 3000x2000
let small: Buffer; //    100x100

beforeAll(async () => {
  landscape = await sharp({
    create: {
      width: 3000,
      height: 2000,
      channels: 3,
      background: { r: 120, g: 80, b: 40 },
    },
  })
    .jpeg()
    .toBuffer();

  small = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 10, g: 200, b: 10 },
    },
  })
    .png()
    .toBuffer();
});

describe("SharpImageProcessor.inspect", () => {
  it("returns dimensions, format and size", async () => {
    const processor = new SharpImageProcessor();
    const info = await processor.inspect(landscape);
    expect(info.width).toBe(3000);
    expect(info.height).toBe(2000);
    expect(info.format).toBe("jpeg");
    expect(info.sizeBytes).toBe(landscape.byteLength);
  });

  it("rejects a non-image buffer", async () => {
    const processor = new SharpImageProcessor();
    await expect(processor.inspect(Buffer.from("not an image"))).rejects.toThrow();
  });
});

describe("SharpImageProcessor.process", () => {
  it("produces thumb with longest edge <= 200 in webp", async () => {
    const processor = new SharpImageProcessor();
    const [thumb] = await processor.process(landscape, [DEFAULT_RENDITIONS[0]!]);
    expect(thumb!.name).toBe("thumb");
    expect(thumb!.format).toBe("webp");
    expect(Math.max(thumb!.width, thumb!.height)).toBeLessThanOrEqual(200);
    expect(thumb!.sizeBytes).toBeGreaterThan(0);
  });

  it("standard preserves aspect ratio with longest edge <= 1024", async () => {
    const processor = new SharpImageProcessor();
    const [standard] = await processor.process(landscape, [DEFAULT_RENDITIONS[1]!]);
    expect(standard!.width).toBe(1024);
    expect(standard!.height).toBe(683); // 2000 * (1024/3000) rounded
    expect(standard!.format).toBe("webp");
  });

  it("original rendition keeps source format and bytes", async () => {
    const processor = new SharpImageProcessor();
    const [original] = await processor.process(landscape, [DEFAULT_RENDITIONS[3]!]);
    expect(original!.name).toBe("original");
    expect(original!.format).toBe("jpeg");
    expect(original!.sizeBytes).toBe(landscape.byteLength);
  });

  it("does not upscale images smaller than the target", async () => {
    const processor = new SharpImageProcessor();
    const [standard] = await processor.process(small, [DEFAULT_RENDITIONS[1]!]);
    expect(standard!.width).toBe(100);
    expect(standard!.height).toBe(100);
  });

  it("produces the full default rendition set", async () => {
    const processor = new SharpImageProcessor();
    const results = await processor.process(landscape, DEFAULT_RENDITIONS);
    expect(results.map((r) => r.name)).toEqual([
      "thumb",
      "standard",
      "large",
      "original",
    ]);
  });
});
