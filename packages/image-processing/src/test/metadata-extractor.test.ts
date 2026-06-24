import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { SharpImageProcessor } from "../sharp-image-processor.js";
import { normalizeMetadata, type RawExif } from "../metadata.js";

let withExif: Buffer;
let plain: Buffer;

beforeAll(async () => {
  // Note: sharp/libvips `withExif` reliably persists IFD0 tags; ExifIFD/GPS
  // sub-IFDs are not round-tripped, so the deep parsing of ISO/lens/GPS is
  // covered by the pure `normalizeMetadata` unit tests below.
  withExif = await sharp({
    create: {
      width: 64,
      height: 48,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })
    .jpeg()
    .withExif({
      IFD0: {
        Make: "Canon",
        Model: "Canon EOS R5",
        Software: "AssetX Test",
      },
    })
    .toBuffer();

  plain = await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();
});

describe("SharpImageProcessor.extractMetadata (integration)", () => {
  it("extracts embedded IFD0 camera fields from a real image", async () => {
    const processor = new SharpImageProcessor();
    const meta = await processor.extractMetadata(withExif);
    expect(meta).not.toBeNull();
    expect(meta!.cameraMake).toBe("Canon");
    expect(meta!.cameraModel).toBe("Canon EOS R5");
    expect(meta!.software).toBe("AssetX Test");
  });

  it("returns null for an image with no EXIF", async () => {
    const processor = new SharpImageProcessor();
    expect(await processor.extractMetadata(plain)).toBeNull();
  });

  it("returns null for a non-image buffer (no throw)", async () => {
    const processor = new SharpImageProcessor();
    expect(
      await processor.extractMetadata(Buffer.from("not an image")),
    ).toBeNull();
  });

  it("produces a JSON-serializable object", async () => {
    const processor = new SharpImageProcessor();
    const meta = await processor.extractMetadata(withExif);
    expect(JSON.parse(JSON.stringify(meta)).cameraMake).toBe("Canon");
  });
});

describe("normalizeMetadata (unit)", () => {
  it("maps camera and capture fields", () => {
    const raw: RawExif = {
      Make: "Nikon",
      Model: "Z9",
      LensModel: "NIKKOR Z 50mm f/1.8 S",
      Software: "Capture One",
      ISO: 800,
      FNumber: 1.8,
      FocalLength: 50,
      ExposureTime: 0.004, // -> 1/250
      DateTimeOriginal: "2021:07:15 14:30:00",
      Orientation: 1,
      Artist: "Jane Doe",
      Copyright: "(c) Jane Doe",
    };
    const meta = normalizeMetadata(raw)!;
    expect(meta.cameraMake).toBe("Nikon");
    expect(meta.cameraModel).toBe("Z9");
    expect(meta.lens).toBe("NIKKOR Z 50mm f/1.8 S");
    expect(meta.software).toBe("Capture One");
    expect(meta.iso).toBe(800);
    expect(meta.fNumber).toBeCloseTo(1.8, 2);
    expect(meta.focalLength).toBe(50);
    expect(meta.exposureTime).toBe("1/250");
    expect(meta.capturedAt).toBe("2021-07-15T14:30:00.000Z");
    expect(meta.orientation).toBe(1);
    expect(meta.creator).toBe("Jane Doe");
    expect(meta.copyright).toBe("(c) Jane Doe");
  });

  it("uses exifr's decimal latitude/longitude for GPS", () => {
    const raw: RawExif = {
      Make: "Apple",
      latitude: 52.370216,
      longitude: 4.895168,
      GPSAltitude: 12.5,
    };
    const meta = normalizeMetadata(raw)!;
    expect(meta.gps).not.toBeNull();
    expect(meta.gps!.lat).toBeCloseTo(52.370216, 5);
    expect(meta.gps!.lng).toBeCloseTo(4.895168, 5);
    expect(meta.gps!.altitude).toBeCloseTo(12.5, 1);
  });

  it("returns gps=null when coordinates are absent", () => {
    expect(normalizeMetadata({ Make: "X" })!.gps).toBeNull();
  });

  it("renders exposure >= 1s without a fraction", () => {
    expect(normalizeMetadata({ ExposureTime: 2 })!.exposureTime).toBe("2");
  });

  it("normalizes keywords into a string array", () => {
    expect(normalizeMetadata({ Keywords: ["a", "b"] })!.keywords).toEqual([
      "a",
      "b",
    ]);
    expect(normalizeMetadata({ Keywords: "solo" })!.keywords).toEqual(["solo"]);
  });

  it("returns null when nothing useful is present", () => {
    expect(normalizeMetadata({})).toBeNull();
    expect(normalizeMetadata({ UnknownTag: 5 })).toBeNull();
  });

  it("parses a Date instance for capturedAt", () => {
    const d = new Date("2020-01-02T03:04:05Z");
    expect(normalizeMetadata({ DateTimeOriginal: d })!.capturedAt).toBe(
      d.toISOString(),
    );
  });

  it("returns null capturedAt for an invalid date string", () => {
    expect(normalizeMetadata({ DateTimeOriginal: "not-a-date" })).toBeNull();
  });

  it("normalizes flash from numeric bitmask, string and boolean", () => {
    expect(normalizeMetadata({ Flash: 1 })!.flash).toBe(true); // bit 0 set
    expect(normalizeMetadata({ Flash: 0 })!.flash).toBe(false); // fired bit clear
    expect(normalizeMetadata({ Flash: "Flash did not fire" })!.flash).toBe(
      false,
    );
    expect(normalizeMetadata({ Flash: true })!.flash).toBe(true);
  });

  it("ignores non-positive exposure times", () => {
    expect(normalizeMetadata({ ExposureTime: 0 })).toBeNull();
    expect(normalizeMetadata({ ExposureTime: -1 })).toBeNull();
  });

  it("maps ColorSpace enum values to names", () => {
    expect(normalizeMetadata({ ColorSpace: 1 })!.colorSpace).toBe("sRGB");
    expect(normalizeMetadata({ ColorSpace: 65535 })!.colorSpace).toBe(
      "Uncalibrated",
    );
    // exifr may surface the enum as a numeric string; still map it.
    expect(normalizeMetadata({ ColorSpace: "65535" })!.colorSpace).toBe(
      "Uncalibrated",
    );
    expect(normalizeMetadata({ ColorSpace: "1" })!.colorSpace).toBe("sRGB");
    expect(normalizeMetadata({ ColorSpace: "Adobe RGB" })!.colorSpace).toBe(
      "Adobe RGB",
    );
  });

  it("treats DPI as null when the resolution unit is centimeters", () => {
    expect(
      normalizeMetadata({ XResolution: 72, ResolutionUnit: "cm" }),
    ).toBeNull();
    expect(
      normalizeMetadata({ XResolution: 300, ResolutionUnit: "inches" })!.dpi,
    ).toBe(300);
  });

  it("falls back to byline/rights for creator/copyright", () => {
    const meta = normalizeMetadata({ byline: "Shooter", rights: "MIT" })!;
    expect(meta.creator).toBe("Shooter");
    expect(meta.copyright).toBe("MIT");
  });

  it("rejects out-of-range GPS coordinates", () => {
    // Include a camera field so the object isn't dropped entirely.
    const meta = normalizeMetadata({ Make: "X", latitude: 200, longitude: 4 })!;
    expect(meta.gps).toBeNull();
  });

  it("caps keywords and truncates very long strings", () => {
    const many = Array.from({ length: 80 }, (_, i) => `k${i}`);
    expect(normalizeMetadata({ Keywords: many })!.keywords).toHaveLength(50);
    const long = "x".repeat(500);
    expect(normalizeMetadata({ Make: long })!.cameraMake!.length).toBe(256);
  });
});
